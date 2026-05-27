# G6 WhatsApp Business Audit System

A production web app for G6 Labs Asia that audits a client's WhatsApp Business account, scores conversation quality across 7 dimensions, cross-references Meta ad spend (CTWA), and produces a branded PDF report.

---

## Stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS with G6 brand tokens
- Supabase (Postgres + Auth) via `@supabase/ssr`
- `@react-pdf/renderer` for PDF export
- `papaparse` + `xlsx` for CSV/XLSX parsing
- Vercel deployment

---

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- A self-hosted [Evolution API v2](https://github.com/EvolutionAPI/evolution-api) instance
- A Vercel account for deployment

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ashokh-commits/whatsapp-audit
cd whatsapp-audit
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the migrations in order:
   ```
   supabase/migrations/0001_initial_schema.sql
   supabase/migrations/0002_rls_policies.sql
   ```
3. Note your project URL and keys from **Settings → API**

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `EVOLUTION_API_URL` | Your Evolution API server URL |
| `EVOLUTION_GLOBAL_KEY` | Evolution admin API key (in server config) |
| `ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` |

### 4. Seed the first user

No public signup is enabled. Create your first user via the Supabase dashboard:

1. Go to **Authentication → Users** in your Supabase project
2. Click **Add user** → **Create new user**
3. Enter email and password for your agency account

### 5. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in with the user you created.

### 6. Verify Evolution API connection

Visit `/api/health` after signing in — it should return JSON with `connected: true` and list your instances.

---

## Evolution API Requirements

- Evolution API v2 must be running and accessible from your Vercel deployment
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

## Vercel Deployment

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set all environment variables from `.env.example` in Vercel → Settings → Environment Variables
4. Deploy

> **Important:** Vercel Hobby tier has a 60-second serverless function limit. Audits on accounts with many conversations may time out. Vercel Pro (300s limit) is recommended for production use.

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
supabase/
  migrations/   SQL schema and RLS policy migrations
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
