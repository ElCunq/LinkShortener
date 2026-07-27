# Tech Context

## Technology Stack
- **Language**: TypeScript (ES2022 / CommonJS build output)
- **Runtime**: Node.js (v18+)
- **Web Framework**: Express.js 4.x
- **Database**: Supabase / PostgreSQL (Host: `db.orfa.dev`, Port: `5432`, Driver: `pg`)
- **Authentication**: `jsonwebtoken` (JWT), `bcryptjs` (password hashing), SHA-256 API Key hashing
- **Security**: `helmet`, `cors`, `express-rate-limit`
- **Testing**: Jest 29, Supertest 7, `ts-jest`

## Development Commands
```bash
# Install dependencies
npm install

# Start development server with hot-reload
npm run dev

# Run full integration test suite
npm test

# Build TypeScript to production dist/
npm run build

# Start production server
npm start
```

## Environment Variables Configuration (.env)
```env
PORT=3000
NODE_ENV=development
DB_HOST=db.orfa.dev
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_supabase_password
DB_NAME=postgres
DB_SSL=true
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key
JWT_REFRESH_EXPIRES_IN=7d
CNAME_TARGET=domains.shortlink-service.com
SYSTEM_DOMAIN=go.orfa.dev
```
