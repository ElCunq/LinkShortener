# Multi-Stage Dockerfile with Layer Caching for Fast Coolify Deployments

# Stage 1: Build Dependencies & Source
FROM node:20-alpine AS builder
WORKDIR /app

# Step 1: Copy dependency manifests to leverage Docker layer caching
COPY package*.json tsconfig.json ./
RUN npm ci

# Step 2: Copy source and build JavaScript bundle
COPY src ./src
COPY public ./public
RUN npm run build

# Stage 2: Production Lightweight Image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Step 3: Copy manifests and install ONLY production dependencies (cached unless package.json changes)
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Step 4: Copy compiled app and static assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
