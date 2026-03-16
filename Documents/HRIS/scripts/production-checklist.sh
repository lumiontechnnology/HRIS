#!/bin/bash
# Production Readiness Checklist
# Run this before going live

set -e

echo "🚀 Lumion HRIS - Production Readiness Checklist"
echo "=================================================="
echo ""

FAILED=0

# Function to print result
check_result() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
    else
        echo "❌ $2"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Environment Configuration
echo "1. Environment Configuration"
echo "---"
[ -f ".env.production" ] || { echo "❌ .env.production file not found"; FAILED=$((FAILED + 1)); }

# Check required secrets
grep -q "^DATABASE_URL=" .env.production && check_result 0 "DATABASE_URL configured" || check_result 1 "DATABASE_URL missing"
grep -q "^REDIS_URL=" .env.production && check_result 0 "REDIS_URL configured" || check_result 1 "REDIS_URL missing"
grep -q "^JWT_SECRET=" .env.production && check_result 0 "JWT_SECRET configured" || check_result 1 "JWT_SECRET missing"
grep -q "^NEXTAUTH_SECRET=" .env.production && check_result 0 "NEXTAUTH_SECRET configured" || check_result 1 "NEXTAUTH_SECRET missing"

echo ""

# 2. Docker Configuration
echo "2. Docker Configuration"
echo "---"
command -v docker &> /dev/null && check_result 0 "Docker installed" || check_result 1 "Docker not installed"
command -v docker-compose &> /dev/null && check_result 0 "Docker Compose installed" || check_result 1 "Docker Compose not installed"
[ -f "docker-compose.prod.yml" ] && check_result 0 "docker-compose.prod.yml exists" || check_result 1 "docker-compose.prod.yml missing"

echo ""

# 3. Database
echo "3. Database Configuration"
echo "---"
[ -d "packages/database" ] && check_result 0 "Database package exists" || check_result 1 "Database package missing"
[ -f "packages/database/prisma/schema.prisma" ] && check_result 0 "Prisma schema exists" || check_result 1 "Prisma schema missing"
[ -d "packages/database/prisma/migrations" ] && check_result 0 "Migrations directory exists" || check_result 1 "Migrations directory missing"

echo ""

# 4. SSL/TLS
echo "4. SSL/TLS Configuration"
echo "---"
[ -f "/etc/letsencrypt/live/app.example.com/fullchain.pem" ] && \
    check_result 0 "SSL certificate found" || \
    echo "⚠️  SSL certificate not found (configure for production)"

echo ""

# 5. Source Code
echo "5. Source Code Quality"
echo "---"
[ -f "package.json" ] && check_result 0 "Root package.json exists" || check_result 1 "Root package.json missing"
[ -f "pnpm-lock.yaml" ] && check_result 0 "pnpm-lock.yaml exists" || check_result 1 "pnpm-lock.yaml missing"
[ -f ".gitignore" ] && check_result 0 ".gitignore exists" || check_result 1 ".gitignore missing"
[ -f "tsconfig.json" ] && check_result 0 "tsconfig.json exists" || check_result 1 "tsconfig.json missing"

echo ""

# 6. Documentation
echo "6. Documentation"
echo "---"
[ -f "README.md" ] && check_result 0 "README.md exists" || check_result 1 "README.md missing"
[ -f "DEPLOYMENT.md" ] && check_result 0 "DEPLOYMENT.md exists" || check_result 1 "DEPLOYMENT.md missing"
[ -f "CONTRIBUTING.md" ] && check_result 0 "CONTRIBUTING.md exists" || check_result 1 "CONTRIBUTING.md missing"

echo ""

# 7. CI/CD
echo "7. CI/CD Pipeline"
echo "---"
[ -d ".github/workflows" ] && check_result 0 "GitHub Actions directory exists" || check_result 1 "GitHub Actions directory missing"
[ -f ".github/workflows/test.yml" ] && check_result 0 "Test workflow exists" || check_result 1 "Test workflow missing"
[ -f ".github/workflows/build.yml" ] && check_result 0 "Build workflow exists" || check_result 1 "Build workflow missing"
[ -f ".github/workflows/deploy.yml" ] && check_result 0 "Deploy workflow exists" || check_result 1 "Deploy workflow missing"

echo ""

# 8. Security
echo "8. Security Checks"
echo "---"
grep -r "TODO\|FIXME\|HACK" apps/ --include="*.ts" --include="*.tsx" | wc -l | awk '{
    if ($1 > 0) print "⚠️  Found " $1 " TODO/FIXME/HACK comments - review before deployment"
    else print "✅ No TODO/FIXME/HACK comments found"
}'

! grep -r "console\\.log\|debugger" apps/api/src --include="*.ts" > /dev/null 2>&1 && \
    check_result 0 "No console.log in API" || \
    check_result 1 "Found console.log in API - remove for production"

echo ""

# 9. Performance
echo "9. Performance Configuration"
echo "---"
[ -f "apps/web/next.config.js" ] && check_result 0 "Next.js config exists" || check_result 1 "Next.js config missing"
grep -q "NEXT_PUBLIC_API_URL" .env.production && check_result 0 "API URL configured" || check_result 1 "API URL not configured"

echo ""

# 10. Monitoring
echo "10. Monitoring & Logging"
echo "---"
[ -f "apps/web/src/lib/analytics.ts" ] && check_result 0 "Analytics integration exists" || check_result 1 "Analytics integration missing"
[ -f "packages/api/src/utils/logger.ts" ] && check_result 0 "Logger configuration exists" || check_result 1 "Logger configuration missing"

echo ""

# Summary
echo "=================================================="
echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All checks passed! Ready for production deployment."
    exit 0
else
    echo "⚠️  $FAILED check(s) failed. Please address before deployment."
    exit 1
fi
