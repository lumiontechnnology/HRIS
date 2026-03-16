aws_region              = "us-east-1"
environment             = "development"
create_state_table      = true
db_master_username      = "postgres"
db_master_password      = "dev_password_123"
db_initial_database     = "lumion_hris_dev"
database_max_acu        = 1
database_min_acu        = 0.5
lambda_memory           = 128
lambda_timeout          = 30
api_stage_name          = "dev"
s3_bucket_prefix        = "lumion-hris-dev"
backup_retention_days   = 7
enable_cloudwatch_alarms = false
alarm_email             = "dev@example.com"
log_retention_days      = 7

cors_allowed_origins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dev.example.com"
]

# Custom domain
domain_name      = ""
certificate_arn  = ""

tags = {
  CostCenter = "Engineering"
  Owner      = "Dev Team"
  Environment = "Development"
}
