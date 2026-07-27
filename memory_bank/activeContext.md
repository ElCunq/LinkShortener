# Active Context

## Current Status
- **Phase**: MVP Implementation & Verification Completed.
- **Active Database Target**: Supabase / PostgreSQL hosted at `db.orfa.dev`.
- **Test Status**: All 18 automated integration tests passing (`npm test`).
- **Build Status**: TypeScript production compilation clean with zero errors (`npm run build`).

## Recent Key Steps Completed
1. Updated `apiDocumentation.txt` with full API reference and database schema.
2. Implemented database connection module `src/db/connection.ts` and repository `src/services/dataService.ts`.
3. Created security service `src/services/securityService.ts` for anti-SSRF URL validation, API key hashing, and user-agent analytics parsing.
4. Created DNS service `src/services/dnsService.ts` for TXT and CNAME verification.
5. Created Auth (`/api/v1/auth`), Domains (`/api/v1/domains`), Links (`/api/v1/links`), and API Keys (`/api/v1/api-keys`) routes.
6. Implemented fast redirect engine `src/services/redirectService.ts` and wildcard router `GET /:slug` in `src/app.ts`.
7. Created project user guide `README.md`.
8. Created `memory_bank/` documentation system.
9. Built modern **Web Dashboard UI** (`public/index.html`, `public/style.css`, `public/app.js`) with Tailwind CSS and Glassmorphism dark design.
10. **100% Live Supabase REST Integration**: Implemented [`src/services/supabaseService.ts`](file:///home/cunq/Desktop/LinkShortener/src/services/supabaseService.ts) communicating directly over HTTPS with `https://db.orfa.dev/p/link-shortener/`. All operations (`users`, `domains`, `short_links`, `click_events`, `api_keys`) run live against Supabase without needing direct TCP port 5432.
11. Implemented **QR Code Generation Engine** (`src/services/qrService.ts` and `GET /api/v1/links/:id/qrcode`), with 1-click QR modal view & PNG download in the UI.

## Active Decisions & Troubleshooting
- **Cloudflare Error 526 Diagnosis**: When custom subdomain CNAME (e.g. `go.orfa.dev`) targets `db.orfa.dev` in Orange Cloud (Proxied) mode, Cloudflare's **Full (Strict)** SSL mode throws Error 526 if origin SSL does not cover the custom subdomain. Solution: Switch Cloudflare SSL/TLS mode to **Flexible** (or **Full**) so Cloudflare terminates client HTTPS and proxies HTTP/HTTPS to Express backend.
- **100% Supabase REST Mode**: Application queries Supabase REST API at `https://db.orfa.dev/p/link-shortener` using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Bypasses Cloudflare port 5432 TCP blocks.
- **DNS Diagnostics**: DNS verification failures display exact diagnostic reasons (e.g. `queryCname ENODATA go.orfa.dev` or TXT token mismatch) directly to the user.
- **Active Decisions & Troubleshooting**:
    - **Cloudflare Proxy & Port 5432 Diagnosis**: `db.orfa.dev` is proxied behind Cloudflare (IP `104.21.4.137`), which blocks raw PostgreSQL TCP connections on port `5432` (`connect ETIMEDOUT 104.21.4.137:5432`). To connect directly to Postgres on `5432`, use your **direct server origin IP** in `.env` (`DB_HOST=x.x.x.x`) or set `db.orfa.dev` to **DNS Only (Grey Cloud)** in Cloudflare.
    - **Disk Persistence Guarantee**: `src/db/connection.ts` and `src/services/dataService.ts` now automatically persist state to `.memory_db.json` on disk. User registrations and sessions survive process restarts regardless of DB fallback state.
    - **`PGRST202` Error Resolution**: Database tables (`users`, `domains`, `short_links`, `click_events`, `api_keys`) created via **Supabase Studio SQL Editor** at `https://db.orfa.dev/project/link-shortener` using `src/db/schema.sql`.
- Ready for deployment or Next.js dashboard UI integration if requested by user.
