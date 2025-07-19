#!/bin/bash

# Dried Fruits Inventory System - Production Deployment Script
# This script handles production deployment with zero-downtime

set -e

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file $ENV_FILE not found. Please create it from .env.example"
        exit 1
    fi
    
    # Check if SSL certificates exist
    if [[ ! -f "./nginx/ssl/cert.pem" ]] || [[ ! -f "./nginx/ssl/key.pem" ]]; then
        warning "SSL certificates not found. HTTPS will not work properly."
        warning "Please add certificates to ./nginx/ssl/ directory"
    fi
    
    success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "./logs"
    mkdir -p "./uploads"
    mkdir -p "./nginx/ssl"
    mkdir -p "./static"
    mkdir -p "./monitoring"
    
    success "Directories created"
}

# Backup database
backup_database() {
    log "Creating database backup..."
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q postgres; then
        BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
        
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
            -U "${POSTGRES_USER:-postgres}" \
            -d "${POSTGRES_DB:-dried_fruits_db}" > "$BACKUP_FILE"
        
        if [[ $? -eq 0 ]]; then
            success "Database backup created: $BACKUP_FILE"
        else
            error "Database backup failed"
            exit 1
        fi
    else
        warning "PostgreSQL container not running, skipping database backup"
    fi
}

# Build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Build application image
    log "Building application image..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build api
    
    # Start services
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        success "Services are running"
    else
        error "Some services failed to start"
        docker-compose -f "$COMPOSE_FILE" logs
        exit 1
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check API health
    for i in {1..10}; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            success "API health check passed"
            return 0
        fi
        warning "Health check attempt $i failed, retrying in 10 seconds..."
        sleep 10
    done
    
    error "Health check failed after 10 attempts"
    return 1
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    docker-compose -f "$COMPOSE_FILE" exec api python -c "
from app.core.database import engine, Base
Base.metadata.create_all(bind=engine)
print('Database tables created successfully')
"
    
    if [[ $? -eq 0 ]]; then
        success "Database migrations completed"
    else
        error "Database migrations failed"
        exit 1
    fi
}

# Setup monitoring (optional)
setup_monitoring() {
    if [[ "$1" == "--with-monitoring" ]]; then
        log "Setting up monitoring..."
        
        # Create monitoring configuration
        cat > ./monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: /metrics
    scrape_interval: 10s
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
EOF
        
        # Start monitoring services
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile monitoring up -d
        
        success "Monitoring setup completed"
        log "Grafana will be available at http://localhost:3000"
        log "Prometheus will be available at http://localhost:9090"
    fi
}

# Generate SSL certificates (self-signed for development)
generate_ssl_certs() {
    if [[ "$1" == "--generate-ssl" ]]; then
        log "Generating self-signed SSL certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ./nginx/ssl/key.pem \
            -out ./nginx/ssl/cert.pem \
            -subj "/C=TH/ST=Bangkok/L=Bangkok/O=Dried Fruits/CN=localhost"
        
        success "SSL certificates generated"
        warning "These are self-signed certificates for development only"
    fi
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old images and containers..."
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this in production)
    if [[ "$1" == "--cleanup-volumes" ]]; then
        warning "Cleaning up unused volumes..."
        docker volume prune -f
    fi
    
    success "Cleanup completed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    log "Service URLs:"
    echo "  API Documentation: https://localhost/docs"
    echo "  Health Check: https://localhost/health"
    echo "  API Base: https://localhost/api/v1"
    
    if docker-compose -f "$COMPOSE_FILE" --profile monitoring ps | grep -q grafana; then
        echo "  Grafana: http://localhost:3000"
        echo "  Prometheus: http://localhost:9090"
    fi
}

# Main function
main() {
    log "🚀 Starting Dried Fruits Inventory System Deployment"
    log "=================================================="
    
    # Parse arguments
    BACKUP_DB=true
    GENERATE_SSL=false
    WITH_MONITORING=false
    CLEANUP_VOLUMES=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-backup)
                BACKUP_DB=false
                shift
                ;;
            --generate-ssl)
                GENERATE_SSL=true
                shift
                ;;
            --with-monitoring)
                WITH_MONITORING=true
                shift
                ;;
            --cleanup-volumes)
                CLEANUP_VOLUMES=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --no-backup        Skip database backup"
                echo "  --generate-ssl     Generate self-signed SSL certificates"
                echo "  --with-monitoring  Deploy with monitoring stack"
                echo "  --cleanup-volumes  Clean up unused volumes (dangerous)"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_root
    check_prerequisites
    create_directories
    
    if [[ "$GENERATE_SSL" == true ]]; then
        generate_ssl_certs --generate-ssl
    fi
    
    if [[ "$BACKUP_DB" == true ]]; then
        backup_database
    fi
    
    deploy
    run_migrations
    
    if [[ "$WITH_MONITORING" == true ]]; then
        setup_monitoring --with-monitoring
    fi
    
    if ! health_check; then
        error "Deployment failed health check"
        exit 1
    fi
    
    if [[ "$CLEANUP_VOLUMES" == true ]]; then
        cleanup --cleanup-volumes
    else
        cleanup
    fi
    
    show_status
    
    success "🎉 Deployment completed successfully!"
    log "=================================================="
}

# Run main function with all arguments
main "$@"