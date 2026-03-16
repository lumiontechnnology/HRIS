# Aurora Serverless v2 PostgreSQL Cluster
resource "aws_rds_cluster" "lumion" {
  cluster_identifier              = "lumion-hris-cluster"
  engine                          = "aurora-postgresql"
  engine_version                  = "15.3"
  database_name                   = var.db_initial_database
  master_username                 = var.db_master_username
  master_password                 = var.db_master_password
  db_subnet_group_name            = aws_db_subnet_group.lumion.name
  vpc_security_group_ids          = [aws_security_group.rds.id]
  backup_retention_period         = var.backup_retention_days
  preferred_backup_window         = "03:00-04:00"
  preferred_maintenance_window    = "sun:04:00-sun:05:00"
  enabled_cloudwatch_logs_exports = ["postgresql"]
  apply_immediately               = false
  skip_final_snapshot             = var.environment != "production"
  final_snapshot_identifier       = var.environment == "production" ? "lumion-hris-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  enable_http_endpoint            = true

  serverlessv2_scaling_configuration {
    max_capacity = var.database_max_acu
    min_capacity = var.database_min_acu
  }

  tags = {
    Name = "lumion-aurora-cluster"
  }
}

# Primary instance for Aurora Serverless v2
resource "aws_rds_cluster_instance" "lumion_primary" {
  cluster_identifier           = aws_rds_cluster.lumion.id
  instance_class               = "db.serverless"
  engine                       = aws_rds_cluster.lumion.engine
  engine_version               = aws_rds_cluster.lumion.engine_version
  performance_insights_enabled = false

  tags = {
    Name = "lumion-aurora-primary"
  }
}

# RDS Proxy for connection pooling (optional but recommended)
resource "aws_db_proxy" "lumion" {
  name                   = "lumion-hris-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.db_password.arn
  }
  role_arn               = aws_iam_role.rds_proxy.arn
  db_proxy_role_name     = "lumion-rds-proxy-role"
  db_instance_identifiers      = []
  db_cluster_identifiers       = [aws_rds_cluster.lumion.arn]
  max_connections        = 100
  max_idle_connections   = 50
  connection_ttl         = 900
  session_pinning_filters = []
  init_query             = ""

  tags = {
    Name = "lumion-rds-proxy"
  }

  depends_on = [aws_secretsmanager_secret_version.db_password]
}

# RDS Proxy target group
resource "aws_db_proxy_target_group" "lumion" {
  db_proxy_name          = aws_db_proxy.lumion.name
  name                   = "default"
  db_cluster_identifiers = [aws_rds_cluster.lumion.arn]
}

# Database subnet group
resource "aws_db_subnet_group" "lumion" {
  name       = "lumion-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "lumion-db-subnet-group"
  }
}

# IAM role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  name = "lumion-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for RDS Proxy to access Secrets Manager
resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name = "lumion-rds-proxy-secrets"
  role = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = aws_secretsmanager_secret.db_password.arn
      }
    ]
  })
}

# CloudWatch Log Group for Aurora
resource "aws_cloudwatch_log_group" "aurora_postgresql" {
  name              = "/aws/rds/cluster/lumion-hris/postgresql"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "lumion-aurora-logs"
  }
}

# Aurora Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "lumion" {
  name        = "lumion-cluster-params"
  family      = "aurora-postgresql15"
  description = "Parameter group for Lumion HRIS Aurora"

  # Enable connection pooling
  parameter {
    name  = "rds_aurora_parallel_query"
    value = "on"
  }

  # Logging
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_duration"
    value = "on"
  }

  tags = {
    Name = "lumion-cluster-params"
  }
}

# Outputs
output "aurora_endpoint" {
  value       = aws_rds_cluster.lumion.endpoint
  description = "Aurora cluster endpoint"
}

output "aurora_reader_endpoint" {
  value       = aws_rds_cluster.lumion.reader_endpoint
  description = "Aurora read replica endpoint"
}

output "aurora_cluster_identifier" {
  value       = aws_rds_cluster.lumion.id
  description = "Aurora cluster identifier"
}

output "rds_proxy_endpoint" {
  value       = aws_db_proxy.lumion.endpoint
  description = "RDS Proxy endpoint for connection pooling"
}

output "database_name" {
  value       = aws_rds_cluster.lumion.database_name
  description = "Initial database name"
}

output "database_url" {
  value       = "postgresql://${var.db_master_username}:****@${aws_db_proxy.lumion.endpoint}:5432/${var.db_initial_database}"
  description = "Database connection URL (password redacted)"
  sensitive   = true
}
