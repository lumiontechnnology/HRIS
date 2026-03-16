# S3 bucket for uploads
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.s3_bucket_prefix}-uploads"

  tags = {
    Name = "lumion-uploads"
  }
}

# Block public access to uploads bucket
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning on uploads
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on uploads
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket for static assets (front-end build)
resource "aws_s3_bucket" "static" {
  bucket = "${var.s3_bucket_prefix}-static"

  tags = {
    Name = "lumion-static"
  }
}

# Block public access to static bucket directly (CloudFront only)
resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning on static
resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption on static
resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.oai.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static.arn}/*"
      }
    ]
  })
}

# CloudFront Origin Access Identity (OAI)
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for Lumion HRIS static assets"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "lumion" {
  enabled         = true
  is_ipv6_enabled = true

  origin {
    domain_name = aws_s3_bucket.static.bucket_regional_domain_name
    origin_id   = "S3Origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  # API origin
  origin {
    domain_name = trimprefix(aws_apigatewayv2_stage.lumion.invoke_url, "https://")
    origin_id   = "APIOrigin"
    origin_path = "/${var.api_stage_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # API cache behavior
  cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "APIOrigin"

    forwarded_values {
      query_string = true
      headers {
        header_names = [
          "Accept",
          "Accept-Encoding",
          "Accept-Language",
          "Authorization",
          "Content-Type",
          "Host",
          "Origin",
          "Referer",
          "User-Agent",
          "X-Requested-With"
        ]
      }
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # Custom error responses
  custom_error_response {
    error_code    = 404
    response_code = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code    = 403
    response_code = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == "" ? true : false
    acm_certificate_arn            = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
  }

  tags = {
    Name = "lumion-cdn"
  }
}

# CloudWatch alarms for CloudFront
resource "aws_cloudwatch_metric_alarm" "cloudfront_4xx" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-cloudfront-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "Alert when 4xx error rate > 5%"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.lumion.id
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "lumion-cloudfront-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Alert when 5xx error rate > 1%"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.lumion.id
  }
}

# Outputs
output "s3_uploads_bucket" {
  value       = aws_s3_bucket.uploads.id
  description = "S3 uploads bucket name"
}

output "s3_static_bucket" {
  value       = aws_s3_bucket.static.id
  description = "S3 static assets bucket name"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.lumion.domain_name
  description = "CloudFront distribution domain"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.lumion.id
  description = "CloudFront distribution ID"
}
