# Product Context - Handover & Product Vision

## Product Purpose & Value Proposition
This project is an enterprise-grade, **white-label Custom Domain Link Shortener SaaS platform** built to be delivered directly to third-party clients or operated as a standalone product. It provides:

- **Complete Brand Isolation**: Custom domains allow end-users or clients to brand short URLs with their own corporate domain names.
- **Zero-Deploy Scalability**: Admins and clients can add thousands of custom domains dynamically through the Web UI or API without needing to restart servers, deploy code, or edit Nginx/Coolify configuration.
- **Dual Microservice Security**: The shortener engine is physically isolated from the management portal, preventing short link visitors from discovering or accessing the admin dashboard.
- **Developer First**: Fully featured REST API with live API keys (`sl_live_...`), automated DNS CNAME/TXT validation, and instant QR code generation.

---

## Target Audience & Deployment Model
- **Target Audience**: Digital marketing agencies, SaaS platforms, enterprise teams, and individual developers needing branded link shortening.
- **Deployment Model**: Coolify / Docker Compose containerized deployment connecting to a PostgreSQL or Supabase database instance.
