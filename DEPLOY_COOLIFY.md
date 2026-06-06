# Deploy Sansta ERP on Coolify (Docker)

Repo: [github.com/csmanojfamra/SanstaERPSAAS](https://github.com/csmanojfamra/SanstaERPSAAS)

## What the Docker image runs

- Express API (`/api/v1`)
- Admin panel (`/admin`)
- PDF uploads (`/uploads`) — use a **persistent volume** in Coolify
- Auto-runs `prisma migrate deploy` on each container start

---

## Step 1 — Supabase database

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string**
3. Copy two URLs:

| Variable | Supabase setting | Port |
|----------|------------------|------|
| `DATABASE_URL` | Connection pooling → **Transaction** mode | **6543** |
| `DIRECT_URL` | Direct connection | **5432** |

Append to pooled URL if missing: `?pgbouncer=true`

### Seed database (once, from your laptop)

```bash
export DATABASE_URL="postgresql://...pooler...6543...?pgbouncer=true"
export DIRECT_URL="postgresql://...direct...5432..."
node backend/prisma/seed.js
```

---

## Step 2 — Push Docker files to GitHub

Commit and push `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore` to your repo so Coolify can build.

---

## Step 3 — Coolify: new application

1. Open **Coolify** on your server.
2. **+ New Resource** → **Application**.
3. **Source:** GitHub → select `csmanojfamra/SanstaERPSAAS`.
4. **Build Pack:** **Dockerfile** (not Nixpacks).
5. **Dockerfile location:** `/Dockerfile` (repo root).
6. **Port:** `3000`.
7. **Health check path:** `/api/v1/health`.

---

## Step 4 — Environment variables (Coolify → Environment)

Replace values with yours:

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres

JWT_SECRET=generate-a-long-random-secret-minimum-32-characters
JWT_EXPIRES_IN=8h

APP_URL=https://erp.fastlegal.in
ADMIN_URL=https://erp.fastlegal.in
PUBLIC_URL=https://erp.fastlegal.in
PUBLIC_WEBSITE_URL=https://sanwaliyasethdeoli.in

TENANT_BASE_DOMAIN=erp.fastlegal.in
TENANT_URL_PROTOCOL=https
ADMIN_PATH=/admin/login
```

Generate `JWT_SECRET`:

```bash
openssl rand -base64 48
```

---

## Step 5 — Persistent storage (receipt PDFs)

In Coolify → your app → **Storages / Volumes**:

| Container path | Purpose |
|----------------|---------|
| `/app/backend/uploads` | Donation receipt PDFs |

Without this, uploads are lost when the container restarts.

---

## Step 6 — Domain & SSL (Docker Compose)

Coolify **Docker Compose** uses one text field: **Domains for app** (no + button). Put **comma-separated** URLs for the `app` service (port 3000):

```text
https://sansthaerp.fastlegal.in,https://manage.sanwaliyasethdeoli.in
```

The repo `docker-compose.yaml` declares `- SERVICE_FQDN_APP_3000` (list form) and keeps `ports: 3000:3000` so Traefik can reach the container. **Save → Deploy** after any domain change.

In **Environment**, ensure these are set (adjust if you use Supabase instead of stack postgres):

```env
APP_URL=https://sansthaerp.fastlegal.in
ADMIN_URL=https://sansthaerp.fastlegal.in
PUBLIC_URL=https://sansthaerp.fastlegal.in
PUBLIC_WEBSITE_URL=https://sanwaliyasethdeoli.in
TENANT_BASE_DOMAIN=sansthaerp.fastlegal.in
JWT_SECRET=...
DB_PASSWORD=...
```

If the app shows **no available server**, open **Logs** for the `app` container — usually JWT/DB env missing or container crash.

DNS at the client registrar:

```
CNAME  manage  →  [coolify-server-hostname]
```

Coolify provisions HTTPS (Let's Encrypt) per domain after DNS propagates.

The Sanwaliya trust `custom_domain` is set via migration `20260606120000_sanwaliya_custom_domain` (runs on deploy).

### Sanwaliya client domain checklist

| Step | Action |
|------|--------|
| Compose | `SERVICE_FQDN_APP_3000` in `docker-compose.yaml` (in repo) |
| DNS | `CNAME manage.sanwaliyasethdeoli.in` → Coolify server |
| Coolify | **Domains for app** = both URLs comma-separated |
| Deploy | Redeploy until status is **Running** (not “unapplied changes”) |
| Verify | `https://manage.sanwaliyasethdeoli.in/admin/login` |

---

## Step 7 — Deploy

Click **Deploy**. First build takes ~3–5 minutes (npm install + admin build).

### Verify

| URL | Expected |
|-----|----------|
| `https://erp.fastlegal.in/api/v1/health` | `{"status":"ok",...}` |
| `https://erp.fastlegal.in/admin/login` | Login page |
| `https://erp.fastlegal.in/admin/login?tenant=sanwaliya-seth-deoli` | Trust-branded login |

---

## Login URLs after go-live

| Role | URL |
|------|-----|
| Platform admin | `/admin/login` |
| Sanwaliya trust (default URL) | `/admin/login?tenant=sanwaliya-seth-deoli` |
| Sanwaliya trust (custom domain) | `https://manage.sanwaliyasethdeoli.in/admin/login` |
| Demo trust | `/admin/login?tenant=demo-temple-trust` |

Change default passwords immediately in production.

---

## Link from product landing

On [sanstha.fastlegal.in](https://sanstha.fastlegal.in), point buttons to:

- Demo: `https://erp.fastlegal.in/admin/login?tenant=demo-temple-trust`
- Client login: `https://erp.fastlegal.in/admin/login?tenant=YOUR-SLUG`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Ensure `DIRECT_URL` is set; check Supabase IP allowlist (disable restrict if needed) |
| `P1001` can't reach database | Use pooled URL for `DATABASE_URL`, direct for `DIRECT_URL` |
| Admin 404 | Check build logs — `npm run admin:build` must succeed |
| Custom domain 404 | Add hostname in Coolify **Domains** (CNAME alone is not enough) |
| Custom domain login not branded | Confirm migration ran; `custom_domain` on trust in DB |
| Login works but PDFs missing after redeploy | Add volume on `/app/backend/uploads` |
| CORS errors from temple public site | Set `PUBLIC_WEBSITE_URL=https://sanwaliyasethdeoli.in` and redeploy |
| CORS errors from landing site | Set `APP_URL` and `ADMIN_URL` to your ERP domain |

---

## Local Docker test (optional)

```bash
docker build -t sansta-erp .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e DIRECT_URL="..." \
  -e JWT_SECRET="local-test-secret-minimum-32-chars-long" \
  -e APP_URL=http://localhost:3000 \
  -e ADMIN_URL=http://localhost:3000 \
  -e PUBLIC_URL=http://localhost:3000 \
  -e TENANT_BASE_DOMAIN=localhost \
  -e TENANT_URL_PROTOCOL=http \
  sansta-erp
```
