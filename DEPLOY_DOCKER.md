# Deploy everything with Docker (PostgreSQL + App)

One command runs **PostgreSQL**, **API**, and **Admin** together. No Supabase required.

## Quick start (server or laptop)

```bash
cp .env.docker.example .env.docker
# Edit .env.docker — set DB_PASSWORD, JWT_SECRET, APP_URL for production

npm run docker:prod
```

Open:

- Health: http://localhost:3000/api/v1/health
- Admin: http://localhost:3000/admin/login

First deploy: keep `SEED_DATABASE=true` in `.env.docker`.  
After seed succeeds, set `SEED_DATABASE=false` and redeploy.

---

## What runs

| Service | Image | Port |
|---------|--------|------|
| `postgres` | postgres:16-alpine | internal 5432 |
| `app` | built from `Dockerfile` | host `APP_PORT` → 3000 |

**Volumes:** `postgres_data` (database), `uploads_data` (receipt PDFs)

---

## Coolify (Docker Compose)

1. **+ New Resource** → **Application**
2. **GitHub** → `csmanojfamra/SanstaERPSAAS` → branch `main`
3. **Build Pack** → **Docker Compose**
4. **Docker Compose file** → `docker-compose.prod.yml`
5. **Base Directory** → `/`
6. Add **Environment Variables** (same as `.env.docker.example`):

```env
DB_USER=sansta_user
DB_PASSWORD=your-strong-password
DB_NAME=sansta_erp
APP_PORT=3000
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=8h
APP_URL=https://erp.fastlegal.in
ADMIN_URL=https://erp.fastlegal.in
PUBLIC_URL=https://erp.fastlegal.in
TENANT_BASE_DOMAIN=erp.fastlegal.in
TENANT_URL_PROTOCOL=https
ADMIN_PATH=/admin/login
SEED_DATABASE=true
```

7. **Ports Exposes** → `3000`
8. Add domain → `erp.fastlegal.in`
9. **Deploy**

After first successful deploy, set `SEED_DATABASE=false` and redeploy.

---

## Commands

```bash
# Start (build + run)
npm run docker:prod

# View app logs
npm run docker:prod:logs

# Stop
npm run docker:prod:down
```

---

## Login after seed

| Role | URL |
|------|-----|
| Platform admin | `/admin/login` — `admin` / `Admin@1234` |
| Sanwaliya trust | `/admin/login?tenant=sanwaliya-seth-deoli` |

Change passwords before production use.
