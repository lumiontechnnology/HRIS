variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "create_state_table" {
  description = "Create DynamoDB table for Terraform locking"
  type        = bool
  default     = false
}

variable "db_master_username" {
  description = "Aurora master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "db_master_password" {
  description = "Aurora master password (min 8 chars)"
  type        = string
  sensitive   = true
}

variable "db_initial_database" {
  description = "Initial database name"
  type        = string
  default     = "lumion_hris"
}

variable "database_max_acu" {
  description = "Maximum Aurora Serverless v2 capacity"
  type        = number
  default     = 2
}

variable "database_min_acu" {
  description = "Minimum Aurora Serverless v2 capacity"
  type        = number
  default     = 0.5
}

variable "lambda_memory" {
  description = "Lambda memory in MB"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://app.example.com", "https://www.example.com"]
}

variable "domain_name" {
  description = "Custom domain name for API"
  type        = string
  default     = "api.example.com"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = ""
}

variable "s3_bucket_prefix" {
  description = "S3 bucket name prefix"
  type        = string
}

variable "backup_retention_days" {
  description = "Aurora backup retention in days"
  type        = number
  default     = 30
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms"
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email for alarm notifications"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
