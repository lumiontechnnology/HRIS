#!/bin/bash
# Database Backup Script
# Creates automated backups of the production PostgreSQL database

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lumion-hris}"
DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker-compose.prod.yml}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_FILE="/var/log/lumion-backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log_info "Starting database backup..."

# Generate backup filename with timestamp
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${BACKUP_DATE}.sql.gz"
BACKUP_LOCK="$BACKUP_DIR/backup_${BACKUP_DATE}.lock"

# Create lock file
touch "$BACKUP_LOCK"
trap "rm -f '$BACKUP_LOCK'" EXIT

# Perform backup
if docker-compose -f "$DOCKER_COMPOSE" exec -T postgres pg_dump \
    -U "${DB_USER:-postgres}" \
    -d "${DB_NAME:-lumion_hris}" \
    | gzip > "$BACKUP_FILE"; then
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)"
    
    # Create checksum
    sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
    log_info "Checksum created: ${BACKUP_FILE}.sha256"
    
    # Clean old backups
    log_info "Cleaning backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
    find "$BACKUP_DIR" -name "backup_*.lock" -mtime "+$RETENTION_DAYS" -delete
    
    # Count remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
    log_info "Retained $BACKUP_COUNT backups in $BACKUP_DIR"
    
else
    log_error "Backup failed"
    exit 1
fi

log_info "Backup script completed"
