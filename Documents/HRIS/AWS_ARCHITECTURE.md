# AWS Serverless Architecture Configuration

## Serverless Stack for Lumion HRIS

```
API Requests → API Gateway → Lambda Functions → Aurora PostgreSQL
                                ↓
                           CloudWatch Logs
                                ↓
                          Lambda (Async Jobs)
                                ↓
                           SQS (Queuing)
                                ↓
                        EventBridge (Scheduling)

Static Assets → CloudFront → S3
                                ↓
                          Lambda@Edge (Optimizations)
```

This configuration uses:
- **API Gateway**: REST API endpoints
- **Lambda**: Serverless compute for API and workers
- **Aurora Serverless v2**: Auto-scaling database, pay-per-query
- **S3**: File storage for uploads
- **CloudFront**: CDN for static assets
- **SQS**: Message queue for async jobs
- **EventBridge**: Scheduled tasks and system events
- **IAM**: Least-privilege roles per function
- **CloudWatch**: Monitoring, logs, alarms

## Prerequisites

1. AWS Account with:
   - Permissions to create Lambda, RDS, S3, CloudFront, etc.
   - Valid payment method

2. AWS CLI configured:
   ```bash
   aws configure
   # Enter: Access Key, Secret Key, Region (us-east-1 recommended), Output (json)
   ```

3. IAM User with:
   - `AWSLambdaFullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `IAMFullAccess`

## Configuration Files

1. **Terraform** - Infrastructure as Code
   - VPC, subnets, security groups
   - Aurora PostgreSQL cluster
   - Lambda functions with proper IAM roles
   - API Gateway configuration
   - S3 buckets and CloudFront distribution
   - CloudWatch alarms

2. **Environment** - Secrets and configuration
   - Database credentials
   - API keys
   - Environment-specific settings

3. **Lambda Functions** - Serverless compute
   - API handler (routes to business logic)
   - Scheduled tasks (leave accrual, birthdays, payroll triggers)
   - Worker jobs (email, PDF generation, reports)
   - Pre-signed URL generation (S3 uploads)

4. **Infrastructure** - Architecture documentation
   - Deployment architecture
   - Cost estimation
   - Scaling strategies
   - Disaster recovery

## Environment Setup

### Step 1: Create AWS Credentials
```bash
# In AWS Console:
# 1. Create IAM User (your-name-lumion-dev)
# 2. Attach policies (see above)
# 3. Create Access Keys
# 4. Save Access Key ID and Secret Access Key

# On your machine:
aws configure --profile lumion-prod
# Enter credentials when prompted
```

### Step 2: Create S3 Backend for Terraform State
```bash
# This stores your infrastructure state in S3 (versioned, encrypted)
aws s3 mb s3://lumion-hris-terraform-state-prod --region us-east-1 --profile lumion-prod
aws s3api put-bucket-versioning \
  --bucket lumion-hris-terraform-state-prod \
  --versioning-configuration Status=Enabled \
  --profile lumion-prod
```

### Step 3: Deploy Infrastructure
```bash
cd terraform/
terraform init
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

## Architecture Tiers

### 1. Compute Layer
- **API Gateway**: HTTP endpoints
- **Lambda**: API handlers, workers, scheduled tasks
- **Auto-scaling**: Handles variable load

### 2. Data Layer
- **Aurora Serverless v2**: Managed PostgreSQL
- **RDS Proxy**: Connection pooling
- **Automated backups**: Daily to S3

### 3. Storage Layer
- **S3**: Documents, uploads, exports
- **CloudFront**: Static assets cache
- **Versioning**: Document history

### 4. Queue Layer
- **SQS**: Async job processing
- **Dead Letter Queue**: Failed job retry
- **Lambda consumers**: Process messages

### 5. Scheduling Layer
- **EventBridge**: Cron jobs
- **Lambda targets**: Scheduled task functions
- **Error handling**: Automatic retries with backoff

### 6. Monitoring Layer
- **CloudWatch Logs**: All Lambda logs
- **CloudWatch Alarms**: Error rates, latency
- **X-Ray**: Distributed tracing
- **Metrics**: Custom metrics per endpoint

## Cost Optimization

### Always-Free Services
- ✅ Lambda: 1M free requests/month
- ✅ CloudFront: 1TB free data transfer/month
- ✅ CloudWatch: Limited free tier
- ✅ API Gateway: $3.50/million requests
- ✅ EventBridge: $0.35/million events

### Pay-Per-Use Services
- Aurora Serverless v2: **$0.49/ACU/hour** (pay what you use)
  - Auto-scales to 0 if no traffic
  - Typical app: $20-50/month
- S3: **$0.023/GB** stored, **$0.0007/1000 requests**
- Lambda: **$0.20/1M requests**, **$0.0000166667/GB-second**

### Estimated Monthly Cost
```
Aurora RDS:        $50-100  (dev: $10, prod: $50-100)
Lambda:            $5-20
S3 Storage:        $5-15
CloudFront:        $5-20
API Gateway:       $10-30
Total:             ~$75-185/month (development)
                   ~$150-300/month (production)
```

Compare to traditional servers:
- EC2 + RDS traditional: $500-1000/month
- This saves ~70% compared to always-on infrastructure

## Deployment Steps

### Stage 1: Bootstrap (one-time)
1. Create AWS account and IAM user
2. Configure AWS CLI
3. Create S3 backend for Terraform
4. Create VPC and networking

### Stage 2: Infrastructure
1. Deploy Aurora Serverless cluster
2. Deploy Lambda functions
3. Deploy API Gateway
4. Configure IAM roles
5. Setup CloudWatch alarms

### Stage 3: Application
1. Deploy API Lambda code
2. Deploy worker Lambda functions
3. Deploy EventBridge rules
4. Configure SQS queues
5. Setup CloudFront distribution

### Stage 4: Verification
1. Test API endpoints
2. Verify database connectivity
3. Test scheduled tasks
4. Verify file uploads to S3
5. Check CloudWatch logs

### Stage 5: Production
1. Setup custom domain (Route 53)
2. Enable SSL/TLS (ACM certificate)
3. Setup health checks
4. Configure alarms and notifications
5. Setup backup strategy

## Key Files

- `terraform/main.tf` - Core infrastructure
- `terraform/lambda.tf` - Lambda functions
- `terraform/rds.tf` - Aurora database
- `terraform/s3.tf` - Storage and CDN
- `terraform/iam.tf` - Roles and permissions
- `terraform/prod.tfvars` - Production variables
- `lambda-api/` - API handler code
- `lambda-workers/` - Background job code

## Security Best Practices

1. **IAM**: Least-privilege roles per Lambda
2. **Encryption**: In-transit (TLS) and at-rest (KMS)
3. **VPC**: Database in private subnet
4. **Secrets**: AWS Secrets Manager for credentials
5. **Network**: Security groups restrict access
6. **Logging**: All requests logged to CloudWatch
7. **Backups**: Daily Aurora backups to S3
8. **Rate Limiting**: API Gateway throttling

## Monitoring & Alerts

```
CloudWatch Alarms:
- Lambda error count > 5/minute
- Lambda duration > 30 seconds
- Aurora CPU > 80%
- Aurora connections > 100
- API Gateway 5xx errors > 1%
- SQS DLQ messages > 0

Actions:
- SNS notification to ops team
- Auto-scaling adjustments
- Incident response automation
```

## Scaling Strategy

### Vertical (Database)
- Aurora auto-scales ACUs based on demand
- Min: 0.5 ACUs (dev)
- Max: 2 ACUs (small-medium app)
- Max: 128 ACUs (enterprise)

### Horizontal (Compute)
- Lambda auto-scales concurrency
- API Gateway rate-based Auto-scaling
- SQS queue depth triggers worker scaling

### Geographic
- CloudFront multi-region caching
- Route 53 weighted routing
- Aurora Global Database (multi-region)

## Disaster Recovery

### RTO: 15 minutes
### RPO: 1 hour

Strategy:
1. Daily automated Aurora backups to S3
2. Cross-region snapshot replication
3. One-click restore to different region
4. Test restore procedure monthly

## Migration Path

### Phase 1: Local Development
- Docker PostgreSQL + Redis
- API and Web on localhost

### Phase 2: AWS Development
- AWS RDS (PostgreSQL)
- Lambda functions
- Testing environment

### Phase 3: AWS Production
- Aurora Serverless (production-grade)
- High availability setup
- Multi-region backup

### Phase 4: Optimization
- Performance tuning
- Cost optimization
- Advanced monitoring

---

**This serverless architecture** provides:
✅ Auto-scaling to handle traffic spikes  
✅ Pay-per-use pricing (no idle cost)  
✅ Enterprise-grade reliability (99.99% SLA)  
✅ Automated backups and disaster recovery  
✅ Built-in monitoring and alerting  
✅ Global CDN for fast content delivery  
✅ Security best practices by default  

See `terraform/` directory for complete IaC code.
