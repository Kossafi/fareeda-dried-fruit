# 🔧 Operations Guide

This guide covers day-to-day operations, monitoring, and maintenance of the Dried Fruits Inventory Management System.

## 📊 System Monitoring

### Health Check Endpoints

```bash
# API Health Check
curl -f https://yourdomain.com/health

# Database Health Check
curl -f https://yourdomain.com/api/v1/health/database

# Redis Health Check
curl -f https://yourdomain.com/api/v1/health/redis
```

### Key Metrics to Monitor

#### System Metrics
- **CPU Usage**: < 70%
- **Memory Usage**: < 80%
- **Disk Usage**: < 85%
- **Network I/O**: Monitor for spikes

#### Application Metrics
- **Response Time**: < 500ms (95th percentile)
- **Error Rate**: < 1%
- **Request Rate**: Monitor for unusual patterns
- **Database Connections**: Monitor pool usage

#### Business Metrics
- **Daily Transactions**: Track volume trends
- **Inventory Levels**: Monitor stock alerts
- **Customer Activity**: Track registration/orders
- **System Uptime**: Target 99.9%

## 📈 Performance Monitoring

### Grafana Dashboards

Access Grafana at `http://yourdomain.com:3000`

**Key Dashboards:**
1. **System Overview** - CPU, Memory, Disk, Network
2. **Application Performance** - Response times, error rates
3. **Database Performance** - Query performance, connections
4. **Business KPIs** - Sales, inventory, customers

### Prometheus Metrics

Access Prometheus at `http://yourdomain.com:9090`

**Custom Metrics:**
- `api_requests_total` - Total API requests
- `api_request_duration_seconds` - Request duration
- `database_connections_active` - Active DB connections
- `inventory_low_stock_alerts` - Low stock alerts count

## 🚨 Alert Configuration

### Critical Alerts

```yaml
# High CPU Usage
- alert: HighCPUUsage
  expr: (100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High CPU usage detected"

# High Memory Usage
- alert: HighMemoryUsage
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"

# Database Connection Issues
- alert: DatabaseConnectionFailed
  expr: up{job="postgres"} == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Database connection failed"

# API Response Time
- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "API response time is high"
```

## 💾 Backup Operations

### Daily Backup Routine

```bash
# Automated daily backup (scheduled via cron)
0 2 * * * /path/to/project/scripts/backup.sh

# Manual backup
./scripts/backup.sh

# Backup with options
./scripts/backup.sh --skip-logs --skip-cleanup
```

### Backup Verification

```bash
# List available backups
ls -la backups/database/
ls -la backups/uploads/

# Verify backup integrity
./scripts/backup.sh --verify

# Test restore (on staging)
./scripts/backup.sh --restore backups/database/db_backup_20240101_120000.sql.gz
```

## 🔄 Update Procedures

### Application Updates

```bash
# 1. Create backup
./scripts/backup.sh

# 2. Pull latest changes
git pull origin main

# 3. Check for breaking changes
cat CHANGELOG.md

# 4. Update dependencies
poetry install

# 5. Run tests
make test-all

# 6. Deploy updates
./scripts/deploy.sh

# 7. Verify deployment
curl -f https://yourdomain.com/health
```

### Database Migrations

```bash
# Check current database schema
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d dried_fruits_db -c "\dt"

# Run migrations
docker-compose -f docker-compose.prod.yml exec api python -c "
from app.core.database import engine, Base
from sqlalchemy import text
# Add any custom migration scripts here
Base.metadata.create_all(bind=engine)
"

# Verify migrations
docker-compose -f docker-compose.prod.yml exec api python -c "
from app.core.database import get_db
from app.models.user import User
db = next(get_db())
print(f'Users table exists: {User.__table__.exists(db.bind)}')
"
```

## 🛡️ Security Operations

### Security Monitoring

```bash
# Check for failed login attempts
docker-compose -f docker-compose.prod.yml logs api | grep "authentication failed"

# Monitor unusual API access patterns
docker-compose -f docker-compose.prod.yml logs nginx | grep "POST /api/v1/auth/login"

# Check for security vulnerabilities
docker scan $(docker-compose -f docker-compose.prod.yml images -q api)
```

### SSL Certificate Management

```bash
# Check certificate expiration
openssl x509 -in nginx/ssl/cert.pem -text -noout | grep "Not After"

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
sudo certbot renew

# Update certificate in containers
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/key.pem
docker-compose -f docker-compose.prod.yml restart nginx
```

## 📋 Daily Operations Checklist

### Morning Check (9:00 AM)
- [ ] Check system health dashboards
- [ ] Review overnight logs for errors
- [ ] Check backup completion status
- [ ] Verify SSL certificate status
- [ ] Review business metrics from previous day

### Midday Check (1:00 PM)
- [ ] Monitor system performance metrics
- [ ] Check active user sessions
- [ ] Review inventory alerts
- [ ] Monitor API response times

### Evening Check (6:00 PM)
- [ ] Review daily transaction volume
- [ ] Check for any customer support issues
- [ ] Monitor system resource usage
- [ ] Prepare for overnight backup

## 🔧 Troubleshooting Guide

### Common Issues and Solutions

#### 1. High CPU Usage
```bash
# Identify process causing high CPU
docker stats

# Check for slow database queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d dried_fruits_db -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
"

# Scale API service if needed
docker-compose -f docker-compose.prod.yml up -d --scale api=3
```

#### 2. Database Connection Pool Exhaustion
```bash
# Check active connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d dried_fruits_db -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity;
"

# Increase pool size in environment
# Edit .env.prod: DB_POOL_SIZE=20

# Restart services
docker-compose -f docker-compose.prod.yml restart api
```

#### 3. Disk Space Issues
```bash
# Check disk usage
df -h

# Clean up old logs
docker-compose -f docker-compose.prod.yml exec api find /app/logs -name "*.log" -mtime +7 -delete

# Clean up old backups
find ./backups -name "*.gz" -mtime +30 -delete

# Clean up Docker images
docker system prune -a
```

#### 4. Memory Leaks
```bash
# Monitor memory usage over time
docker stats --no-stream

# Check for memory leaks in application
docker-compose -f docker-compose.prod.yml exec api python -c "
import psutil
process = psutil.Process()
print(f'Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB')
"

# Restart services if needed
docker-compose -f docker-compose.prod.yml restart api
```

## 📊 Capacity Planning

### Growth Metrics to Track

#### Monthly Growth Indicators
- **Storage Growth**: Database + file storage
- **Transaction Volume**: Orders per day/month
- **User Growth**: New registrations
- **API Request Growth**: Requests per minute

#### Scaling Triggers
- **CPU**: Consistently > 70% for 1 week
- **Memory**: Consistently > 80% for 1 week
- **Storage**: > 80% capacity
- **Response Time**: > 1 second average

### Scaling Strategies

#### Vertical Scaling
```bash
# Increase container resources
# Edit docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2'
    reservations:
      memory: 1G
      cpus: '1'
```

#### Horizontal Scaling
```bash
# Scale API service
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Load balance with multiple instances
# Update nginx.conf upstream configuration
```

## 🔍 Log Analysis

### Important Log Files

```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f api

# Database logs
docker-compose -f docker-compose.prod.yml logs -f postgres

# Nginx access logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# System logs
sudo journalctl -u docker -f
```

### Log Analysis Commands

```bash
# Find errors in API logs
docker-compose -f docker-compose.prod.yml logs api | grep -i error

# Check failed authentication attempts
docker-compose -f docker-compose.prod.yml logs api | grep "authentication failed"

# Monitor API response times
docker-compose -f docker-compose.prod.yml logs nginx | grep "request_time"

# Check database slow queries
docker-compose -f docker-compose.prod.yml logs postgres | grep "slow"
```

## 🚨 Incident Response

### Incident Classification

#### Severity Levels
- **Critical**: System down, data loss
- **High**: Major feature unavailable
- **Medium**: Minor feature issues
- **Low**: Cosmetic issues

#### Response Times
- **Critical**: 15 minutes
- **High**: 1 hour
- **Medium**: 4 hours
- **Low**: 24 hours

### Incident Response Steps

1. **Acknowledge**: Confirm issue received
2. **Assess**: Determine severity and impact
3. **Respond**: Implement immediate fixes
4. **Communicate**: Update stakeholders
5. **Resolve**: Implement permanent fix
6. **Review**: Post-incident analysis

### Emergency Contacts

```bash
# Emergency rollback
git checkout HEAD~1
./scripts/deploy.sh --no-backup

# Emergency maintenance mode
# Edit nginx.conf to return 503 for all requests
docker-compose -f docker-compose.prod.yml restart nginx
```

## 📞 Support Procedures

### User Support

#### Common User Issues
1. **Password Reset**: Use admin panel or direct database
2. **Account Locked**: Check failed login attempts
3. **Permission Issues**: Verify user roles
4. **Data Discrepancies**: Check transaction logs

#### Support Commands
```bash
# Reset user password
docker-compose -f docker-compose.prod.yml exec api python -c "
from app.crud.crud_user import user_crud
from app.core.database import get_db
from app.core.security import get_password_hash
db = next(get_db())
user = user_crud.get_by_email(db, email='user@example.com')
if user:
    user.hashed_password = get_password_hash('newpassword')
    db.commit()
    print('Password updated')
"

# Check user activity
docker-compose -f docker-compose.prod.yml exec api python -c "
from app.models.user import User
from app.core.database import get_db
db = next(get_db())
user = db.query(User).filter(User.email == 'user@example.com').first()
if user:
    print(f'Last login: {user.last_login}')
    print(f'Is active: {user.is_active}')
"
```

---

This operations guide should be reviewed and updated regularly as the system evolves. For technical issues not covered here, refer to the [DEPLOYMENT.md](DEPLOYMENT.md) guide or contact the development team.