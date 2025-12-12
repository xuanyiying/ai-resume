# Agent Monitoring Setup Guide

## Overview

This guide provides instructions for setting up comprehensive monitoring dashboards for the Agent system using Grafana, Prometheus, and Loki.

## Table of Contents

1. [Architecture](#architecture)
2. [Prometheus Setup](#prometheus-setup)
3. [Grafana Setup](#grafana-setup)
4. [Loki Setup](#loki-setup)
5. [Dashboard Configuration](#dashboard-configuration)
6. [Alert Rules](#alert-rules)
7. [Troubleshooting](#troubleshooting)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent API Application                     │
│  (Exposes metrics on /metrics endpoint)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   Prometheus    Loki         Alertmanager
   (Metrics)   (Logs)        (Alerts)
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
                  Grafana
              (Dashboards)
```

## Prometheus Setup

### Installation

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-2.40.0.linux-amd64.tar.gz
cd prometheus-2.40.0.linux-amd64

# Create configuration directory
mkdir -p /etc/prometheus
mkdir -p /var/lib/prometheus
```

### Configuration

Create `/etc/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'agent-api-monitor'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093

rule_files:
  - '/etc/prometheus/alert_rules.yml'

scrape_configs:
  # Agent API metrics
  - job_name: 'agent-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Start Prometheus

```bash
# Create systemd service
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/opt/prometheus/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus

# Verify
curl http://localhost:9090
```

## Grafana Setup

### Installation

```bash
# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt-get update

# Install Grafana
sudo apt-get install -y grafana-server

# Enable and start
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# Verify
curl http://localhost:3000
```

### Initial Configuration

1. Access Grafana at `http://localhost:3000`
2. Default credentials: admin / admin
3. Change password when prompted
4. Add Prometheus data source:
   - URL: `http://localhost:9090`
   - Access: Server
   - Save & Test

### Add Loki Data Source

1. Configuration → Data Sources → Add data source
2. Select Loki
3. URL: `http://localhost:3100`
4. Save & Test

## Loki Setup

### Installation

```bash
# Download Loki
wget https://github.com/grafana/loki/releases/download/v2.8.0/loki-linux-amd64.zip
unzip loki-linux-amd64.zip
sudo mv loki-linux-amd64 /opt/loki

# Create configuration directory
mkdir -p /etc/loki
```

### Configuration

Create `/etc/loki/loki-config.yml`:

```yaml
auth_enabled: false

ingester:
  chunk_idle_period: 3m
  max_chunk_age: 1h
  max_streams_per_user: 10000
  chunk_retain_period: 1m

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema:
        version: v11
        index:
          prefix: index_
          period: 24h

server:
  http_listen_port: 3100
  log_level: info

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

### Start Loki

```bash
# Create systemd service
sudo tee /etc/systemd/system/loki.service > /dev/null <<EOF
[Unit]
Description=Loki
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=loki
Group=loki
ExecStart=/opt/loki/loki-linux-amd64 -config.file=/etc/loki/loki-config.yml

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable loki
sudo systemctl start loki

# Verify
curl http://localhost:3100/ready
```

### Configure Promtail (Log Shipper)

Create `/etc/promtail/promtail-config.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://localhost:3100/loki/api/v1/push

scrape_configs:
  - job_name: agent-api
    static_configs:
      - targets:
          - localhost
        labels:
          job: agent-api
          __path__: /var/log/agent-api/*.log

  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: system
          __path__: /var/log/syslog
```

## Dashboard Configuration

### Agent Metrics Dashboard

Create a new dashboard in Grafana with the following panels:

#### Panel 1: Request Rate

```
Title: Request Rate (req/s)
Query: rate(http_requests_total[5m])
Type: Graph
```

#### Panel 2: Error Rate

```
Title: Error Rate (%)
Query: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100
Type: Gauge
Thresholds: 0, 1, 5
```

#### Panel 3: Response Time (p95)

```
Title: Response Time p95 (ms)
Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) * 1000
Type: Graph
```

#### Panel 4: Active Agents

```
Title: Active Agent Sessions
Query: agent_sessions_active
Type: Stat
```

#### Panel 5: Token Usage by Agent

```
Title: Token Usage by Agent
Query: sum(rate(agent_tokens_used_total[5m])) by (agent_type)
Type: Pie Chart
```

#### Panel 6: Cache Hit Rate

```
Title: Cache Hit Rate (%)
Query: (rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) * 100
Type: Gauge
```

#### Panel 7: Database Query Time

```
Title: Database Query Time (ms)
Query: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) * 1000
Type: Graph
```

#### Panel 8: Agent Success Rate

```
Title: Agent Success Rate (%)
Query: (rate(agent_sessions_completed_total[5m]) / rate(agent_sessions_total[5m])) * 100
Type: Gauge
```

### Token Usage Dashboard

#### Panel 1: Total Tokens Used

```
Title: Total Tokens Used (Today)
Query: sum(increase(agent_tokens_used_total[24h]))
Type: Stat
```

#### Panel 2: Tokens by Agent Type

```
Title: Tokens by Agent Type
Query: sum(increase(agent_tokens_used_total[24h])) by (agent_type)
Type: Bar Chart
```

#### Panel 3: Tokens by Workflow Step

```
Title: Tokens by Workflow Step
Query: sum(increase(agent_tokens_used_total[24h])) by (workflow_step)
Type: Table
```

#### Panel 4: Token Savings from Caching

```
Title: Token Savings from Caching
Query: sum(increase(agent_tokens_saved_caching_total[24h]))
Type: Stat
```

#### Panel 5: Token Savings from Compression

```
Title: Token Savings from Compression
Query: sum(increase(agent_tokens_saved_compression_total[24h]))
Type: Stat
```

#### Panel 6: Token Savings from Model Routing

```
Title: Token Savings from Model Routing
Query: sum(increase(agent_tokens_saved_routing_total[24h]))
Type: Stat
```

#### Panel 7: Total Cost

```
Title: Total Cost (Today)
Query: sum(increase(agent_cost_total[24h]))
Type: Stat
Unit: currencyUSD
```

#### Panel 8: Cost Trend

```
Title: Cost Trend (7 days)
Query: sum(increase(agent_cost_total[1d])) by (day)
Type: Graph
```

### System Health Dashboard

#### Panel 1: CPU Usage

```
Title: CPU Usage (%)
Query: (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
Type: Gauge
```

#### Panel 2: Memory Usage

```
Title: Memory Usage (%)
Query: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
Type: Gauge
```

#### Panel 3: Disk Usage

```
Title: Disk Usage (%)
Query: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100
Type: Gauge
```

#### Panel 4: Database Connections

```
Title: Database Connections
Query: pg_stat_activity_count
Type: Stat
```

#### Panel 5: Redis Memory

```
Title: Redis Memory Usage (MB)
Query: redis_memory_used_bytes / 1024 / 1024
Type: Gauge
```

#### Panel 6: Network I/O

```
Title: Network I/O (MB/s)
Query: rate(node_network_transmit_bytes_total[5m]) / 1024 / 1024
Type: Graph
```

## Alert Rules

Create `/etc/prometheus/alert_rules.yml`:

```yaml
groups:
  - name: agent_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: (rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value | humanizePercentage }}'

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High response time detected'
          description: 'p95 response time is {{ $value | humanizeDuration }}'

      # High token usage
      - alert: HighTokenUsage
        expr: rate(agent_tokens_used_total[5m]) > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'High token usage detected'
          description: 'Token usage rate is {{ $value | humanize }} tokens/sec'

      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: (rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Low cache hit rate'
          description: 'Cache hit rate is {{ $value | humanizePercentage }}'

      # Database connection pool exhausted
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'Database connection pool exhausted'
          description: 'Active connections: {{ $value }}'

      # High CPU usage
      - alert: HighCPUUsage
        expr: (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High CPU usage'
          description: 'CPU usage is {{ $value | humanizePercentage }}'

      # High memory usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage'
          description: 'Memory usage is {{ $value | humanizePercentage }}'

      # Disk space low
      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space low'
          description: 'Disk usage is {{ $value | humanizePercentage }}'

      # Agent session failure rate high
      - alert: HighAgentFailureRate
        expr: (rate(agent_sessions_failed_total[5m]) / rate(agent_sessions_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High agent failure rate'
          description: 'Failure rate is {{ $value | humanizePercentage }}'

      # Vector database slow queries
      - alert: VectorDatabaseSlowQueries
        expr: histogram_quantile(0.95, rate(vector_db_query_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Vector database slow queries'
          description: 'p95 query time is {{ $value | humanizeDuration }}'
```

### Alertmanager Configuration

Create `/etc/alertmanager/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical'
    slack_configs:
      - channel: '#critical-alerts'
        title: 'CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'warning'
    slack_configs:
      - channel: '#warnings'
        title: 'Warning: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

## Monitoring Anomalies

### Token Usage Trends

Monitor these metrics for anomalies:

- Sudden spikes in token usage
- Unusual patterns by agent type
- Cost increases without corresponding usage increase

### Performance Degradation

Watch for:

- Increasing response times
- Decreasing cache hit rates
- Growing database query times

### System Health

Monitor:

- CPU and memory trends
- Disk space usage
- Database connection pool utilization

## Troubleshooting

### Prometheus not scraping metrics

```bash
# Check Prometheus logs
sudo journalctl -u prometheus -f

# Verify metrics endpoint
curl http://localhost:3000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### Grafana dashboards not updating

```bash
# Check Grafana logs
sudo journalctl -u grafana-server -f

# Verify data source connection
# In Grafana: Configuration → Data Sources → Test
```

### Loki not receiving logs

```bash
# Check Loki logs
sudo journalctl -u loki -f

# Verify Promtail configuration
sudo systemctl restart promtail

# Check Promtail logs
sudo journalctl -u promtail -f
```

## Maintenance

### Prometheus Data Retention

```yaml
# In prometheus.yml
global:
  scrape_interval: 15s
  # Keep data for 30 days
  external_labels:
    retention: 30d
```

### Backup Dashboards

```bash
# Export dashboard
curl http://localhost:3000/api/dashboards/db/agent-metrics \
  -H "Authorization: Bearer YOUR_API_TOKEN" > dashboard.json

# Import dashboard
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @dashboard.json
```

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Alert Rules Best Practices](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
