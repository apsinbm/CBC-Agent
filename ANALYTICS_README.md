# CBC-Agent Internal Analytics Platform

## Overview

Privacy-first internal analytics platform for CBC-Agent, providing comprehensive insights into guest interactions, service usage, and operational metrics.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  CBC-Agent  │────▶│  Ingest API  │────▶│  PostgreSQL  │
└─────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐
                    │    Redis     │     │     dbt      │
                    └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  Admin UI    │
                                          └──────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### Installation & Running

```bash
# 1. Start all services
make up

# 2. Wait for services to be ready (check logs)
make logs

# 3. Generate seed data
make seed

# 4. Run dbt transformations
make dbt-run

# 5. Access the admin dashboard
open http://localhost:3001
```

## Services

### Ingest API (Port 8001)
- FastAPI-based data ingestion service
- Privacy-preserving features (PII redaction, IP truncation)
- HMAC webhook verification
- Real-time event processing

### Admin UI (Port 3001)
- Next.js 15 with shadcn/ui components
- Real-time analytics dashboard
- Service metrics and operational insights
- Privacy-compliant data visualization

### PostgreSQL (Port 5432)
- Primary data store
- Optimized for time-series analytics
- Multi-schema architecture (staging, intermediate, marts)

### Redis (Port 6379)
- Caching layer
- Rate limiting
- Session management

### dbt
- Analytics transformations
- Data quality tests
- Documentation generation

## API Endpoints

### Event Ingestion
```
POST /ingest/event
```

### Webhooks
```
POST /webhook/cbc-agent/{webhook_type}
```

### Metrics
```
GET /metrics/{metric_type}?window=7d&segment=guest_type
```

### Privacy
```
POST /privacy/export
POST /privacy/delete
```

## Privacy & Compliance

### Data Protection
- PII automatically redacted in free-text fields
- IP addresses truncated (/24 for IPv4, /48 for IPv6)
- Consent validation before data processing
- GDPR-compliant data export/deletion

### Retention Policies
- Page views: 12 months
- Service interactions: 24 months
- Consent records: 7 years

## Development

### Local Development
```bash
# API development with hot reload
make dev-api

# Admin UI development
make dev-admin

# Run tests
make test-api
make test-integration
```

### Database Access
```bash
# PostgreSQL shell
make db-shell

# Redis CLI
make redis-cli
```

### dbt Commands
```bash
# Run transformations
make dbt-run

# Test data quality
make dbt-test

# Generate documentation
make dbt-docs
```

## Monitoring

### Health Checks
- API: http://localhost:8001/health
- Admin UI: http://localhost:3001/api/health

### Logs
```bash
make logs        # All services
make logs-api    # API only
make logs-admin  # Admin UI only
```

## Seed Data

The seed data generator creates realistic test data:
- 100 unique guests
- ~500 sessions
- ~5000 events
- Various event types (page views, searches, FAQ views, chat sessions)

Run with:
```bash
make seed
```

## Backup & Restore

```bash
# Create backup
make backup

# Restore from latest backup
make restore
```

## Environment Variables

### Ingest API
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `HMAC_SECRET`: Webhook signature secret
- `IP_SALT`: Salt for IP hashing
- `COLLECT_PII`: Enable PII collection (default: false)

### Admin UI
- `NEXT_PUBLIC_API_URL`: Ingest API URL
- `DATABASE_URL`: Direct database connection for queries

## Troubleshooting

### Services won't start
```bash
# Check logs
make logs

# Rebuild images
make build

# Clean and restart
make clean
make up
```

### Database connection issues
```bash
# Check PostgreSQL status
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres
```

### Seed data fails
```bash
# Ensure API is running
curl http://localhost:8001/health

# Check API logs for errors
make logs-api
```

## Production Deployment

1. Update environment variables in `.env.production`
2. Set strong secrets for HMAC_SECRET and IP_SALT
3. Configure proper database backups
4. Set up monitoring and alerting
5. Enable SSL/TLS for all services
6. Configure rate limiting and DDoS protection

## License

Internal use only - Coral Beach Club