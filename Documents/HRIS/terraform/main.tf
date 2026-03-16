terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Store state in S3 (change bucket name to your actual bucket)
  backend "s3" {
    bucket         = "lumion-hris-terraform-state-prod"
    key            = "lumion-hris/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "lumion-hris"
      Terraform   = "true"
      CreatedDate = timestamp()
    }
  }
}

# Create DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_locks" {
  count           = var.create_state_table ? 1 : 0
  name            = "terraform-locks"
  billing_mode    = "PAY_PER_REQUEST"
  hash_key        = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "terraform-state-lock"
  }
}

# VPC for database and Lambda (if using VPC Lambda)
resource "aws_vpc" "lumion" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "lumion-vpc"
  }
}

# Private subnet for RDS
resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.lumion.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "lumion-private-1"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.lumion.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "lumion-private-2"
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "lumion-rds-sg"
  description = "Security group for Aurora PostgreSQL"
  vpc_id      = aws_vpc.lumion.id

  # Allow Lambda to connect (will be updated with Lambda SG)
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = ["10.0.0.0/16"]
    description     = "PostgreSQL from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "lumion-rds-sg"
  }
}

# AWS Secrets Manager for database credentials
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "lumion/database/password"
  description             = "Aurora PostgreSQL master password"
  recovery_window_in_days = 7

  tags = {
    Name = "lumion-db-password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id      = aws_secretsmanager_secret.db_password.id
  secret_string  = var.db_master_password
}

# Outputs for other modules
output "vpc_id" {
  value       = aws_vpc.lumion.id
  description = "VPC ID"
}

output "private_subnet_ids" {
  value       = [aws_subnet.private_1.id, aws_subnet.private_2.id]
  description = "Private subnet IDs for RDS"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS security group ID"
}

output "db_secret_arn" {
  value       = aws_secretsmanager_secret.db_password.arn
  description = "Database password secret ARN"
}
