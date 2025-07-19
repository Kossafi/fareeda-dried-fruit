# 🚀 Deployment Guide

This guide covers deploying the Dried Fruits Inventory Management System to production.

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD
- **CPU**: 2+ cores
- **Network**: Stable internet connection

### Software Dependencies
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: Latest version
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)

## 🔧 Pre-Deployment Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git htop nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Security Configuration

```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Configure fail2ban (optional)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install -y certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to project directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/key.pem
sudo chown $USER:$USER ./nginx/ssl/*
```

#### Option B: Self-Signed (Development)
```bash
# Generate self-signed certificate
./scripts/deploy.sh --generate-ssl
```

## 🚀 Deployment Process

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/dried-fruits-inventory.git
cd dried-fruits-inventory
```

### 2. Environment Configuration

```bash
# Copy production environment file
cp .env.prod.example .env.prod

# Edit configuration (replace with your values)
nano .env.prod
```

**Important Environment Variables:**
```bash
# Database
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_redis_password

# Application
SECRET_KEY=your_32_character_secret_key
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring
GRAFANA_PASSWORD=your_grafana_password
```

### 3. Deploy Application

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy with all options
./scripts/deploy.sh --generate-ssl --with-monitoring

# Or deploy with custom options
./scripts/deploy.sh --no-backup --with-monitoring
```

### 4. Verify Deployment

```bash
# Check services status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Test API health
curl -f https://yourdomain.com/health
```

## 🔍 Monitoring & Logging

### Access Monitoring Dashboards

- **API Documentation**: `https://yourdomain.com/docs`
- **Health Check**: `https://yourdomain.com/health`
- **Grafana Dashboard**: `http://yourdomain.com:3000`
- **Prometheus Metrics**: `http://yourdomain.com:9090`

### Log Files

```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f api

# Nginx access logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# Database logs
docker-compose -f docker-compose.prod.yml logs -f postgres
```

## 💾 Backup & Restore

### Automated Backups

```bash
# Create backup
./scripts/backup.sh

# Create backup with custom options
./scripts/backup.sh --skip-logs --skip-cleanup

# Schedule automated backups (crontab)
crontab -e
# Add: 0 2 * * * /path/to/project/scripts/backup.sh
```

### Manual Backup

```bash
# Database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres dried_fruits_db > backup.sql

# Files backup
tar -czf uploads-backup.tar.gz uploads/
```

### Restore from Backup

```bash
# Restore database
./scripts/backup.sh --restore ./backups/database/db_backup_20240101_120000.sql.gz

# Restore files
tar -xzf uploads-backup.tar.gz
```

## 🔄 Updates & Maintenance

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and deploy
./scripts/deploy.sh

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Database Migration

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec api python -c "
from app.core.database import engine, Base
Base.metadata.create_all(bind=engine)
"
```

### Scale Services

```bash
# Scale API service
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Scale with load balancer
# Edit nginx.conf to add multiple upstream servers
```

## 🛡️ Security Best Practices

### 1. Environment Security

```bash
# Secure environment file
chmod 600 .env.prod

# Use Docker secrets for sensitive data
docker secret create postgres_password /path/to/password/file
```

### 2. Network Security

```bash
# Configure internal network
# Services communicate via internal Docker network
# Only nginx exposes ports 80/443 to the outside
```

### 3. Regular Security Updates

```bash
# Update base images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Update system packages
sudo apt update && sudo apt upgrade -y
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Check disk space
df -h
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connection string
echo $DATABASE_URL

# Reset database connection
docker-compose -f docker-compose.prod.yml restart postgres
```

#### 3. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
```

#### 4. Performance Issues
```bash
# Check resource usage
docker stats

# Check slow queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Optimize database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "VACUUM ANALYZE;"
```

### Log Analysis

```bash
# Follow all logs
docker-compose -f docker-compose.prod.yml logs -f

# Filter specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Check error logs
docker-compose -f docker-compose.prod.yml logs api | grep ERROR
```

## 📊 Performance Tuning

### Database Optimization

```bash
# Optimize PostgreSQL settings
# Edit postgresql.conf in container or use custom config
```

### Application Optimization

```bash
# Adjust worker processes
# Edit docker-compose.prod.yml
# environment:
#   - GUNICORN_WORKERS=4
```

### Nginx Optimization

```bash
# Tune nginx configuration
# Edit nginx/nginx.conf
# - worker_processes auto
# - worker_connections 1024
# - keepalive_timeout 65
```

## 🔐 Backup Strategy

### Production Backup Schedule

```bash
# Daily database backup at 2 AM
0 2 * * * /path/to/project/scripts/backup.sh

# Weekly full backup (database + files)
0 3 * * 0 /path/to/project/scripts/backup.sh --skip-cleanup

# Monthly archive
0 4 1 * * /path/to/project/scripts/backup.sh && tar -czf monthly-backup-$(date +%Y%m).tar.gz backups/
```

### Backup Retention

- **Daily backups**: 30 days
- **Weekly backups**: 12 weeks
- **Monthly backups**: 12 months
- **Yearly archives**: 5 years

## 📞 Support & Maintenance

### Health Checks

```bash
# API health check
curl -f https://yourdomain.com/health

# Database health check
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Redis health check
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Monitoring Alerts

Set up alerts for:
- High CPU/Memory usage
- Disk space low
- Database connection failures
- API response time > 5 seconds
- SSL certificate expiration

### Maintenance Windows

Schedule regular maintenance:
- **Weekly**: Log rotation and cleanup
- **Monthly**: System updates and security patches
- **Quarterly**: Full backup testing and disaster recovery drills

---

For additional support, consult the main [README.md](README.md) or open an issue in the repository.