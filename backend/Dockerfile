# Backend Dockerfile - Bun runtime
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
# Copy all workspace package.json files
COPY package.json bun.lock* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
RUN bun install --frozen-lockfile

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source code
COPY backend ./backend
COPY shared ./shared
COPY package.json ./

WORKDIR /app/backend

# Expose port
EXPOSE 3000

# Health check using bun fetch
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the app
CMD ["bun", "run", "src/index.ts"]
