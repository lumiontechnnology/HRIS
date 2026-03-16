# AWS Setup Guide - Lumion HRIS Serverless Deployment

## Prerequisites

1. **AWS Account**
   - Sign up at https://aws.amazon.com
   - Verify payment method
   - Enable MFA on root account

2. **Local Tools**
   ```bash
   # Already installed:
   - Docker & Docker Compose
   - Node.js 20+
   - pnpm
   
   # Install new:
   - Terraform (IaC): https://www.terraform.io/downloads
   - AWS CLI v2: https://aws.amazon.com/cli/
   ```

3. **IAM User Setup**
   - Create programmatic access user in AWS Console
   - Assign policies:
     - `AWSLambdaFullAccess`
     - `AmazonRDSFullAccess`
     - `AmazonS3FullAccess`
     - `CloudFrontFullAccess`
     - `AmazonAPIGatewayAdministrator`
     - `IAMFullAccess`
   - Create Access Key and Secret Access Key

## Step 1: Install Tools

### Terraform
```bash
# macOS
brew install terraform

# Verify
terraform --version
```

### AWS CLI v2
```bash
# If brew installation earlier didn't work:
# Download from: https://awscli.amazonaws.com/awscli-exe-darwin-x86_64.zip
# Or try alternative:
pip install awscli --upgrade

# Verify
aws --version
```

## Step 2: Configure AWS Credentials

```bash
# Method 1: Interactive setup
aws configure --profile lumion-prod

# Enter when prompted:
# - AWS Access Key ID: [from IAM user]
# - AWS Secret Access Key: [from IAM user]
# - Default region: us-east-1
# - Default output format: json

# Method 2: Manual setup
nano ~/.aws/credentials

# Add:
[lumion-prod]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY

# Setup config
nano ~/.aws/config

# Add:
[profile lumion-prod]
region = us-east-1
output = json
```

### Verify credentials
```bash
aws sts get-caller-identity --profile lumion-prod

# Expected output:
{
  "UserId": "...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

## Step 3: Create S3 Backend for Terraform State

```bash
# Create bucket for state (replace with unique name)
aws s3 mb s3://lumion-hris-terraform-state-prod --region us-east-1 --profile lumion-prod

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket lumion-hris-terraform-state-prod \
  --versioning-configuration Status=Enabled \
  --profile lumion-prod

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket lumion-hris-terraform-state-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' \
  --profile lumion-prod

# Block public access
aws s3api put-public-access-block \
  --bucket lumion-hris-terraform-state-prod \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile lumion-prod

# Verify bucket
aws s3 ls --profile lumion-prod
```

## Step 4: Update Terraform Configuration

Edit `terraform/main.tf` and update the backend bucket name:

```hcl
backend "s3" {
  bucket         = "lumion-hris-terraform-state-prod"  # Update this
  key            = "lumion-hris/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-locks"
}
```

## Step 5: Configure Production Variables

Edit `terraform/prod.tfvars`:

```hcl
# Update with your values
aws_region              = "us-east-1"
environment             = "production"
db_master_password      = "YOUR_SECURE_PASSWORD_HERE"
s3_bucket_prefix        = "lumion-hris-prod-UNIQUEID"
alarm_email             = "ops@yourcompany.com"

cors_allowed_origins = [
  "https://app.yourcompany.com",
  "https://www.yourcompany.com"
]

domain_name = "api.yourcompany.com"
```

## Step 6: Deploy Infrastructure

### Initialize Terraform

```bash
cd terraform/

# Initialize Terraform (creates .terraform/)
terraform init

# Verify configuration
terraform validate

# Expected output:
# ✓ All configuration files are valid
```

### Review Plan

```bash
# See what will be created
terraform plan -var-file=prod.tfvars -out=tfplan

# Review output carefully:
# - Aurora cluster
# - Lambda functions
# - API Gateway
# - S3 buckets
# - CloudFront distribution
# - RDS Proxy
# - IAM roles

# Total resources: ~30+ to be created
# Estimated cost: $5-20/day initially (scales with usage)
```

### Apply Infrastructure

```bash
# Create all resources
terraform apply tfplan

# Wait for completion (~10-15 minutes)
# You'll see:
# ✓ Aurora cluster created
# ✓ Lambda functions created
# ✓ API Gateway configured
# ✓ S3 buckets created
# ✓ CloudFront distribution created

# Note the outputs:
# - API Endpoint: https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
# - CloudFront domain: xxxxx.cloudfront.net
# - S3 buckets created
```

### Outputs

After deployment, Terraform outputs:

```
Outputs:

aurora_endpoint = "lumion-hris-cluster.xxxxxxxxxxxx.rds.amazonaws.com"
aurora_reader_endpoint = "lumion-hris-cluster-ro.xxxxxxxxxxxx.rds.amazonaws.com"
api_endpoint = "https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod/"
cloudfront_domain_name = "d1234567890.cloudfront.net"
database_url = "postgresql://postgres:****@lumion-hris-proxy.xxxxxxxxxxxx.rds.amazonaws.com:5432/lumion_hris"
rds_proxy_endpoint = "lumion-hris-proxy.xxxxxxxxxxxx.rds.amazonaws.com"
s3_static_bucket = "lumion-hris-prod-static"
s3_uploads_bucket = "lumion-hris-prod-uploads"
```

## Step 7: Deploy Application Code

### Build Lambda Package

```bash
cd apps/api/

# Install dependencies
pnpm install

# Build API
pnpm build

# Package Lambda
zip -r ../../terraform/lambda_api.zip dist/ node_modules/ package.json

# Upload to Lambda
aws lambda update-function-code \
  --function-name lumion-hris-api \
  --zip-file fileb://lambda_api.zip \
  --profile lumion-prod
```

### Upload Static Assets

```bash
# Build Next.js app
cd apps/web/
pnpm build
pnpm export

# Upload to S3
aws s3 sync out/ s3://lumion-hris-prod-static/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --profile lumion-prod

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id D1234567890 \
  --paths "/*" \
  --profile lumion-prod
```

## Step 8: Configure Database

### Run Migrations

```bash
# Get database connection string
DB_URL=$(terraform output -raw database_url)

# Run Prisma migrations
pnpm --filter @lumion/database db:migrate

# Seed database
pnpm --filter @lumion/database db:seed
```

## Step 9: Test Deployment

```bash
# Test API endpoint
curl https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health

# Test CloudFront
curl https://d1234567890.cloudfront.net/

# View logs
aws logs tail /aws/lambda/lumion-hris-api --follow --profile lumion-prod
```

## Step 10: Configure Custom Domain (Optional)

### Request SSL Certificate

```bash
aws acm request-certificate \
  --domain-name api.yourcompany.com \
  --validation-method DNS \
  --region us-east-1 \
  --profile lumion-prod
```

### Update Terraform

Edit `terraform/prod.tfvars`:

```hcl
certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"
domain_name     = "api.yourcompany.com"
```

### Apply Changes

```bash
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

### Create DNS Record

```bash
# Create CNAME in Route 53 or your DNS provider
# Name: api.yourcompany.com
# Value: d1234567890.cloudfront.net (CloudFront domain)
# TTL: 300
```

## Monitoring & Alerts

### CloudWatch Dashboard

```bash
# View dashboard URL from outputs
aws cloudwatch describe-dashboards \
  --query 'DashboardEntries[0].DashboardName' \
  --profile lumion-prod

# Open in browser:
# https://console.aws.amazon.com/cloudwatch/home
```

### View Logs

```bash
# Lambda logs
aws logs tail /aws/lambda/lumion-hris-api --follow --profile lumion-prod

# API Gateway logs
aws logs tail /aws/apigateway/lumion-hris --follow --profile lumion-prod

# Aurora logs
aws logs tail /aws/rds/cluster/lumion-hris/postgresql --follow --profile lumion-prod
```

## Scaling Configuration

### Auto-scaling Database

Aurora Serverless v2 automatically scales:
- Scales up when demand increases
- Scales down to minimum when idle
- Between 0.5 and 2 ACUs (configurable)

To adjust:

```hcl
# In terraform/prod.tfvars
database_max_acu = 4  # Increase for higher load
database_min_acu = 0.5  # Keep at 0.5 to save cost
```

Then apply:
```bash
terraform apply -var-file=prod.tfvars
```

### Lambda Scaling

Auto-scales based on requests:
- Concurrent executions: unlimited
- Reserved concurrency: set per function if needed

## Cost Management

### View Costs

```bash
# AWS Billing Console
# https://console.aws.amazon.com/billing/

# Estimate monthly cost
- Aurora: $50-100/month (dev to prod)
- Lambda: $5-20/month
- S3: $5-15/month
- CloudFront: $5-20/month
- Total: ~$150-250/month production
```

### Cost Optimization

1. **Reduce database size**
   ```hcl
   database_max_acu = 1  # Instead of 2
   ```

2. **Use S3 Intelligent-Tiering**
   - Automatically moves files to cheaper tiers

3. **Enable CloudFront caching**
   - Reduces origin requests
   - Already configured in terraform/s3.tf

4. **Monitor unused resources**
   ```bash
   aws ce get-cost-and-usage-all-regions --profile lumion-prod
   ```

## Troubleshooting

### Terraform State Issues

```bash
# Force unlock
terraform force-unlock <LOCK_ID>

# View state
terraform show

# Refresh state
terraform refresh -var-file=prod.tfvars
```

### Lambda Connection Issues

```bash
# View Lambda logs
aws logs tail /aws/lambda/lumion-hris-api --follow --profile lumion-prod

# Test RDS connection
aws rds describe-db-clusters \
  --query 'DBClusters[0].Endpoint' \
  --profile lumion-prod

# Check security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=lumion-rds-sg" \
  --profile lumion-prod
```

### API Not Responding

```bash
# Clear CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id D1234567890 \
  --paths "/*" \
  --profile lumion-prod

# Check API Gateway logs
aws logs tail /aws/apigateway/lumion-hris --follow --profile lumion-prod

# Test endpoint
curl -X GET https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health \
  -H "Content-Type: application/json" \
  -v
```

## Destruction (When Done)

⚠️ This deletes all resources and is irreversible!

```bash
# Plan destruction
terraform plan -destroy -var-file=prod.tfvars

# Confirm resources to delete
# (you'll see all resources being removed)

# Destroy
terraform destroy -var-file=prod.tfvars

# Confirm when prompted (type: yes)

# Note: 
# - S3 buckets must be empty first
# - RDS snapshots are kept for 7 days
# - DynamoDB table may need manual deletion
```

## Next Steps

1. ✅ AWS CLI configured
2. ✅ Terraform working
3. ✅ Infrastructure deployed
4. → Deploy API code to Lambda
5. → Deploy frontend to CloudFront
6. → Configure custom domain
7. → Set up monitoring alerts
8. → Test end-to-end
9. → Go live!

---

**Support Resources:**
- [Terraform AWS Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [AWS Serverless Best Practices](https://docs.aws.amazon.com/whitepapers/latest/serverless-applications/)
- [Aurora Serverless Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Serverless.html)
