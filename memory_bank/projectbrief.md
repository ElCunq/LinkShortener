# Project Brief - Link Shortener SaaS API & Service

## Overview
The goal of this project is to build a high-performance, developer-friendly **Bitly-like Link Shortener SaaS API & Service** with support for **custom domains** and subdomains (e.g. `go.orfa.dev`, `link.user.com`), automated **DNS CNAME and TXT verification**, **click analytics**, **JWT and API key authentication**, and fast HTTP 301/302 redirection.

## Core Requirements
1. **User Authentication**: Email/password registration, login, refresh token, logout.
2. **API Keys**: Ability to issue live API keys (`sl_live_...`) for developer integration, storing only SHA-256 hashes in the database.
3. **Custom Domain System**:
   - User adds domain (e.g. `go.orfa.dev`).
   - System returns required CNAME target (`domains.shortlink-service.com`) and random TXT ownership token (`_shortlink-verification.go`).
   - Automated DNS verification transitions domain status: `pending` -> `verified` -> `active`.
4. **Short Link Management**:
   - Create short links with target URL, auto-generated or custom slug, 301/302 redirect choice, and optional expiration date.
   - Enforce uniqueness: `UNIQUE(domain_id, slug)`.
5. **Redirect Engine**:
   - Fast lookup using incoming `Host` header and URL path slug.
   - Caching layer with cache invalidation on link updates.
   - Non-blocking asynchronous click event tracking.
6. **Security & Anti-Phishing**:
   - Restrict destination URLs to `http://` and `https://` only.
   - Block malicious/dangerous URL schemes (`javascript:`, `data:`).
   - Anti-SSRF protection blocking loopback and private IP targets (`127.0.0.1`, `10.x`, `192.168.x`).
   - Hash IP addresses for visitor privacy.
7. **Database Target**:
   - Integrates directly with Supabase / PostgreSQL hosted on `db.orfa.dev`.
