# California Government Intelligence Platform

## Project Overview

A Next.js intelligence tool for State of California government departments to upload, store, categorize, summarize, and analyze government documents — contracts, budgets, upcoming projects, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Auth | Clerk |
| Database | PostgreSQL on Railway |
| Payments | Stripe |
| Email | Resend |
| Deployment | Railway |
| AI Analysis | Anthropic Claude API (`claude-sonnet-4-6`) |
| Styling | Tailwind CSS |

---

## Service Accounts & Config

### 🚂 Railway (Hosting)
- **Dashboard:** https://railway.app/dashboard
- **Config file:** `railway.toml`
- **Build:** Nixpacks (auto-detected Next.js)
- **Start command:** `npm run start`
- **Health check:** `GET /api/health`
- **Steps to deploy:**
  1. Connect GitHub repo in Railway dashboard
  2. Add all env vars from `.env.local.example`
  3. Deploy — Railway auto-builds on every push

### 🔐 Clerk (Authentication)
- **Dashboard:** https://dashboard.clerk.com
- **Keys needed:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Middleware:** `middleware.ts` — protects all routes except `/`, `/sign-in`, `/sign-up`, `/api/stripe/webhook`
- **Sign-in page:** `/sign-in` → `app/sign-in/[[...sign-in]]/page.tsx`
- **Sign-up page:** `/sign-up` → `app/sign-up/[[...sign-up]]/page.tsx`
- **User ID:** Clerk `userId` is used as the foreign key in PostgreSQL `documents` and `subscriptions` tables
- **Setup steps:**
  1. Create app in Clerk dashboard
  2. Copy publishable key + secret key to env vars
  3. Set allowed redirect URLs to your Railway domain

### 💳 Stripe (Payments)
- **Dashboard:** https://dashboard.stripe.com
- **Keys needed:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Webhook endpoint:** `POST /api/stripe/webhook` (must be public — excluded from Clerk middleware)
- **Plans:**

| Plan | Price | Env Var |
|------|-------|---------|
| Starter | $49/mo | `STRIPE_PRICE_STARTER` |
| Pro | $149/mo | `STRIPE_PRICE_PRO` |
| Enterprise | Custom | `STRIPE_PRICE_ENTERPRISE` |

- **Setup steps:**
  1. Create 3 products in Stripe Dashboard → Products
  2. Copy price IDs to env vars
  3. Register webhook: `https://your-railway-domain.up.railway.app/api/stripe/webhook`
  4. Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`

### 📧 Resend (Email)
- **Dashboard:** https://resend.com
- **Keys needed:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`
- **Email templates** in `lib/resend.ts`:
  - `sendWelcomeEmail()` — on sign-up
  - `sendDocumentProcessedEmail()` — when AI finishes analyzing a doc
  - `sendSubscriptionEmail()` — on Stripe checkout.session.completed
- **Setup steps:**
  1. Add and verify your sending domain in Resend dashboard
  2. Create API key
  3. Set `RESEND_FROM_EMAIL` to a verified address (e.g. `noreply@yourdomain.com`)

### 🗄️ PostgreSQL (Database)
- **Hosting:** Railway
- **Dashboard:** https://railway.app/dashboard
- **Connection:** PostgreSQL database on Railway with public endpoint
- **Key needed:** `DATABASE_URL` (connection string)
- **Schema:** `castateintel` for this project
- **Setup steps:**
  1. Create PostgreSQL database in Railway dashboard
  2. Get connection string from Railway
  3. Set `DATABASE_URL` env var with the PostgreSQL connection string
  4. Run migrations via `npm run migrate` or direct SQL execution

---

## Database Schema

### `documents` table
```sql
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  file_type     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  public_url    TEXT,
  category      TEXT DEFAULT 'uncategorized',
  department    TEXT,
  fiscal_year   TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','error')),
  summary       TEXT,
  tags          TEXT[],
  uploaded_by   TEXT,   -- Clerk userId
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `subscriptions` table
```sql
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 TEXT NOT NULL UNIQUE,   -- Clerk userId
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  plan                    TEXT DEFAULT 'free',
  status                  TEXT DEFAULT 'inactive',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### `upload_sessions` table
```sql
CREATE TABLE upload_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_name  TEXT,
  document_ids  UUID[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Project File Structure

```
ca-gov-intel/
├── app/
│   ├── layout.tsx                    # Root layout with ClerkProvider
│   ├── globals.css                   # Tailwind + custom CSS vars
│   ├── sign-in/[[...sign-in]]/       # Clerk sign-in
│   ├── sign-up/[[...sign-up]]/       # Clerk sign-up
│   ├── dashboard/
│   │   ├── layout.tsx                # Sidebar nav
│   │   └── page.tsx                  # Stats overview
│   ├── billing/page.tsx              # Stripe plans UI
│   └── api/
│       ├── health/route.ts           # Railway health check
│       ├── documents/route.ts        # Upload + list documents
│       └── stripe/
│           ├── checkout/route.ts     # Create Stripe checkout session
│           └── webhook/route.ts      # Stripe webhook handler
├── lib/
│   ├── db.ts                         # PostgreSQL connection pool
│   ├── stripe.ts                     # Stripe client + plan config
│   └── resend.ts                     # Email templates
├── middleware.ts                     # Clerk route protection
├── railway.toml                      # Railway deployment config
├── migrations/
│   └── migration_contact_enrichment.sql  # Database schema migrations
├── .env.local.example                # All required env vars
├── tailwind.config.js
└── next.config.js
```

---

## Supported File Types

PDFs, Word (.docx), Excel (.xlsx), Images (.jpg, .png), PowerPoint (.pptx)

## Document Categories

Contract Awards · Upcoming Projects · Budget Data · Uncategorized

## Brand / Design Tokens

```
Navy:   #1B2A4A  (primary, sidebar, buttons)
Gold:   #C4960A  (accent, logo)
Sky:    #2D7DD2  (links, highlights, hover)
Slate:  #4A5568  (secondary text)
Cream:  #F7F5F0  (background)
Border: #DDE1E9
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@shuttle.proxy.rlwy.net:port/railway

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=CA Gov Intelligence

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app
```

---

## Local Development

```bash
git clone <your-repo>
cd ca-gov-intel
npm install
cp .env.local.example .env.local
# Fill in all env vars
npm run dev
# Open http://localhost:3000
```

---

## Roadmap

- [x] Contact enrichment (AI research from free public sources)
- [x] Excel export of enriched contacts
- [ ] Document AI summarization (Anthropic API)
- [ ] Full-text search across document content
- [ ] Auto-categorization on upload
- [ ] Department-level access controls (PostgreSQL RLS)
- [ ] Analytics dashboard (spend by department, contacts by organization)
- [ ] User management (invite team members)
- [ ] Audit log
