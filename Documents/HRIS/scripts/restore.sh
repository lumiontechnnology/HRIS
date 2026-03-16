#!/bin/bash
# Database Restore Script
# Restores PostgreSQL database from backup file

set -e

# Configuration
DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker-compose.prod.yml}"
BACKUP_FILE="${1:?Usage: $0 <backup-file>}"
LOG_FILE="/var/log/lumion-restore.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Validate checksum if available
if [ -f "${BACKUP_FILE}.sha256" ]; then
    log_info "Verifying backup integrity..."
    cd "$(dirname "$BACKUP_FILE")" || exit 1
    if ! sha256sum -c "$(basename "${BACKUP_FILE}").sha256"; then
        log_error "Backup checksum verification failed"
        exit 1
    fi
    log_success "Backup integrity verified"
    cd - > /dev/null || exit 1
fi

# Confirm restore
log_warn "This will restore database from: $BACKUP_FILE"
read -r -p "Are you sure? Type 'yes' to continue: " -t 30
if [ "$REPLY" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

log_info "Starting database restore..."

# Stop API to prevent connections
log_info "Stopping API service..."
docker-compose -f "$DOCKER_COMPOSE" stop api web || true

# Restore database
if [ "${BACKUP_FILE: -3}" = ".gz" ]; then
    log_info "Decompressing and restoring backup..."
    cat "$BACKUP_FILE" | gunzip | \
        docker-compose -f "$DOCKER_COMPOSE" exec -T postgres psql \
        -U "${DB_USER:-postgres}" \
        -d "${DB_NAME:-lumion_hris}"
else
    log_info "Restoring backup..."
    docker-compose -f "$DOCKER_COMPOSE" exec -T postgres psql \
        -U "${DB_USER:-postgres}" \
        -d "${DB_NAME:-lumion_hris}" \
        < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    log_success "Restore completed successfully"
    
    # Restart services
    log_info "Restarting services..."
    docker-compose -f "$DOCKER_COMPOSE" up -d api web
    sleep 5
    
    # Verify restore
    if docker-compose -f "$DOCKER_COMPOSE" exec -T api curl -f http://localhost:3001/health > /dev/null; then
        log_success "Services restored and healthy"
    else
        log_warn "Services may still be starting up"
    fi
else
    log_error "Restore failed"
    log_warn "Attempting to restart services..."
    docker-compose -f "$DOCKER_COMPOSE" up -d api web
    exit 1
fi

log_info "Restore script completed"
