aws_region              = "us-east-1"
environment             = "production"
create_state_table      = true
db_master_username      = "postgres"
db_master_password      = "CHANGE_ME_TO_SECURE_PASSWORD_MIN_8_CHARS"
db_initial_database     = "lumion_hris"
database_max_acu        = 2
database_min_acu        = 0.5
lambda_memory           = 256
lambda_timeout          = 30
api_stage_name          = "prod"
s3_bucket_prefix        = "lumion-hris-prod"
backup_retention_days   = 30
enable_cloudwatch_alarms = true
alarm_email             = "ops@example.com"
log_retention_days      = 30

cors_allowed_origins = [
  "https://app.example.com",
  "https://www.example.com"
]

# Custom domain (optional)
domain_name      = "api.example.com"
certificate_arn  = ""  # Add ACM certificate ARN when available

tags = {
  CostCenter = "Engineering"
  Owner      = "Platform Team"
  Slack      = "#platform"
}
