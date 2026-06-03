# G6 WhatsApp Business Audit System

A production web app for G6 Labs Asia that audits a client's WhatsApp Business account, scores conversation quality across 7 dimensions, cross-references Meta ad spend (CTWA), and produces a branded PDF report.

---

## Stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS with G6 brand tokens
- PostgreSQL (`pg`) with cookie session auth
- `@react-pdf/renderer` for PDF export
- `papaparse` + `xlsx` for CSV/XLSX parsing
- Self-hosted on a VPS (see [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md))

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or on your VPS)
- A self-hosted [Evolution API v2](https://github.com/EvolutionAPI/evolution-api) instance

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ashokh-commits/whatsapp-audit
cd whatsapp-audit
npm install
```

### 2. Database

```bash
createdb g6audit   # or use your own DB name
export DATABASE_URL="postgresql://localhost:5432/g6audit"
psql "$DATABASE_URL" -f db/migrations/001_schema.sql
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | `openssl rand -hex 32` (≥ 32 chars) |
| `EVOLUTION_API_URL` | Your Evolution API server URL |
| `EVOLUTION_GLOBAL_KEY` | Evolution admin API key |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` |

### 4. Create the first user

```bash
npm run create-user -- you@agency.com 'your-password'
```

### 5. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in.

### 6. Verify Evolution API connection

Visit `/api/health` — it should return JSON with `connected: true` and list your instances.

---

## Evolution API Requirements

- Evolution API v2 must be running and reachable from the app server
- Each client needs a separate **instance** created in Evolution API
- The instance must be in **connected** (`open`) state before running an audit
- You'll need the **instance API key** (not the global key) when adding a client

### Getting the instance key

1. Create an instance in your Evolution API dashboard
2. Connect the WhatsApp QR code
3. Copy the instance API key from the instance settings
4. This key will be encrypted with AES-256-GCM before storage

---

## Meta Ads CSV Export (for CTWA analysis)

To get the Paid Lead Leakage section populated:

1. Open **Meta Ads Manager**
2. Go to **Campaigns** → select your WhatsApp/CTWA campaigns
3. Set the date range to match your audit window
4. Click **Export** → **Export Table Data** → **CSV** or **XLSX**
5. Ensure these columns are included: Campaign name, Ad set name, Ad name, Amount spent, Impressions, Link clicks, Results
6. Upload at **Import Ads** (`/ctwa/import`) and map columns to the audit

---

## VPS deployment

Full SSH guide: **[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md)** — Postgres on the VPS, Nginx, PM2, no Supabase or Vercel.

---

## PDPA 2010 Compliance Notes

- Raw message body text is **never stored** by default (`STORE_RAW=false`)
- Only metadata (timestamps, direction, referral payloads) and computed metrics are persisted
- Consent records are **mandatory** before any audit can run — enforced server-side
- The Compliance Hygiene dimension checks for consent/opt-in language in messages

---

## Project Structure

```
src/
  app/          Next.js App Router pages and API routes
  components/   Reusable UI components (ui/, layout/, audit/, ctwa/, pdf/)
  lib/          Core business logic (evolution.ts, scoring.ts, ctwa.ts, crypto.ts)
  actions/      Server Actions (audit.ts, clients.ts, consent.ts)
  types/        TypeScript type definitions
db/
  migrations/   PostgreSQL schema (VPS / local)
tests/unit/     Jest unit tests for scoring and CTWA logic
```

---

## Running Tests

```bash
npm test            # Run all unit tests
npm run typecheck   # TypeScript type check
npm run lint        # ESLint
```

---

## Adding a G6 Logo

Place your logo file at `public/G6-White.png`. The Sidebar and Login page are already configured to display it. The current placeholder will be replaced automatically once the file is present.

---

## Build smarter. Scale faster.
