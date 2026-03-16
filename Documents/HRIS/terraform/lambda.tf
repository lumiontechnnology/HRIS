# API Gateway REST API
resource "aws_apigatewayv2_api" "lumion" {
  name          = "lumion-hris-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"]
    expire_in_seconds = 300
  }

  tags = {
    Name = "lumion-api-gateway"
  }
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "lumion" {
  api_id            = aws_apigatewayv2_api.lumion.id
  name              = var.api_stage_name
  auto_deploy       = true
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationLatency = "$context.integration.latency"
      userAgent      = "$context.identity.userAgent"
    })
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/lumion-hris"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "lumion-api-gateway-logs"
  }
}

# Lambda execution role
resource "aws_iam_role" "lambda_execution" {
  name = "lumion-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Lambda basic execution policy (logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda VPC execution policy (for RDS access)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Lambda policy for Secrets Manager
resource "aws_iam_role_policy" "lambda_secrets" {
  name = "lumion-lambda-secrets"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.db_password.arn
      }
    ]
  })
}

# Lambda policy for S3
resource "aws_iam_role_policy" "lambda_s3" {
  name = "lumion-lambda-s3"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_prefix}-uploads",
          "arn:aws:s3:::${var.s3_bucket_prefix}-uploads/*"
        ]
      }
    ]
  })
}

# Lambda function for API
resource "aws_lambda_function" "api" {
  filename      = "lambda_api.zip"
  function_name = "lumion-hris-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory

  # VPC configuration for database access
  vpc_config {
    subnet_ids         = [aws_subnet.private_1.id, aws_subnet.private_2.id]
    security_group_ids = [aws_security_group.rds.id]
  }

  environment {
    variables = {
      DATABASE_URL       = "postgresql://${var.db_master_username}:****@${aws_db_proxy.lumion.endpoint}:5432/${var.db_initial_database}"
      DB_SECRET_ARN      = aws_secretsmanager_secret.db_password.arn
      NODE_ENV           = var.environment
      LOG_LEVEL          = "info"
      CORS_ORIGINS       = join(",", var.cors_allowed_origins)
    }
  }

  tags = {
    Name = "lumion-api-lambda"
  }
}

# Lambda CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_api" {
  name              = "/aws/lambda/lumion-hris-api"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "lumion-api-logs"
  }
}

# API Gateway Lambda integration
resource "aws_apigatewayv2_integration" "lambda_api" {
  api_id      = aws_apigatewayv2_api.lumion.id
  description = "Lambda API integration"

  integration_target = "arn:aws:apigatewayv2:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${aws_lambda_function.api.arn}/invocations"
  integration_type   = "AWS_PROXY"

  payload_format_version = "2.0"
}

# API Gateway Lambda route
resource "aws_apigatewayv2_route" "lambda_api" {
  api_id    = aws_apigatewayv2_api.lumion.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_api.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lumion.execution_arn}/*/*"
}

# Data source for current region
data "aws_region" "current" {}

# Outputs
output "api_endpoint" {
  value       = aws_apigatewayv2_stage.lumion.invoke_url
  description = "API Gateway endpoint URL"
}

output "api_id" {
  value       = aws_apigatewayv2_api.lumion.id
  description = "API Gateway ID"
}

output "lambda_function_arn" {
  value       = aws_lambda_function.api.arn
  description = "Lambda function ARN"
}
