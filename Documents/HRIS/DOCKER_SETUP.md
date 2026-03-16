# Docker Setup - Lumion HRIS

## ✅ Status: Running

Infrastructure containers are now running and healthy.

### Running Containers

```
NAME                  STATUS                    PORTS
lumion-postgres-dev   Up (healthy)              0.0.0.0:5432->5432/tcp
lumion-redis-dev      Up (healthy)              0.0.0.0:6379->6379/tcp
```

## What's Running

### PostgreSQL 15
- **Container**: lumion-postgres-dev
- **Host Port**: 5432
- **Database**: lumion_hris
- **Connection**: `postgresql://postgres:postgres@localhost:5432/lumion_hris`
- **Status**: ✅ Healthy & Ready

### Redis 7
- **Container**: lumion-redis-dev
- **Host Port**: 6379
- **Connection**: `redis://localhost:6379`
- **Status**: ✅ Healthy & Ready

## Docker Compose Configuration

### Services
1. **postgres** - PostgreSQL 15 Alpine
   - Persistent data volume
   - Health checks enabled
   - Auto-restart on failure

2. **redis** - Redis 7 Alpine
   - In-memory cache
   - Health checks enabled
   - Auto-restart on failure

### Network
- Custom bridge network: `lumion-network`
- Services communicate via service names (postgres, redis)

### Volumes
- `postgres_data` - Persistent database storage
- `/app` - Application directory (for development)
- `node_modules` exclusion - Prevents host/container conflicts

## Common Commands

### View Containers
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs postgres
docker-compose logs redis

# Follow logs (real-time)
docker-compose logs -f
```

### Connect to Database
```bash
docker-compose exec postgres psql -U postgres -d lumion_hris
```

### Test Redis Connection
```bash
docker-compose exec redis redis-cli ping
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart postgres
```

### Stop Services
```bash
docker-compose down
```

### Full Reset (Remove Data)
```bash
docker-compose down -v
```

## Environment Variables

Database credentials are configured with defaults:
- `DB_USER`: postgres
- `DB_PASSWORD`: postgres
- `DB_NAME`: lumion_hris

For production, override in `.env.production`:
```bash
DB_USER=prod_user
DB_PASSWORD=secure_password_here
DB_NAME=lumion_hris_prod
```

## Next Steps

### Option 1: Run Application Services
To add API and Web servers to Docker:

```bash
# Build and start API & Web containers
docker-compose up -d api web

# View all containers
docker-compose ps

# View application logs
docker-compose logs -f api web
```

### Option 2: Run Locally with Docker Backend
Install dependencies and run dev servers locally:

```bash
# Install root dependencies
pnpm install

# Run dev servers (connects to Docker database/redis)
pnpm dev
```

**Frontend**: http://localhost:3000  
**API**: http://localhost:3001  
**Database**: localhost:5432  
**Cache**: localhost:6379  

## Troubleshooting

### Postgres won't start
```bash
# Check logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Port already in use
```bash
# Find process using port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Kill process or use different port in docker-compose.yml
```

### Health checks failing
```bash
# Wait longer for container startup
sleep 10
docker-compose ps

# Check detailed logs
docker-compose logs postgres
```

### Can't connect from host
```bash
# Verify network
docker network inspect lumion-network

# Test connection
psql postgresql://postgres:postgres@localhost:5432/lumion_hris
redis-cli -h localhost ping
```

## Docker Architecture

```
┌─────────────────────────────────────────┐
│         Host Machine                    │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │   Docker Compose Network         │   │
│  │   (lumion-network)               │   │
│  │                                  │   │
│  │  ┌──────────────┐  ┌─────────┐  │   │
│  │  │  PostgreSQL  │  │  Redis  │  │   │
│  │  │    (5432)    │  │ (6379)  │  │   │
│  │  └──────────────┘  └─────────┘  │   │
│  │                                  │   │
│  │  ┌──────────────┐  ┌─────────┐  │   │
│  │  │  API Server  │  │   Web   │  │   │
│  │  │   (3001)     │  │(3000)   │  │   │
│  │  └──────────────┘  └─────────┘  │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

## Performance Notes

- **PostgreSQL**: Configured with Alpine Linux (lightweight)
- **Redis**: Configured with Alpine Linux (lightweight)
- **Storage**: Persistent volumes for data safety
- **Health Checks**: 10s interval, 5 retries for stability
- **Memory**: Minimal footprint suitable for development

## Security Notes (Development Only)

⚠️ **WARNING**: Default credentials (postgres:postgres) are for development only.

For production:
1. Use strong passwords
2. Configure SSL/TLS
3. Enable authentication
4. Use Docker secrets
5. Restrict network access
6. Enable firewall rules

See [.env.production](.env.production) for production configuration template.

---

**Docker Setup Complete** ✅

Infrastructure is ready for application deployment. See next section for running API and Web servers.
