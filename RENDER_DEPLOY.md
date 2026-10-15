# 🚀 MediCare — Deployment Guide for Render (Free Tier)

This guide walks you through deploying the MediCare dashboard backend to **Render's Free Tier** from a clean ZIP / GitHub repo.

---

## 📋 What this project is

| Item | Value |
|------|-------|
| Framework | **Next.js 16** (App Router, standalone output) |
| Language | TypeScript |
| Database | **Prisma + Turso** (libSQL) in production, local SQLite for dev |
| Auth | JWT (`jsonwebtoken` + `bcryptjs`) |
| UI | Tailwind CSS 4 + shadcn/ui |
| Runtime on Render | **Node.js** (NOT Bun — Render's Node runtime has no Bun) |
| Entry point | `.next/standalone/server.js` (after build) |

---

## ✅ Prerequisites

1. A **GitHub** account and a repo containing this project (or upload the ZIP via Render's "Upload a Repository" feature).
2. A free **Turso** account → https://turso.tech
3. A free **Render** account → https://render.com

---

## 1) Provision the Turso database

From your local terminal (after `npm install -g @turso/cli` and `turso auth login`):

```bash
turso db create medicare
turso db show medicare --url        # → e.g. libsql://medicare-<user>.turso.io
turso db tokens create medicare     # → eyJ...  (long JWT)
```

Save both — you'll paste them into Render.

Initialize the schema (one-time):

```bash
# From the project root, with DATABASE_URL pointing to Turso:
TURSO_DATABASE_URL='libsql://medicare-<user>.turso.io' \
TURSO_AUTH_TOKEN='eyJ...' \
  npx prisma db push

# Optional — seed demo data:
TURSO_DATABASE_URL='libsql://medicare-<user>.turso.io' \
TURSO_AUTH_TOKEN='eyJ...' \
ADMIN_PHONE=01000000000 ADMIN_PASSWORD=admin123 \
  npx tsx scripts/seed.ts
```

---

## 2) Deploy on Render

### Option A — Blueprint (recommended, automated)

1. Push the project to GitHub (the repo root must contain `render.yaml`).
2. Go to the Render dashboard → **New +** → **Blueprint**.
3. Select your repository. Render reads `render.yaml` and creates the web service automatically.
4. In the **Environment** tab of the new web service, fill in the four secret env vars (they're marked `sync: false` in `render.yaml`):

| Key | How to get it |
|-----|---------------|
| `TURSO_DATABASE_URL` | `turso db show medicare --url` |
| `TURSO_AUTH_TOKEN` | `turso db tokens create medicare` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_BACKUP_PASSCODE` | Any strong string you choose |

5. (Optional) Set Telegram/WhatsApp vars — or leave them empty and configure later from the admin UI.
6. Click **Save** → Render will build and deploy. The first build takes ~3–5 min.
7. Once live, visit `https://<your-service>.onrender.com/health` — should return `{"success":true,...}`.

### Option B — Manual (no `render.yaml`)

1. Render dashboard → **New +** → **Web Service** → connect your repo.
2. Configure:
   - **Runtime**: Node
   - **Plan**: Free
   - **Build Command**: `npm install && DATABASE_URL=file:./db/dummy.db npx prisma generate && npm run build`
   - **Start Command**: `HOSTNAME=0.0.0.0 node .next/standalone/server.js`
   - **Health Check Path**: `/health`
3. Add the same env vars listed above.
4. Click **Create Web Service**.

---

## 3) Verify the deployment

After the build finishes and the service starts:

| Check | URL | Expected |
|-------|-----|---------|
| Health | `https://<app>.onrender.com/health` | `{"success":true,...}` |
| Login | `https://<app>.onrender.com/` | Login screen |
| API | `POST https://<app>.onrender.com/api/v1/auth/doctor-login` with `{"phone_number":"01000000000","password":"admin123"}` | `{"success":true,"data":{"token":...}}` |

If you ran the seed against Turso, login with `01000000000` / `admin123`.

---

## 4) ⚠️ Render Free Tier — Known limitations & workarounds

### a) Spin-down on inactivity (15 min)
Render's free web services **sleep after 15 minutes** with no traffic. The first request after sleep takes ~30–60 s to wake the service.

**Workarounds (pick one):**

| Option | Pros | Cons |
|--------|------|------|
| **External pinger** (UptimeRobot / cron-job.org / BetterStack) — ping `https://<app>.onrender.com/health` every 10 min | Free, no Render resources used, no account limits consumed | Requires a 3rd-party account |
| **Render Cron Job** — uncomment the `medicare-keepalive` block in `render.yaml` and set `RENDER_EXTERNAL_URL` | Stays within Render | Uses your 1 free cron-job slot |
| Accept spin-down — first request after idle takes ~30 s | Simplest, no extra setup | Slow first load for users |

For most users we recommend **UptimeRobot** (free, simple, no Render account limits):
1. Go to https://uptimerobot.com → create a free account.
2. Add a new monitor → type **HTTP(s)**, friendly name `MediCare`, URL `https://<app>.onrender.com/health`, interval **10 minutes**.
3. Done. The service stays warm indefinitely.

### b) Ephemeral filesystem
Render's free tier has an **ephemeral disk** — anything written to disk is **lost on redeploy**. That's why this project uses **Turso** (an external hosted DB) for production data. **Do not** rely on local SQLite files on Render.

### c) 512 MB RAM
The free tier has a 512 MB memory limit. Next.js 16 standalone + Prisma + a few requests comfortably fits. If you hit OOM during build, add this env var to limit Node heap during build:

```
NODE_OPTIONS=--max-old-space-size=460
```

### d) Build minutes
The free tier gives 750 build minutes/month — more than enough for typical iteration. Each build uses ~3–5 min.

---

## 5) Updating the app after first deploy

- Push to your repo's `main` branch → Render auto-deploys (if `autoDeploy: true`, which is the default in `render.yaml`).
- To trigger a manual redeploy: Render dashboard → your service → **Manual Deploy** → **Deploy latest commit**.

---

## 6) Local development (optional)

```bash
npm install
cp .env.example .env       # edit .env (set JWT_SECRET at minimum)
npx prisma generate
npx prisma db push         # creates local SQLite
npx tsx scripts/seed.ts    # optional demo data
npm run dev                # http://localhost:3000
```

> Note: `npm run dev` uses Turbopack and consumes ~1.5–2 GB RAM locally. If memory-constrained, use `next dev --no-turbopack`.

---

## 7) Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails on `prisma generate` | `DATABASE_URL` empty | It's already set to `file:./db/dummy.db` in `render.yaml` buildCommand. Verify you didn't override it. |
| Start fails with `EADDRINUSE` | `HOSTNAME` not set | Verify startCommand has `HOSTNAME=0.0.0.0`. |
| Login returns 500 | Turso env vars missing or wrong | Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Render dashboard. |
| First request after idle takes ~30 s | Free tier spin-down | Set up an external keep-alive ping (see §4a). |
| `Cannot find module '@prisma/client'` in production | Prisma client not bundled into standalone | Confirm `next build` ran AFTER `npx prisma generate` (it does, per `render.yaml` buildCommand). |

---

## 📦 Quick command reference

| Where | Command | Purpose |
|-------|---------|---------|
| Render | `npm install` | Install dependencies |
| Render | `DATABASE_URL=file:./db/dummy.db npx prisma generate` | Generate Prisma Client |
| Render | `npm run build` | Build Next.js standalone |
| Render | `HOSTNAME=0.0.0.0 node .next/standalone/server.js` | Start the server |
| Local  | `npm install` | Install dependencies |
| Local  | `npm run dev` | Start dev server on :3000 |
| Local  | `npx tsx scripts/seed.ts` | Seed demo data |

---

## 🔐 Security checklist (production)

- [ ] `JWT_SECRET` is a 64-char random hex string (NOT `dev-only-insecure-secret-change-me`).
- [ ] `ADMIN_BACKUP_PASSCODE` is a strong unique string.
- [ ] `TURSO_AUTH_TOKEN` is the production token (not the dev one).
- [ ] Telegram tokens (if used) are set in the dashboard, not in code.
- [ ] Default admin password `admin123` has been changed after first login.

---

Happy deploying! For full project docs, see [README.md](./README.md).
