# SNS topic for alarms
resource "aws_sns_topic" "lumion_alarms" {
  name = "lumion-hris-alarms"

  tags = {
    Name = "lumion-alarms"
  }
}

# SNS email subscription
resource "aws_sns_topic_subscription" "lumion_alarms_email" {
  topic_arn = aws_sns_topic.lumion_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# CloudWatch alarm for Lambda errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when Lambda error count > 5"
  alarm_actions       = [aws_sns_topic.lumion_alarms.arn]
  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }
}

# CloudWatch alarm for Lambda duration
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 30000  # 30 seconds in milliseconds
  alarm_description   = "Alert when Lambda duration > 30s"
  alarm_actions       = [aws_sns_topic.lumion_alarms.arn]
  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }
}

# CloudWatch alarm for Aurora CPU
resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-aurora-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when Aurora CPU > 80%"
  alarm_actions       = [aws_sns_topic.lumion_alarms.arn]
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.lumion.id
  }
}

# CloudWatch alarm for Aurora connections
resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-aurora-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Alert when Aurora connections > 100"
  alarm_actions       = [aws_sns_topic.lumion_alarms.arn]
  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.lumion.id
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "lumion" {
  dashboard_name = "lumion-hris"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Invocations" }],
            [".", "Errors", { stat = "Sum", label = "Errors" }],
            [".", "Duration", { stat = "Average", label = "Avg Duration" }],
            [".", "ConcurrentExecutions", { stat = "Maximum", label = "Peak Concurrency" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Lambda Performance"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", { label = "CPU %" }],
            [".", "DatabaseConnections", { label = "Connections" }],
            [".", "ReadLatency", { label = "Read Latency (ms)" }],
            [".", "WriteLatency", { label = "Write Latency (ms)" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Aurora Performance"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", { label = "Requests" }],
            [".", "BytesDownloaded", { label = "Bytes Downloaded" }],
            [".", "4xxErrorRate", { label = "4xx Error Rate %" }],
            [".", "5xxErrorRate", { label = "5xx Error Rate %" }]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "CloudFront Performance"
        }
      },
      {
        type = "log"
        properties = {
          query = "fields @timestamp, @message, @duration | filter ispresent(@duration) | stats avg(@duration) as avg_duration, max(@duration) as max_duration"
          region = data.aws_region.current.name
          title  = "Recent Logs"
        }
      }
    ]
  })
}

# Outputs
output "sns_topic_arn" {
  value       = aws_sns_topic.lumion_alarms.arn
  description = "SNS topic ARN for alarms"
}

output "dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.lumion.dashboard_name}"
  description = "CloudWatch dashboard URL"
}
