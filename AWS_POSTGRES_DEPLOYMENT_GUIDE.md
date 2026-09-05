# Auxosys Codebase Future AWS RDS PostgreSQL Deployment Guide

This guide documents the architecture, database abstraction, and migration steps for deploying the **Auxosys Backend** to AWS Infrastructure using **AWS RDS PostgreSQL**.

---

## 1. Architectural Overview & Current Compatibility

The codebase features a **Dual Database Driver Architecture** in [`config/database.js`](file:///Users/pritam/Desktop/Apps/AUXOSYS/Auxosys-Backend/config/database.js).

- **Current Default (`DB_DRIVER=supabase`)**: Uses Supabase as the active database provider. All existing APIs, auth flows, and frontend operations run normally without breaking changes.
- **Future Ready (`DB_DRIVER=postgres` or `DB_DRIVER=rds`)**: Connects natively to any PostgreSQL database or **AWS RDS PostgreSQL** cluster via a connection pool (`pg.Pool`).

---

## 2. Environment Configuration

To switch to AWS RDS PostgreSQL in the future, set the following environment variables in `.env` or **AWS Secrets Manager**:

```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://auxosys_admin:YourSecurePassword@auxosys-db.cxxxxxx.ap-south-1.rds.amazonaws.com:5432/auxosys_db?sslmode=require
DB_SSL=true
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
```

---

## 3. Database Migration to AWS RDS PostgreSQL

### Method A: Native Migration Script (Recommended)
1. Provision your **AWS RDS PostgreSQL** instance in your VPC.
2. Update `.env` with your RDS connection credentials.
3. Run the automated migration script:
   ```bash
   node scripts/run_migrations.js
   ```
   *This executes [`migrations/000_full_postgres_schema.sql`](file:///Users/pritam/Desktop/Apps/AUXOSYS/Auxosys-Backend/migrations/000_full_postgres_schema.sql) which creates all tables, foreign keys, triggers, and indices idempotently.*

### Method B: AWS DMS (Database Migration Service)
If migrating zero-downtime data from Supabase Postgres to AWS RDS Postgres:
1. Create a Source Endpoint in AWS DMS targeting your Supabase Postgres database.
2. Create a Target Endpoint targeting your AWS RDS PostgreSQL instance.
3. Run a **Full Load + Ongoing Replication (CDC)** task.

---

## 4. Containerization & AWS Deployment Options

### Docker Deployment
The backend includes a production multi-stage [`Dockerfile`](file:///Users/pritam/Desktop/Apps/AUXOSYS/Auxosys-Backend/Dockerfile).

Build and tag image:
```bash
docker build -t auxosys-backend:latest .
```

To run backend with a local PostgreSQL container for testing:
```bash
docker-compose up -d
```

### AWS ECS (Fargate) / App Runner Setup
1. Push Docker image to **AWS ECR** (Elastic Container Registry).
2. Create an **AWS ECS Task Definition** or **AWS App Runner Service**.
3. Configure Health Check Probes:
   - **Liveness Probe**: `GET /health/ready`
   - **ALB Health Check Path**: `GET /health`
   - **Database Health Check**: `GET /health/db`

---

## 5. Database Backup & Disaster Recovery

### Automated Backups
Run timestamped database backups anytime:
```bash
node scripts/db_backup.js
```
*Creates `.sql` pg_dump files or `.json` fallback exports in `backups/`.*

### Database Restoration
To restore a backup into RDS or a local PostgreSQL instance:
```bash
node scripts/db_restore.js backups/auxosys_backup_2026-09-05.sql
```

---

## 6. Verification & Health Monitoring

Test all health endpoints:
- `http://localhost:5002/health`: Overall system uptime and active driver.
- `http://localhost:5002/health/ready`: Liveness probe for load balancer.
- `http://localhost:5002/health/db`: Live DB ping probe.
