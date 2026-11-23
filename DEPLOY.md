# Hospital Management System - Production Deployment Guide (Microsoft Azure)

This guide documents the complete end-to-end production deployment process for the Hospital Queue & Clinical Management Platform on Microsoft Azure.

---

## 1. Architecture Overview

```
                      +---------------------------------------+
                      |       Azure Front Door / Cloudflare    |
                      |            (Custom Domains + SSL)      |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+-------------------------------+               +---------------------------------------+
|    Azure Static Web Apps      |   REST / WS   |          Azure App Service            |
|       (React + Vite SPA)      +-------------->|      (Node.js 20+ Express API)        |
|  - staticwebapp.config.json   |               |   - WebSockets: Enabled               |
|  - VITE_API_URL / SOCKET_URL  |               |   - Always On: Enabled                |
+-------------------------------+               |   - Health: /health                   |
                                                +-------------------+-------------------+
                                                                    |
                                        +---------------------------+---------------------------+
                                        |                                                       |
                                        v                                                       v
+-----------------------------------------------+                       +-----------------------------------------------+
|     Azure Database for PostgreSQL Flexible    |                       |               Azure App Service               |
|  - Version 16                                 |                       |          (Python 3.11 AI Service)             |
|  - Private Endpoint / SSL required            |                       |  - Azure Files mounted to /models             |
|  - Connection pooling (PgBouncer)             |                       |  - Internal Shared Secret Auth                |
+-----------------------------------------------+                       +-----------------------------------------------+
```

---

## 2. Prerequisites & Azure Resources to Provision

1. **Resource Group**: `rg-hospital-prod` (e.g., East US / Central India)
2. **Azure Database for PostgreSQL - Flexible Server**:
   - Compute: General Purpose `Standard_D2ds_v5` or Burstable `Standard_B2s`
   - High Availability: Same-zone or Zone-redundant
   - Storage: 32 GB minimum, autogrow enabled
   - SSL: Require SSL (`sslmode=require`)
   - Allow Azure Services access: Enabled (or configured via Virtual Network Integration)
3. **Azure App Service Plan (Linux)**:
   - Tier: `B1` or `P1v3` (Dedicated compute with WebSockets and Always On support)
4. **App Service 1 (Node.js API Gateway & Queue Engine)**:
   - Runtime: Node.js 20 LTS
   - Configuration:
     - `Web sockets`: **On**
     - `Always on`: **On**
     - `HTTP version`: 2.0
5. **App Service 2 (Python AI Wait-Time Prediction)**:
   - Runtime: Python 3.11
   - Storage mount: Azure Files persistent SMB share mounted at `/models` (so trained ML `.pkl` weights persist across restarts)
6. **Azure Static Web Apps (Frontend)**:
   - Source: `frontend/`
   - Build preset: Custom / Vite
   - App artifact location: `dist`

---

## 3. Database Schema & Migration Execution Order

Connect to your Azure PostgreSQL instance using `psql` or Azure Cloud Shell, then execute migrations in exact sequential order:

```bash
# 1. Export database connection string
export DATABASE_URL="postgresql://<admin_user>:<admin_password>@<db-host>.postgres.database.azure.com:5432/<db_name>?sslmode=require"

# 2. Run migration scripts from backend/node-backend/prisma/migrations/
cd backend/node-backend

# Apply Migration 01 (Billing & Cash Shifts)
psql "$DATABASE_URL" -f prisma/migrations/01_billing_schema.sql

# Apply Migration 02 (Continuous Learning & Feature Snapshots)
psql "$DATABASE_URL" -f prisma/migrations/02_continuous_learning_schema.sql

# Apply Migration 03 (Hospital Requests & Force Password Change)
psql "$DATABASE_URL" -f prisma/migrations/03_hospital_requests_schema.sql

# 3. Generate Prisma Client
npm install --production=false
npx prisma generate
```

### Initial Platform Superadmin Seed

Create the initial platform administrator account to approve incoming hospital registration requests:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function seed() {
  const hash = await bcrypt.hash(process.env.INITIAL_SUPERADMIN_PASSWORD || 'ChangeMeImmediately123!', 10);
  await prisma.users.upsert({
    where: { email: 'superadmin@hospital-platform.local' },
    update: {},
    create: {
      email: 'superadmin@hospital-platform.local',
      username: 'Platform Admin',
      password_hash: hash,
      role: 'super_admin',
      status: 'active',
      must_change_password: true
    }
  });
  console.log('Platform Superadmin provisioned successfully');
  await prisma.$disconnect();
}
seed();
"
```

---

## 4. Environment Variables Configuration

### 4.1 Node.js Backend (`rg-hospital-prod-api`)

Set these in Azure Portal > **App Service** > **Configuration** > **Application Settings**:

| Variable | Description | Example / Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | Listening port | `8000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `FRONTEND_URL` | Production frontend URL for CORS | `https://hospital.yourdomain.com` (no trailing slash) |
| `JWT_SECRET` | Cryptographic secret for signing tokens | Minimum 32 characters, high entropy |
| `AI_INTERNAL_SECRET` | Secret key shared with Python AI | Minimum 16 characters |
| `PYTHON_AI_URL` | Internal URL for Python AI App Service | `https://ai.internal.yourdomain.com` or local VNet IP |
| `ALLOW_LEGACY_EMAIL_AUTH` | Disables insecure email auth | `false` |

> [!IMPORTANT]
> The server will execute `validateProductionConfig()` on boot and terminate with an error code if `JWT_SECRET` (<32 chars), `AI_INTERNAL_SECRET` (<16 chars), `DATABASE_URL`, or `FRONTEND_URL` is omitted.

### 4.2 Python AI Service (`rg-hospital-prod-ai`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PYTHON_ENV` | Environment identifier | `production` |
| `PORT` | Microservice port | `5001` |
| `AI_INTERNAL_SECRET` | Must match Node.js `AI_INTERNAL_SECRET` | Same 16+ char secret |
| `MODELS_DIR` | Directory pointing to persistent storage | `/models` (Azure Files mount) |

### 4.3 Frontend Static Web App (`rg-hospital-prod-web`)

Set these in Azure Portal > **Static Web App** > **Configuration**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base API URL | `https://api.yourhospitaldomain.com` |
| `VITE_SOCKET_URL` | WebSocket Server URL | `https://api.yourhospitaldomain.com` |

---

## 5. Deployment Commands & CI/CD Pipeline

### 5.1 Frontend Build & Deployment (Azure Static Web Apps)

GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`):

```yaml
name: Deploy Frontend to Azure SWA
on:
  push:
    branches: [ master ]
    paths:
      - 'frontend/**'
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          output_location: "dist"
```

### 5.2 Backend API Deployment (Azure App Service)

```bash
cd backend/node-backend
# Install production dependencies and build
npm ci --production
# Deploy via Azure CLI
az webapp up \
  --resource-group rg-hospital-prod \
  --name app-hospital-api-prod \
  --plan plan-hospital-prod \
  --runtime "NODE:20-lts"
```

---

## 6. Post-Deployment Verification Checklist

1. [ ] Check API Health endpoint: `curl -I https://api.yourhospitaldomain.com/health` (Expect `HTTP 200 OK`).
2. [ ] Verify WebSocket handshake: Inspect network tab in browser on Live Queue page (`wss://api.yourhospitaldomain.com/socket.io/`).
3. [ ] Test Rate Limiter: Attempt 6 consecutive failed logins to verify 429 lockout response.
4. [ ] Sign in with initial platform admin and approve pending hospital registration.
5. [ ] Verify forced password change on first employee login (`must_change_password: true`).
6. [ ] Confirm `.pkl` model weights are written to persistent volume `/models`.
