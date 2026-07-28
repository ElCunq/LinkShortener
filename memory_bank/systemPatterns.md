# System Patterns & Architecture

## Dual Microservice Architecture

```text
               ┌─────────────────────────────────────────┐
               │ Coolify Ingress (Traefik Reverse Proxy) │
               └────────────────────┬────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│        admin-panel           │          │       shortener-engine       │
│      (APP_MODE=admin)        │          │     (APP_MODE=shortener)    │
├──────────────────────────────┤          ├──────────────────────────────┤
│ • Web Dashboard UI (public/) │          │ • HTTP 301/302 Redirect Engine│
│ • User Auth & JWT Routes     │          │ • Root / returns 404 Page    │
│ • Live API Keys (/api-keys)  │          │ • Admin Panel Unaccessible   │
│ • Domain Management & DNS    │          │ • Non-blocking Async Clicks  │
│ • REST API Endpoints         │          └──────────────┬───────────────┘
└──────────────┬───────────────┘                         │
               │                                         │
               └────────────────────┬────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │ PostgreSQL / Supabase Engine│
                     └─────────────────────────────┘
```

---

## Core System Patterns & Design Decisions

### 1. Dual-Mode Server Pattern (`src/app.ts`)
- The single codebase runs in 2 distinct modes depending on `APP_MODE`:
  - `APP_MODE=admin`: Mounts static UI assets, API rate limiter, `/api/v1/*` routes, and root dashboard.
  - `APP_MODE=shortener`: Serves only redirect routing (`/:slug`) and returns 404 for root `/`.

### 2. Dual Authentication Pattern (`src/middleware/auth.ts`)
- Accepts standard JWT Bearer tokens (`Authorization: Bearer eyJhbG...`).
- Accepts live API Keys (`Authorization: Bearer sl_live_...`).
- API keys are hashed via SHA-256 before database lookup to prevent credential exposure in DB dumps.

### 3. Cascade Deletion Pattern (`src/services/dataService.ts` & `src/services/supabaseService.ts`)
- Before deleting a `short_link`, associated `click_events` rows are deleted first.
- Before deleting a `domain`, associated `click_events` and `short_links` rows are deleted first.
- Satisfies PostgreSQL foreign key constraints (`23503`) across both direct PG pool connection and Supabase REST API.

### 4. Dynamic Live Stream Analytics Pattern (`public/app.js`)
- `startLiveAnalyticsPolling()` executes `fetchLinksSilently()` every 5 seconds.
- Updates state, analytics dropdown, total clicks, and device/browser/referrer charts in place without triggering page refresh (F5).

### 5. Safe Response Parsing Pattern (`public/app.js`)
- `apiGet`, `apiPost`, `apiDelete` use `await res.text()` followed by `try { JSON.parse(text) }` to prevent empty 204/200 responses from throwing `SyntaxError: Unexpected end of JSON input`.
