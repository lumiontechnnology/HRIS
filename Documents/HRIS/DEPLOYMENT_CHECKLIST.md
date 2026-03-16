# Production Deployment Checklist

## Pre-Deployment

- [ ] All tests passing (`pnpm test`)
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Code review completed
- [ ] All environment variables configured in `.env.production`
- [ ] Database migrations reviewed and tested
- [ ] Backup of current production database taken
- [ ] Disaster recovery plan reviewed
- [ ] Team notified of deployment window

## Deployment Steps

- [ ] Run production readiness checklist: `bash scripts/production-checklist.sh`
- [ ] Build Docker images: `docker-compose -f docker-compose.prod.yml build`
- [ ] Push images to registry: `docker push ghcr.io/org/lumion-hris/api:latest`
- [ ] Pull new images on production: `docker-compose -f docker-compose.prod.yml pull`
- [ ] Run database migrations: `docker-compose -f docker-compose.prod.yml exec api pnpm migrate`
- [ ] Start services: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify health checks passing:
  - [ ] API: `curl https://api.example.com/health`
  - [ ] Web: `curl https://app.example.com/health`
- [ ] Monitor logs: `docker-compose -f docker-compose.prod.yml logs -f`

## Post-Deployment Verification

- [ ] Frontend loads and responds
- [ ] Login functionality working
- [ ] API endpoints responding correctly
- [ ] Database queries performing well
- [ ] Error tracking (Sentry) reporting correctly
- [ ] Analytics collecting data
- [ ] SSL certificates valid and not expiring soon
- [ ] Backup completed successfully
- [ ] Monitoring dashboards showing healthy metrics

## Post-Deployment Steps

- [ ] Notify stakeholders of successful deployment
- [ ] Document any configuration changes
- [ ] Monitor application for 24 hours
- [ ] Check error logs for unexpected issues
- [ ] Performance metrics within acceptable range
- [ ] User reports of any issues addressed

## Rollback Plan (if needed)

- [ ] Revert code: `git revert <commit-hash>`
- [ ] Rebuild images: `docker-compose -f docker-compose.prod.yml build`
- [ ] Stop current services: `docker-compose -f docker-compose.prod.yml down`
- [ ] Restore database: `bash scripts/restore.sh <backup-file>`
- [ ] Start rolled-back services: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify functionality restored
- [ ] Notify stakeholders

## Performance Checklist

- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms (p95)
- [ ] Database query time < 100ms (p95)
- [ ] No 5xx errors in logs
- [ ] Memory usage < 80% of allocated
- [ ] CPU usage < 75%
- [ ] Disk usage < 80%

## Security Checklist

- [ ] All secrets rotated before deployment
- [ ] SSL/TLS certificates valid for at least 30 days
- [ ] Security headers properly configured
- [ ] Rate limiting active
- [ ] DDoS protection enabled
- [ ] WAF rules updated
- [ ] No debug mode enabled in production
- [ ] Logging sensitive data (passwords, tokens) disabled

## Monitoring Checklist

- [ ] Application monitoring active
- [ ] Error tracking (Sentry) enabled
- [ ] Performance monitoring active
- [ ] Uptime monitoring configured
- [ ] Alert notifications tested
- [ ] On-call rotation updated
- [ ] Status page updated

## Maintenance Checklist

- [ ] Backup schedule verified
- [ ] Database maintenance window scheduled
- [ ] Log retention policy configured
- [ ] Cache cleanup scheduled
- [ ] SSL certificate renewal scheduled
- [ ] Docker image cleanup scheduled
- [ ] Database optimization scheduled

## Post-Deployment (Week 1)

- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check performance metrics
- [ ] Verify all features working correctly
- [ ] Update documentation
- [ ] Plan follow-up improvements
- [ ] Schedule post-mortem if issues occurred

---

**Deployment Date**: ____________
**Deployed By**: ____________
**Approval**: ____________
**Notes**: ________________________________________
