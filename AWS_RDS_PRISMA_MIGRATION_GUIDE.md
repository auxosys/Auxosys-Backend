# Auxosys Future AWS RDS PostgreSQL & Prisma ORM Migration Guide

> **FUTURE PRISMA / AWS RDS INTEGRATION**: Currently inactive by default. Supabase remains the active production database driver. Enable only when migrating the Auxosys database to AWS RDS PostgreSQL.

---

## 1. Current State & Safety Architecture

- **Active Production Driver**: `DB_DRIVER=supabase`
- **Prisma Status**: Installed & pre-configured in [`prisma/schema.prisma`](file:///Users/pritam/Desktop/Apps/AUXOSYS/Auxosys-Backend/prisma/schema.prisma) with all 24 database models (`AppUser`, `SenderEmail`, `Campaign`, `Message`, `Client`, etc.), but **disabled by default** (`ENABLE_PRISMA=false`).
- **Zero Breaking Changes**: Existing Supabase queries, APIs, and controllers run without modification. `DATABASE_URL` is not required for daily development.

---

## 2. Future Step-by-Step Activation Workflow

When you are ready to deploy AWS RDS PostgreSQL and activate Prisma:

### Step 1: Provision AWS RDS PostgreSQL
1. Create your AWS RDS PostgreSQL database instance in your VPC.
2. Note your database Endpoint, Username, Password, and Database Name.
3. Ensure SSL is enforced (`sslmode=require`).

### Step 2: Configure Environment Variables
Update your production `.env` or **AWS Secrets Manager**:
```env
# 1. Set Prisma as Active Driver
DB_DRIVER=prisma
ENABLE_PRISMA=true

# 2. Set AWS RDS PostgreSQL Connection URL
DATABASE_URL="postgresql://auxosys_user:YourSecurePassword@auxosys-rds-instance.xxxxxx.ap-south-1.rds.amazonaws.com:5432/auxosys_db?sslmode=require"
```

### Step 3: Run Baseline Prisma Migration
Apply the pre-built baseline migration to your AWS RDS database:
```bash
# Option A: Deploy existing baseline migration (Recommended for production)
npx prisma migrate deploy

# Option B: Direct schema synchronization
npx prisma db push
```

### Step 4: Verify Prisma Health
Start your backend server (`node server.js`) and test the health endpoint:
```bash
curl http://localhost:5002/health/db
```
*Response when active:*
```json
{
  "status": "healthy",
  "driver": "prisma",
  "database": "auxosys_db",
  "postgresVersion": "PostgreSQL 16.1..."
}
```

---

## 3. How to Use Prisma in Controllers (Future Refactoring)

When you decide to refactor a controller to use Prisma ORM:

```javascript
// Import the singleton Prisma client instance
const { prisma } = require("../config/prismaClient");

// Example: Fetch all active clients
exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
```

---

## 4. Prisma Schema Maintenance

Whenever you add new tables or alter columns in the future:
1. Update [`prisma/schema.prisma`](file:///Users/pritam/Desktop/Apps/AUXOSYS/Auxosys-Backend/prisma/schema.prisma).
2. Generate fresh client types:
   ```bash
   npx prisma generate
   ```
3. Create a migration file:
   ```bash
   npx prisma migrate dev --name add_new_feature
   ```
