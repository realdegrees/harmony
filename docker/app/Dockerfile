# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:latest AS deps

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bunfig.toml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Install all workspace dependencies
RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Build frontend (SvelteKit static adapter)
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:latest AS frontend-build

WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules 2>/dev/null || true

# Copy source
COPY package.json bunfig.toml ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared first, then frontend
RUN bun run build:shared && bun run build:frontend

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production image
# ─────────────────────────────────────────────────────────────────────────────
FROM oven/bun:alpine AS production

WORKDIR /app

# Install ffmpeg for audio/image processing and ca-certificates for HTTPS
RUN apk add --no-cache ffmpeg ca-certificates tini

# Copy workspace manifests
COPY package.json bunfig.toml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules 2>/dev/null || true
COPY --from=deps /app/backend/node_modules ./backend/node_modules 2>/dev/null || true

# Copy application source
COPY shared/ ./shared/
COPY backend/ ./backend/

# Copy built frontend static assets
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Copy startup script
COPY docker/app/start.sh /start.sh

# Create uploads directory
RUN mkdir -p /data/uploads && \
    addgroup -g 1001 -S harmony && \
    adduser -u 1001 -S harmony -G harmony && \
    chown -R harmony:harmony /app /data/uploads && \
    chmod +x /start.sh

USER harmony

EXPOSE 3000

# Use tini as init to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/start.sh"]
