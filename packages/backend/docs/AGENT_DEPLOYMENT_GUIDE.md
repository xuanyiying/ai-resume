# Agent Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the LangChain Agent Integration system to production. It covers infrastructure requirements, migration steps, monitoring setup, and rollback procedures.

## Table of Contents

1. [Infrastructure Requirements](#infrastructure-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Steps](#deployment-steps)
4. [Database Migrations](#database-migrations)
5. [Configuration](#configuration)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

## Infrastructure Requirements

### Hardware Requirements

**Minimum:**

- CPU: 4 cores
- RAM: 8 GB
- Storage: 100 GB SSD
- Network: 100 Mbps

**Recommended:**

- CPU: 8+ cores
- RAM: 16+ GB
- Storage: 500 GB SSD
- Network: 1 Gbps

### Software Requirements

**Backend:**

- Node.js: 18.x or higher
- PostgreSQL: 13.x or higher
- Redis: 6.x or higher
- Docker: 20.x or higher (for containerized deployment)

**Vector Database:**

- PostgreSQL with pgvector extension
- Minimum 50 GB storage for embeddings

**AI Providers:**

- OpenAI API access (or alternative provider)
- Valid API keys configured

### Network Requirements

**Ports:**

- 3000: Backend API
- 5432: PostgreSQL
- 6379: Redis
- 443: HTTPS (production)

**Firewall Rules:**

- Allow inbound on port 443 (HTTPS)
- Allow inbound on port 80 (HTTP, redirect to HTTPS)
- Restrict database ports to internal network only
- Restrict Redis to internal network only

### Storage Requirements

**Database:**

- PostgreSQL: 50-100 GB (including vector embeddings)
- Backup storage: 100+ GB

**Application:**

- Node modules: 2-3 GB
- Logs: 10-20 GB (with rotation)
- Temporary files: 5-10 GB

## Pre-Deployment Checklist

### Code Preparation

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] No console.log statements in production code
- [ ] Environment variables documented
- [ ] Dependencies updated and audited
- [ ] Build process tested

### Infrastructure Preparation

- [ ] Production database provisioned
- [ ] Redis cluster configured
- [ ] SSL certificates obtained
- [ ] Backup systems configured
- [ ] Monitoring tools installed
- [ ] Load balancer configured

### Configuration Preparation

- [ ] Environment variables set
- [ ] Database connection strings verified
- [ ] API keys configured
- [ ] Logging configured
- [ ] Monitoring configured
- [ ] Backup schedule configured

### Testing

- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Backup/restore tested

## Deployment Steps

### Step 1: Prepare Production Environment

```bash
# SSH into production server
ssh user@production-server.com

# Create application directory
mkdir -p /opt/app
cd /opt/app

# Clone repository
git clone https://github.com/your-org/your-repo.git
cd your-repo

# Checkout production branch
git checkout main
git pull origin main
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
npm install --production

# Install backend dependencies
cd packages/backend
npm install --production
cd ../..

# Verify installation
npm list
```

### Step 3: Build Application

```bash
# Build backend
npm run build

# Verify build
ls -la packages/backend/dist/
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp packages/backend/.env.example packages/backend/.env

# Edit environment variables
nano packages/backend/.env

# Required variables:
# DATABASE_URL=postgresql://user:password@host:5432/dbname
# REDIS_URL=redis://host:6379
# JWT_SECRET=your-secret-key
# OPENAI_API_KEY=your-api-key
# NODE_ENV=production
```

### Step 5: Database Migration

```bash
# Navigate to backend
cd packages/backend

# Run migrations
npx prisma migrate deploy

# Seed initial data (if needed)
npx prisma db seed

# Verify migration
npx prisma db push --skip-generate

cd ../..
```

### Step 6: Start Application

```bash
# Using PM2 (recommended for production)
npm install -g pm2

# Start application
pm2 start packages/backend/dist/main.js --name "agent-api"

# Configure auto-restart
pm2 startup
pm2 save

# Verify running
pm2 status
pm2 logs agent-api
```

### Step 7: Configure Reverse Proxy

**Using Nginx:**

```nginx
# /etc/nginx/sites-available/agent-api
upstream agent_api {
    server localhost:3000;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://agent_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://agent_api;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/agent-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 8: Verify Deployment

```bash
# Check API health
curl https://api.example.com/health

# Check logs
pm2 logs agent-api

# Test endpoints
curl -X GET https://api.example.com/api/agents/management/list \
  -H "Authorization: Bearer <test-token>"

# Monitor performance
pm2 monit
```

## Database Migrations

### Creating Migrations

```bash
# Create a new migration
npx prisma migrate dev --name add_agent_fields

# Review migration file
cat prisma/migrations/[timestamp]_add_agent_fields/migration.sql
```

### Running Migrations

**Development:**

```bash
npx prisma migrate dev
```

**Production:**

```bash
# Backup database first
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma db push --skip-generate
```

### Rollback Migrations

```bash
# List migrations
npx prisma migrate status

# Rollback to previous state (manual process)
# 1. Restore from backup
# 2. Or manually revert migration SQL

# Restore from backup
psql $DATABASE_URL < backup-20240101-120000.sql
```

### Migration Best Practices

1. **Test migrations locally first**

   ```bash
   npx prisma migrate dev
   ```

2. **Backup before production migration**

   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

3. **Run migrations during low-traffic periods**

4. **Monitor migration progress**

   ```bash
   # For large tables, migrations may take time
   # Monitor with:
   SELECT * FROM pg_stat_activity;
   ```

5. **Verify after migration**
   ```bash
   npx prisma db push --skip-generate
   ```

## Configuration

### Environment Variables

**Required:**

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# AI Providers
OPENAI_API_KEY=sk-...
QWEN_API_KEY=...
DEEPSEEK_API_KEY=...

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

**Optional:**

```bash
# Monitoring
SENTRY_DSN=https://...
DATADOG_API_KEY=...

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password

# Storage
AWS_S3_BUCKET=bucket-name
AWS_REGION=us-east-1
```

### Configuration Files

**Backend Configuration:**

```typescript
// packages/backend/src/config/app.config.ts
export const appConfig = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
  },
};
```

### Secrets Management

**Using AWS Secrets Manager:**

```bash
# Store secrets
aws secretsmanager create-secret \
  --name agent-api/prod \
  --secret-string '{"DATABASE_URL":"...","JWT_SECRET":"..."}'

# Retrieve secrets
aws secretsmanager get-secret-value \
  --secret-id agent-api/prod
```

**Using HashiCorp Vault:**

```bash
# Store secrets
vault kv put secret/agent-api/prod \
  DATABASE_URL=postgresql://... \
  JWT_SECRET=...

# Retrieve secrets
vault kv get secret/agent-api/prod
```

## Monitoring and Alerts

### Application Monitoring

**Using PM2 Plus:**

```bash
# Install PM2 Plus
pm2 install pm2-auto-pull

# Monitor
pm2 web  # Access at http://localhost:9615

# Set up alerts
pm2 set pm2-auto-pull instances 4
```

**Using Prometheus:**

```bash
# Install Prometheus client
npm install prom-client

# Configure metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### Log Monitoring

**Using ELK Stack:**

```bash
# Configure Filebeat
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/agent-api/*.log

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

**Using CloudWatch:**

```bash
# Configure AWS SDK
const cloudwatch = new AWS.CloudWatch();

cloudwatch.putMetricData({
  Namespace: 'AgentAPI',
  MetricData: [{
    MetricName: 'RequestCount',
    Value: 1,
    Unit: 'Count',
  }],
});
```

### Alert Configuration

**CPU Usage Alert:**

```yaml
alert: HighCPUUsage
expr: node_cpu_seconds_total > 0.8
for: 5m
annotations:
  summary: 'High CPU usage detected'
```

**Memory Usage Alert:**

```yaml
alert: HighMemoryUsage
expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.2
for: 5m
annotations:
  summary: 'High memory usage detected'
```

**Error Rate Alert:**

```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
for: 5m
annotations:
  summary: 'High error rate detected'
```

## Rollback Procedures

### Quick Rollback (Last 5 minutes)

```bash
# Check current version
pm2 info agent-api

# Rollback to previous version
git revert HEAD
npm run build
pm2 restart agent-api

# Verify
curl https://api.example.com/health
```

### Full Rollback (Database + Code)

```bash
# 1. Stop application
pm2 stop agent-api

# 2. Restore database from backup
pg_restore -d $DATABASE_URL backup-20240101-120000.sql

# 3. Checkout previous code
git checkout v1.0.0
npm install
npm run build

# 4. Restart application
pm2 start agent-api

# 5. Verify
curl https://api.example.com/health
pm2 logs agent-api
```

### Partial Rollback (Feature Flag)

```bash
# Disable problematic feature via environment variable
export FEATURE_AGENTS_ENABLED=false

# Restart application
pm2 restart agent-api

# Verify
curl https://api.example.com/health
```

### Rollback Checklist

- [ ] Stop application gracefully
- [ ] Backup current database
- [ ] Restore previous database state
- [ ] Checkout previous code version
- [ ] Rebuild application
- [ ] Restart application
- [ ] Verify health endpoints
- [ ] Check logs for errors
- [ ] Monitor metrics
- [ ] Notify stakeholders

## Troubleshooting

### Issue: Application won't start

**Symptoms:**

```
Error: Cannot find module 'express'
```

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Start
pm2 start agent-api
```

### Issue: Database connection fails

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

```bash
# Check database is running
sudo systemctl status postgresql

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check firewall
sudo ufw status
```

### Issue: High memory usage

**Symptoms:**

```
Memory: 85% (13.6 GB / 16 GB)
```

**Solution:**

```bash
# Check for memory leaks
pm2 monit

# Increase Node.js heap size
pm2 start agent-api --node-args="--max-old-space-size=4096"

# Restart application
pm2 restart agent-api
```

### Issue: Slow API responses

**Symptoms:**

```
Response time: 5000ms (expected: 500ms)
```

**Solution:**

```bash
# Check database performance
EXPLAIN ANALYZE SELECT * FROM agent_sessions;

# Check Redis connection
redis-cli ping

# Monitor CPU usage
top -p $(pgrep -f "node.*main.js")

# Scale horizontally
pm2 start agent-api -i 4  # 4 instances
```

### Issue: Vector search not working

**Symptoms:**

```
Error: pgvector extension not found
```

**Solution:**

```bash
# Connect to database
psql $DATABASE_URL

# Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
SELECT * FROM pg_extension WHERE extname = 'vector';

# Recreate vector tables
npx prisma migrate deploy
```

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and tested
- [ ] All tests passing
- [ ] Dependencies updated
- [ ] Environment variables prepared
- [ ] Database backups created
- [ ] Monitoring configured
- [ ] Rollback plan documented

### Deployment

- [ ] Pull latest code
- [ ] Install dependencies
- [ ] Build application
- [ ] Run database migrations
- [ ] Start application
- [ ] Verify health endpoints
- [ ] Check logs
- [ ] Monitor metrics

### Post-Deployment

- [ ] Verify all endpoints working
- [ ] Check error rates
- [ ] Monitor performance
- [ ] Verify database integrity
- [ ] Test critical workflows
- [ ] Notify stakeholders
- [ ] Document deployment

## Support

For deployment issues:

- Check logs: `pm2 logs agent-api`
- Review metrics: `pm2 monit`
- Contact DevOps: devops@example.com
- Create issue: https://github.com/your-org/issues

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Nginx Configuration](https://nginx.org/en/docs/)
