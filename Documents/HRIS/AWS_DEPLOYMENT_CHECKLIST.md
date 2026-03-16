# AWS Deployment Checklist

## Pre-Deployment

- [ ] AWS account created and verified
- [ ] IAM user created with proper permissions
- [ ] AWS CLI installed and configured
- [ ] Terraform installed and tested
- [ ] All source code committed and pushed

## Infrastructure Planning

- [ ] Region selected: `us-east-1` (or your choice)
- [ ] Database password updated in `terraform/prod.tfvars`
- [ ] S3 bucket prefix is unique: `lumion-hris-prod-UNIQUEID`
- [ ] Alarm email configured: `ops@example.com`
- [ ] CORS origins updated to your domain
- [ ] Domain name decided (e.g., `api.example.com`)

## AWS Setup

- [ ] S3 bucket created for Terraform state
- [ ] S3 backend bucket has versioning enabled
- [ ] S3 backend bucket has encryption enabled
- [ ] DynamoDB table name updated in `terraform/main.tf`
- [ ] AWS credentials tested: `aws sts get-caller-identity`
- [ ] Correct profile set: `--profile lumion-prod`

## Terraform Preparation

- [ ] `terraform/main.tf` backend bucket name updated
- [ ] `terraform/prod.tfvars` all variables filled
- [ ] `terraform/lambda.tf` reviewed and understood
- [ ] `terraform/rds.tf` capacity settings appropriate for your load
- [ ] `terraform/s3.tf` CloudFront configuration correct
- [ ] Terraform files validated: `terraform validate`

## Terraform Deployment

- [ ] `cd terraform/` directory changed
- [ ] `terraform init` completed successfully
- [ ] `terraform plan -var-file=prod.tfvars` reviewed carefully
- [ ] Plan saved: `terraform apply tfplan`
- [ ] No unexpected deletions in plan
- [ ] Plan approved and ready to apply
- [ ] `terraform apply tfplan` executed and completed
- [ ] All outputs captured and saved

## Post-Infrastructure Deployment

- [ ] Aurora cluster created and accessible
- [ ] RDS Proxy created for connection pooling
- [ ] Lambda functions created and configured
- [ ] API Gateway endpoints created
- [ ] S3 buckets created and secured
- [ ] CloudFront distribution created
- [ ] IAM roles and policies created
- [ ] CloudWatch log groups created
- [ ] Security groups configured correctly

## Application Deployment

- [ ] API code built: `cd apps/api && pnpm build`
- [ ] Lambda package created: `zip -r lambda_api.zip dist/ node_modules/`
- [ ] Lambda function updated with code
- [ ] Frontend code built: `cd apps/web && pnpm build && pnpm export`
- [ ] Static assets uploaded to S3
- [ ] CloudFront cache invalidated

## Database Setup

- [ ] Database migrations run: `pnpm db:migrate`
- [ ] Database seeded with test data: `pnpm db:seed`
- [ ] Database tables verified
- [ ] Indexes created
- [ ] Sample queries tested

## Configuration

- [ ] Environment variables set in Lambda
- [ ] Database connection string in Lambda environment
- [ ] Secrets Manager secret created
- [ ] Lambda can access Secrets Manager
- [ ] Lambda can access S3 buckets
- [ ] Lambda can access database (security group)

## Testing - Connectivity

- [ ] Aurora endpoint reachable: `aws rds describe-db-clusters`
- [ ] RDS Proxy endpoint reachable
- [ ] Lambda function has VPC access to database
- [ ] S3 bucket accessible from Lambda
- [ ] CloudFront distribution working

## Testing - Endpoints

- [ ] GET `/health` returns 200 status
- [ ] GET `/health/ready` returns 200 with database connectivity
- [ ] GET `/api/employees` returns employee list (requires auth)
- [ ] POST `/api/employees` creates new employee
- [ ] GET `/api/employees/{id}` returns single employee
- [ ] API errors handled gracefully

## Testing - Frontend

- [ ] CloudFront serving static assets
- [ ] Next.js app loads at CloudFront domain
- [ ] Frontend can call API endpoints
- [ ] Authentication works correctly
- [ ] All pages render properly
- [ ] No 404 errors for dynamic routes

## Monitoring & Alerts

- [ ] CloudWatch dashboards created
- [ ] SNS topic is subscribed
- [ ] Alarm email confirmed in inbox
- [ ] Lambda error alarms configured
- [ ] Database CPU alarms configured
- [ ] Database connection alarms configured
- [ ] API Gateway 5xx error alarms configured

## Performance

- [ ] Lambda cold starts acceptable (< 5s)
- [ ] API response times < 1s for simple queries
- [ ] Database query times < 100ms (p95)
- [ ] Authentication/authorization < 50ms
- [ ] CloudFront cache hits > 90%
- [ ] No N+1 queries in API

## Security

- [ ] Database password in Secrets Manager only
- [ ] No passwords in code or .env files
- [ ] API Gateway has throttling enabled
- [ ] CloudFront distribution locked to OAI
- [ ] S3 buckets not publicly accessible
- [ ] IAM roles follow least-privilege
- [ ] All endpoints require authentication
- [ ] Rate limiting applied
- [ ] CORS configured correctly
- [ ] Security headers enabled

## Cost Management

- [ ] Estimated monthly cost calculated
- [ ] database_max_acu set appropriately
- [ ] database_min_acu set to 0.5 for cost savings
- [ ] S3 bucket lifecycle policies created
- [ ] CloudFront cache TTL optimized
- [ ] Lambda memory right-sized
- [ ] Unused resources identified and removed

## Documentation

- [ ] Architecture diagram updated with actual IDs
- [ ] Deployment guide written with steps taken
- [ ] Runbook created for common operations
- [ ] Incident response guide created
- [ ] Scaling strategy documented
- [ ] Backup strategy documented

## Backup & Disaster Recovery

- [ ] Aurora automated backups enabled
- [ ] Backup retention set to 30 days
- [ ] Manual snapshot created as baseline
- [ ] Snapshot copied to another region
- [ ] Restore procedure tested and documented

## Production Readiness

- [ ] All resources tagged with environment
- [ ] Cost allocation tags applied
- [ ] CloudTrail enabled for audit logging
- [ ] VPC Flow Logs enabled
- [ ] Config rules for compliance
- [ ] Health checks working correctly

## Custom Domain (if applicable)

- [ ] ACM certificate requested or imported
- [ ] Certificate validation completed
- [ ] Certificate ARN added to Terraform
- [ ] `terraform apply` executed to link certificate
- [ ] DNS CNAME record created
- [ ] DNS propagation verified (24-48 hours)
- [ ] Custom domain accessible via HTTPS

## Final Verification

- [ ] All team members can access the system
- [ ] Monitoring alerts received correctly
- [ ] Backup procedures tested
- [ ] Disaster recovery plan ready
- [ ] Runbooks available to team
- [ ] On-call rotation configured
- [ ] Status page setup (if applicable)

## Go-Live

- [ ] Traffic gradually shifted to AWS (if migrating)
- [ ] Old system running in parallel initially
- [ ] All critical paths tested with real users
- [ ] Support team trained on new system
- [ ] Known issues documented
- [ ] Rollback plan ready
- [ ] 24/7 monitoring enabled

## Post-Launch (First Week)

- [ ] Daily cost monitoring
- [ ] Performance metrics within SLA
- [ ] Error rates low and acceptable
- [ ] Database scaling tests passed
- [ ] Load testing completed
- [ ] User feedback collected
- [ ] Optimization opportunities identified

## Success Criteria

✅ **Must Have:**
- [ ] System accessible 24/7
- [ ] All API endpoints working
- [ ] Authentication functioning
- [ ] Database reliable
- [ ] Errors logged properly
- [ ] Backups working
- [ ] Recovery time < 15 minutes
- [ ] Cost within budget

✅ **Should Have:**
- [ ] Performance > 99.9% uptime
- [ ] API response < 500ms (p95)
- [ ] Custom domain working
- [ ] Alarms alerting correctly
- [ ] Team trained on system
- [ ] Documentation complete

✅ **Nice to Have:**
- [ ] Multi-region setup
- [ ] Auto-scaling working
- [ ] Advanced analytics
- [ ] Performance optimizations
- [ ] Cost < 50% of initial estimate

---

**Deployment Status**: [ ] Ready for production
**Deployment Date**: _______________
**Deployed By**: _______________
**Approved By**: _______________
**Notes**: _______________________________________________
