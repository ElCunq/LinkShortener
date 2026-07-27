# System Patterns & Architecture

## System Architecture

```text
Visitor / API Client
        │
        ▼
   Express App (src/app.ts)
   ├── Security & Helmet Headers
   ├── Global Rate Limiter
   ├── REST API Routers (/api/v1/*)
   │     ├── /auth       (JWT Register/Login/Refresh)
   │     ├── /domains    (DNS Verification & Management)
   │     ├── /links      (Short link CRUD & Analytics)
   │     └── /api-keys   (Live API Keys generation)
   │
   └── Redirect Router (GET /:slug)
         │
         ▼
    RedirectService (Cache Lookup)
         │
         ├── [Hit]  ──► 301/302 Redirect + Async Click Event Logger
         └── [Miss] ──► Query Database (db.orfa.dev Supabase PostgreSQL)
```

## Core Patterns & Design Decisions

### 1. Dual Authentication Pattern (`src/middleware/auth.ts`)
- Accepts standard JWT Bearer tokens (`Authorization: Bearer eyJhbG...`).
- Accepts live API Keys (`Authorization: Bearer sl_live_...`).
- API keys are hashed via SHA-256 before database lookup to prevent plaintext credential exposure in DB dumps.

### 2. DNS Verification State Machine (`src/services/dnsService.ts`)
- Domain states: `pending` -> `verified` -> `active`.
- TXT Record: `_shortlink-verification.<hostname>` containing random hex token.
- CNAME Record: `<hostname>` pointing to `CNAME_TARGET`.
- Prevents domain hijacking by requiring random TXT token match before domain activation.

### 3. Database Connection & Schema (`src/db/connection.ts` & `src/db/schema.sql`)
- Connects to Supabase / PostgreSQL database at host `db.orfa.dev`.
- Tablolar:
  - `users`: User credentials and status.
  - `domains`: Custom domain hostnames, verification tokens, SSL status.
  - `short_links`: Slug mapping, target URLs, expiration dates. `CONSTRAINT unique_domain_slug UNIQUE(domain_id, slug)`.
  - `click_events`: Analytics records with browser, OS, device, referrer, and hashed IP.
  - `api_keys`: Developer keys, key hashes, last used timestamp.

### 4. Non-Blocking Asynchronous Click Tracking (`src/services/redirectService.ts`)
- Click analytics recording runs asynchronously via `setImmediate()` during HTTP redirects.
- Ensures analytics database writes never delay visitor redirect response time.
