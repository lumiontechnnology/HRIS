# Lumion HRIS - Production Deployment Guide

## Overview

This guide covers deploying Lumion HRIS to production with Docker, CI/CD, and monitoring.

## Prerequisites

- Docker & Docker Compose
- GitHub Actions (for CI/CD)
- PostgreSQL 15+
- Redis 7+
- Server with 2+ CPU cores and 4GB+ RAM
- Domain name with SSL certificate

## Local Development with Docker

### Start Development Stack

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- API (port 3001)
- Web (port 3000)

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
```

### Database Migrations

```bash
# Run migrations
docker-compose exec api pnpm migrate

# Seed sample data
docker-compose exec api pnpm seed
```

## Production Deployment

### 1. Prepare Server

```bash
# SSH into server
ssh user@your-server.com

# Create application directory
sudo mkdir -p /var/www/lumion-hris
cd /var/www/lumion-hris

# Clone repository
git clone https://github.com/your-org/lumion-hris.git .

# Create .env.production with secrets
nano .env.production

# Set permissions
sudo chown -R user:user /var/www/lumion-hris
```

### 2. Configure Environment Variables

Copy `.env.production` template and fill in actual values:

```bash
cp .env.production.example .env.production
```

**Critical secrets:**
```
DATABASE_URL=postgresql://user:password@db-host:5432/db
REDIS_URL=redis://:password@redis-host:6379
JWT_SECRET=<generate-strong-secret>
NEXTAUTH_SECRET=<generate-strong-secret>
```

Generate secure secrets:
```bash
openssl rand -base64 32
```

### 3. Build Docker Images

```bash
# Build for production
docker-compose -f docker-compose.prod.yml build

# Or pull from registry
docker pull ghcr.io/your-org/lumion-hris/api:latest
docker pull ghcr.io/your-org/lumion-hris/web:latest
```

### 4. Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 5. Run Database Migrations

```bash
docker-compose -f docker-compose.prod.yml exec api \
  pnpm exec prisma migrate deploy
```

### 6. Verify Deployment

```bash
# Check health
curl http://localhost:3001/health
curl http://localhost:3000/health

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check running containers
docker ps
```

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. Test (on PR)
- Type checking
- Linting
- Unit tests
- Build validation

#### 2. Build (on main push)
- Build Docker images
- Push to container registry

#### 3. Deploy (on main push)
- SSH to production server
- Pull latest code
- Run migrations
- Restart services
- Health checks
- Slack notification

### GitHub Secrets Required

```
DEPLOY_HOST          # Production server IP/domain
DEPLOY_USER          # SSH user
DEPLOY_KEY           # SSH private key
DATABASE_URL         # Production database
JWT_SECRET           # API JWT secret
NEXTAUTH_SECRET      # NextAuth secret
SLACK_WEBHOOK        # For notifications
```

## Monitoring & Logging

### Health Checks

API provides three health endpoints:

```
GET /health         # Basic health
GET /health/ready   # Readiness (checks database)
GET /health/live    # Liveness check
```

### Container Logs

```bash
# Follow logs
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api
```

### Performance Monitoring

- **Frontend**: Vercel Analytics (automatically integrated)
- **Backend**: Structured logging with Pino
- **Database**: Query performance monitoring
- **Errors**: Sentry integration can be enabled

### Setting Up Error Tracking

Create Sentry project and add DSN:

```bash
# .env.production
SENTRY_DSN=https://key@sentry.io/project-id
```

## Backup Strategy

### Database Backups

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U lumion_admin lumion_hris > backup-$(date +%Y%m%d).sql

# Automated backup (cron job)
0 2 * * * /var/www/lumion-hris/backup.sh
```

Backup script: `backup.sh`
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/lumion-hris/backups"
mkdir -p $BACKUP_DIR

docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U lumion_admin lumion_hris | \
  gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

## Updating Production

```bash
# 1. Pull latest changes
git pull origin main

# 2. Load environment
export $(cat .env.production | xargs)

# 3. Pull new images
docker-compose -f docker-compose.prod.yml pull

# 4. Run migrations (if any)
docker-compose -f docker-compose.prod.yml exec -T api \
  pnpm exec prisma migrate deploy

# 5. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 6. Verify health
docker-compose -f docker-compose.prod.yml exec api \
  curl http://localhost:3001/health
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Verify environment variables
cat .env.production

# Check database connectivity
docker-compose -f docker-compose.prod.yml exec api \
  node -e "console.log(process.env.DATABASE_URL)"
```

### Database connection issues
```bash
# Test connection
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U lumion_admin -d lumion_hris -c "SELECT 1"

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### High memory usage
```bash
# Check container metrics
docker stats

# Increase limits in docker-compose.prod.yml
# Add under service:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

## Security Considerations

- ✅ Keep secrets in `.env.production` (not in git)
- ✅ Use strong, unique passwords for all services
- ✅ Enable PostgreSQL SSL in production
- ✅ Use Redis password authentication
- ✅ Configure CORS properly
- ✅ Enable HTTPS for all traffic
- ✅ Set secure cookie flags
- ✅ Regular security updates: `docker-compose pull`

## Scaling Considerations

For high-traffic deployments:

1. **Database**: Use RDS or managed PostgreSQL
2. **Redis**: Use ElastiCache or similar
3. **Load Balancing**: Use Nginx or HAProxy
4. **Container Orchestration**: Consider Kubernetes
5. **CDN**: Cache static assets with CloudFront/Cloudflare
6. **API Scaling**: Run multiple API instances behind load balancer

## Support & Maintenance

- Monitor application logs daily
- Review error tracking dashboard (Sentry)
- Update dependencies monthly: `pnpm update`
- Test backups quarterly
- Plan maintenance windows for updates
- Keep Docker images updated: `docker pull`

## Quick Reference Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Execute command in container
docker-compose -f docker-compose.prod.yml exec api pnpm build

# Access database CLI
docker-compose -f docker-compose.prod.yml exec postgres psql -U lumion_admin -d lumion_hris

# Access Redis CLI
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# View database migrations
docker-compose -f docker-compose.prod.yml exec api pnpm exec prisma migrate status

# Create backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U lumion_admin lumion_hris > backup.sql
```
