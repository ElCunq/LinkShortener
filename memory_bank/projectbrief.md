# Project Brief - Link Shortener SaaS (Dual Microservice Architecture)

## Overview
The goal of this project is to build a high-performance, white-label, developer-friendly **Bitly-like Link Shortener SaaS API & Service**. It supports **custom domains** (e.g., `link.client.com`), automated **DNS CNAME and TXT verification**, **live auto-updating click analytics**, **JWT and API key authentication**, **QR code generation**, and ultra-fast HTTP 301/302 redirection across a **Dual Microservice Architecture**.

---

## Core Requirements & System Architecture

### 1. Dual Microservice Architecture (`admin-panel` & `shortener-engine`)
- **`admin-panel`**: Serves the Web Dashboard UI, User Auth, API Key generation, Analytics, and REST API endpoints. (`APP_MODE=admin`)
- **`shortener-engine`**: Lightweight service dedicated exclusively to HTTP 301/302 link redirects. Root `/` returns a clean 404 page. Admin portal is **NEVER** accessible on shortener domains. (`APP_MODE=shortener`)

### 2. 100% Portable White-Label Design
- **Zero Hardcoded Domains**: No internal domain strings (e.g. `orfa.dev`) in source code or compose files.
- **Dynamic Configuration**: `/api/v1/config` endpoint serves dynamic domain configuration to the frontend at runtime.
- **Coolify Zero-Config Deployment**: Coolify FQDN injection (`SERVICE_FQDN_LINK_SHORTENER`) automatically maps 1st FQDN = `admin-panel` and 2nd FQDN = `shortener-engine`.

### 3. User & API Key Authentication
- Email/password registration, login, refresh token, logout via JWT.
- Developer API Keys (`sl_live_...`) hashed with SHA-256 for secure database storage. Header format: `Authorization: Bearer sl_live_...`.

### 4. Custom Domain & 0-Deploy System
- Users register custom domains/subdomains (e.g. `link.user.com`).
- Automatic DNS verification via CNAME and TXT tokens (`_shortlink-verification.<domain>`).
- **%100 Deploysuz**: Adding 1,000s of customer custom domains requires **ZERO Coolify deploys or server restarts**.

### 5. Live Click Analytics & QR Code Generator
- **Live Stream**: Click analytics and visitor device breakdowns auto-update every 5 seconds without page refresh (F5).
- **QR Code Generator**: Generates high-resolution PNG QR codes for every short link with 1-click modal view and download.
- **Cascade Delete**: Deleting links/domains automatically cleans up associated `click_events` to satisfy PostgreSQL FK constraints.

### 6. Security & Anti-Phishing
- Restricts target URLs to `http://` and `https://`. Blocks `javascript:`, `data:`, `localhost`, and private IPs (`127.0.0.1`, `10.x`, `192.168.x`).
- IP addresses are anonymized before storing in click analytics.
