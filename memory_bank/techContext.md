# Tech Context - Stack & Deployment Specification

## Technology Stack
- **Language**: TypeScript (Strict Mode, ES2022 / CommonJS output)
- **Runtime**: Node.js v20 (Alpine Docker image)
- **Web Framework**: Express.js 4.x (Dual-mode: `APP_MODE=admin` | `APP_MODE=shortener`)
- **Database**: Supabase / PostgreSQL (Host: `DB_HOST`, Port: `5432`, Driver: `pg`)
- **Authentication**: `jsonwebtoken` (JWT Access/Refresh), `bcryptjs` (password hashing), SHA-256 API Key hashing
- **Security**: `helmet` (CSP disabled for inline assets/redirects), `cors`, `express-rate-limit`
- **QR Engine**: `qrcode` (DataURL generation)
- **Testing**: Jest 29, Supertest 7, `ts-jest` (19/19 passing integration tests)
- **Containerization**: Multi-stage Dockerfile with layer caching & Docker Compose

---

## Commands Specification

```bash
# Install dependencies
npm install

# Start development server with hot-reload
npm run dev

# Run full integration test suite
npm test

# Production build TypeScript to dist/
npm run build

# Start production server
npm start
```

---

## Environment Variables (.env & Coolify Config)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Port | `3000` |
| `NODE_ENV` | Environment mode | `production` |
| `APP_MODE` | Microservice mode (`admin` \| `shortener`) | `admin` |
| `DB_HOST` | PostgreSQL Host | Required |
| `DB_PORT` | PostgreSQL Port | `5432` |
| `DB_USER` | PostgreSQL Username | `postgres` |
| `DB_PASSWORD` | PostgreSQL Password | Required |
| `DB_NAME` | PostgreSQL Database Name | `postgres` |
| `DB_SSL` | Enable SSL for DB pool | `false` |
| `JWT_SECRET` | JWT Access Token Signing Key | Required |
| `JWT_EXPIRES_IN` | Access Token Lifetime | `1h` |
| `JWT_REFRESH_SECRET` | JWT Refresh Token Signing Key | Required |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token Lifetime | `7d` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST URL | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Key | Optional |

*Note: Zero domain environment variables are required. Domains are auto-detected from Coolify FQDN injection or request headers.*
