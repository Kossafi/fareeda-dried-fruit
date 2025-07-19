#!/bin/bash

# Dried Fruits Inventory System - Backup Script
# This script creates backups of the database and uploaded files

set -e

# Configuration
BACKUP_DIR="./backups"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/uploads"
    mkdir -p "$BACKUP_DIR/logs"
}

# Backup database
backup_database() {
    log "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/database/db_backup_$TIMESTAMP.sql"
    
    # Check if PostgreSQL container is running
    if ! docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        error "PostgreSQL container is not running"
        return 1
    fi
    
    # Create database backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
        -U "${POSTGRES_USER:-postgres}" \
        -d "${POSTGRES_DB:-dried_fruits_db}" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --compress=9 > "$BACKUP_FILE.custom"
    
    # Also create a plain SQL backup
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
        -U "${POSTGRES_USER:-postgres}" \
        -d "${POSTGRES_DB:-dried_fruits_db}" \
        --verbose \
        --clean \
        --if-exists \
        --create > "$BACKUP_FILE"
    
    # Compress the SQL backup
    gzip "$BACKUP_FILE"
    
    if [[ -f "$BACKUP_FILE.gz" ]] && [[ -f "$BACKUP_FILE.custom" ]]; then
        success "Database backup created successfully"
        log "Files created:"
        log "  - $BACKUP_FILE.gz (SQL format)"
        log "  - $BACKUP_FILE.custom (PostgreSQL custom format)"
        return 0
    else
        error "Database backup failed"
        return 1
    fi
}

# Backup uploaded files
backup_uploads() {
    log "Creating uploads backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/uploads/uploads_backup_$TIMESTAMP.tar.gz"
    
    if [[ -d "./uploads" ]] && [[ "$(ls -A ./uploads)" ]]; then
        tar -czf "$BACKUP_FILE" -C . uploads/
        
        if [[ -f "$BACKUP_FILE" ]]; then
            success "Uploads backup created: $BACKUP_FILE"
            return 0
        else
            error "Uploads backup failed"
            return 1
        fi
    else
        warning "No uploads directory found or directory is empty"
        return 0
    fi
}

# Backup logs
backup_logs() {
    log "Creating logs backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/logs/logs_backup_$TIMESTAMP.tar.gz"
    
    if [[ -d "./logs" ]] && [[ "$(ls -A ./logs)" ]]; then
        tar -czf "$BACKUP_FILE" -C . logs/
        
        if [[ -f "$BACKUP_FILE" ]]; then
            success "Logs backup created: $BACKUP_FILE"
            return 0
        else
            error "Logs backup failed"
            return 1
        fi
    else
        warning "No logs directory found or directory is empty"
        return 0
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    
    # Clean database backups
    if [[ -d "$BACKUP_DIR/database" ]]; then
        find "$BACKUP_DIR/database" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
        find "$BACKUP_DIR/database" -name "*.custom" -mtime +$RETENTION_DAYS -delete
    fi
    
    # Clean uploads backups
    if [[ -d "$BACKUP_DIR/uploads" ]]; then
        find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    fi
    
    # Clean logs backups
    if [[ -d "$BACKUP_DIR/logs" ]]; then
        find "$BACKUP_DIR/logs" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    fi
    
    success "Old backups cleaned up"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    # Find the latest database backup
    LATEST_DB_BACKUP=$(find "$BACKUP_DIR/database" -name "*.sql.gz" -type f -exec ls -t {} \; | head -n 1)
    
    if [[ -f "$LATEST_DB_BACKUP" ]]; then
        # Test if the gzipped file is valid
        if gzip -t "$LATEST_DB_BACKUP" > /dev/null 2>&1; then
            success "Database backup integrity verified"
        else
            error "Database backup integrity check failed"
            return 1
        fi
    else
        warning "No database backup found for verification"
    fi
    
    # Find the latest uploads backup
    LATEST_UPLOADS_BACKUP=$(find "$BACKUP_DIR/uploads" -name "*.tar.gz" -type f -exec ls -t {} \; | head -n 1)
    
    if [[ -f "$LATEST_UPLOADS_BACKUP" ]]; then
        # Test if the tar.gz file is valid
        if tar -tzf "$LATEST_UPLOADS_BACKUP" > /dev/null 2>&1; then
            success "Uploads backup integrity verified"
        else
            error "Uploads backup integrity check failed"
            return 1
        fi
    else
        warning "No uploads backup found for verification"
    fi
    
    return 0
}

# Show backup statistics
show_backup_stats() {
    log "Backup Statistics:"
    
    if [[ -d "$BACKUP_DIR/database" ]]; then
        DB_COUNT=$(find "$BACKUP_DIR/database" -name "*.sql.gz" -type f | wc -l)
        DB_SIZE=$(du -sh "$BACKUP_DIR/database" 2>/dev/null | cut -f1)
        echo "  Database backups: $DB_COUNT files, $DB_SIZE total"
    fi
    
    if [[ -d "$BACKUP_DIR/uploads" ]]; then
        UPLOADS_COUNT=$(find "$BACKUP_DIR/uploads" -name "*.tar.gz" -type f | wc -l)
        UPLOADS_SIZE=$(du -sh "$BACKUP_DIR/uploads" 2>/dev/null | cut -f1)
        echo "  Uploads backups: $UPLOADS_COUNT files, $UPLOADS_SIZE total"
    fi
    
    if [[ -d "$BACKUP_DIR/logs" ]]; then
        LOGS_COUNT=$(find "$BACKUP_DIR/logs" -name "*.tar.gz" -type f | wc -l)
        LOGS_SIZE=$(du -sh "$BACKUP_DIR/logs" 2>/dev/null | cut -f1)
        echo "  Logs backups: $LOGS_COUNT files, $LOGS_SIZE total"
    fi
    
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    echo "  Total backup size: $TOTAL_SIZE"
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        error "No backup file specified"
        return 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring database from $backup_file..."
    
    # Stop the application
    docker-compose -f "$COMPOSE_FILE" stop api
    
    # Restore the database
    if [[ "$backup_file" == *.custom ]]; then
        # PostgreSQL custom format
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_restore \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-dried_fruits_db}" \
            --verbose \
            --clean \
            --if-exists < "$backup_file"
    elif [[ "$backup_file" == *.sql.gz ]]; then
        # Gzipped SQL format
        gunzip -c "$backup_file" | docker-compose -f "$COMPOSE_FILE" exec -T postgres psql \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-dried_fruits_db}"
    else
        error "Unsupported backup format: $backup_file"
        return 1
    fi
    
    # Restart the application
    docker-compose -f "$COMPOSE_FILE" start api
    
    success "Database restored successfully"
}

# Main function
main() {
    log "🔄 Starting Dried Fruits Inventory System Backup"
    log "=============================================="
    
    # Parse arguments
    SKIP_DATABASE=false
    SKIP_UPLOADS=false
    SKIP_LOGS=false
    SKIP_CLEANUP=false
    RESTORE_FILE=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-database)
                SKIP_DATABASE=true
                shift
                ;;
            --skip-uploads)
                SKIP_UPLOADS=true
                shift
                ;;
            --skip-logs)
                SKIP_LOGS=true
                shift
                ;;
            --skip-cleanup)
                SKIP_CLEANUP=true
                shift
                ;;
            --restore)
                RESTORE_FILE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-database    Skip database backup"
                echo "  --skip-uploads     Skip uploads backup"
                echo "  --skip-logs        Skip logs backup"
                echo "  --skip-cleanup     Skip cleanup of old backups"
                echo "  --restore FILE     Restore database from backup file"
                echo "  --help             Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Handle restore operation
    if [[ -n "$RESTORE_FILE" ]]; then
        restore_database "$RESTORE_FILE"
        exit $?
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Create backups
    BACKUP_SUCCESS=true
    
    if [[ "$SKIP_DATABASE" != true ]]; then
        if ! backup_database; then
            BACKUP_SUCCESS=false
        fi
    fi
    
    if [[ "$SKIP_UPLOADS" != true ]]; then
        if ! backup_uploads; then
            BACKUP_SUCCESS=false
        fi
    fi
    
    if [[ "$SKIP_LOGS" != true ]]; then
        if ! backup_logs; then
            BACKUP_SUCCESS=false
        fi
    fi
    
    # Verify backups
    if ! verify_backup; then
        BACKUP_SUCCESS=false
    fi
    
    # Cleanup old backups
    if [[ "$SKIP_CLEANUP" != true ]]; then
        cleanup_old_backups
    fi
    
    # Show statistics
    show_backup_stats
    
    if [[ "$BACKUP_SUCCESS" == true ]]; then
        success "🎉 Backup completed successfully!"
    else
        error "❌ Backup completed with errors!"
        exit 1
    fi
    
    log "=============================================="
}

# Run main function with all arguments
main "$@"