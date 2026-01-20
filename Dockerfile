# Hugging Face Spaces Dockerfile
# Single container running both frontend and backend
# Requires external PostgreSQL (Neon, Supabase, etc.)

FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
RUN bun install --frozen-lockfile

# Build frontend
FROM base AS frontend-builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY . .
WORKDIR /app/frontend
ENV VITE_API_URL=
RUN bun run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860

# Copy backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY shared ./shared
COPY package.json ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Nginx config for HF Spaces
RUN echo 'server { \
    listen 7860; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    location /api { \
        proxy_pass http://127.0.0.1:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    location /health { \
        proxy_pass http://127.0.0.1:3000; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Supervisor config to run both nginx and backend
RUN echo '[supervisord] \n\
nodaemon=true \n\
\n\
[program:nginx] \n\
command=nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0 \n\
\n\
[program:backend] \n\
command=bun run backend/src/index.ts \n\
directory=/app \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0' > /etc/supervisor/conf.d/app.conf

# Create startup script
RUN echo '#!/bin/bash \n\
# Run migrations if DATABASE_URL is set \n\
if [ -n "$DATABASE_URL" ]; then \n\
  echo "Running database migrations..." \n\
  cd /app/backend && bun run db:migrate || echo "Migration failed or already applied" \n\
fi \n\
\n\
# Start supervisor \n\
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:7860/health || exit 1

CMD ["/app/start.sh"]
