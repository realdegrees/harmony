# =============================================================================
# Harmony — single-container build
# Bun (backend) + Node.js (mediasoup SFU subprocess) + SvelteKit static frontend
# =============================================================================

# Official Bun image — used only to copy the binary so Docker picks the correct
# variant (standard vs baseline) for the target platform automatically.
FROM oven/bun:latest AS bun-source

# -----------------------------------------------------------------------------
# Stage 1: dependencies
# node:22-bookworm-slim as base so mediasoup's C++ worker can compile.
# Bun is installed on top.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Copy Bun binary from official image and install build tools for mediasoup
COPY --from=bun-source /usr/local/bin/bun /usr/local/bin/bun
RUN chmod 755 /usr/local/bin/bun && \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy workspace manifests for layer caching
COPY package.json bun.lock bunfig.toml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Copy Prisma schema before install so postinstall can generate the client
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/

# Install all workspace deps (Bun handles shared/backend/frontend/desktop)
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: build frontend (SvelteKit static adapter)
# -----------------------------------------------------------------------------
FROM deps AS frontend-build

COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN bun run build:shared && \
    cd frontend && BUILD_ADAPTER=static bun run build

# -----------------------------------------------------------------------------
# Stage 3: build media server (TypeScript → dist/)
# -----------------------------------------------------------------------------
FROM deps AS media-build

COPY media/ ./media/

RUN cd media && node_modules/.bin/tsc --project tsconfig.json

# -----------------------------------------------------------------------------
# Stage 4: build backend and generate Prisma client
# -----------------------------------------------------------------------------
FROM deps AS backend-build

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN bun run build:shared && \
    cd backend && \
    DATABASE_URL=file:/data/harmony.db bun x prisma generate && \
    bun run build

# -----------------------------------------------------------------------------
# Stage 5: production runtime image
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS production

WORKDIR /app

# Copy Bun binary from official image; install tini and curl for healthcheck
COPY --from=bun-source /usr/local/bin/bun /usr/local/bin/bun
RUN chmod 755 /usr/local/bin/bun && \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates tini && \
    rm -rf /var/lib/apt/lists/*

# Workspace manifests (needed for Bun workspace resolution at runtime)
COPY package.json bunfig.toml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Runtime node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/media/node_modules ./media/node_modules

# Application source + generated Prisma client
COPY --from=backend-build /app/shared ./shared
COPY --from=backend-build /app/backend ./backend

# Built frontend static assets
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Built media server JS
COPY --from=media-build /app/media/dist ./media/dist
COPY media/package.json ./media/

# Startup script
COPY docker/app/start.sh /start.sh

# Data directory + non-root user
RUN mkdir -p /data/uploads && \
    groupadd -g 1001 harmony && \
    useradd -u 1001 -g harmony -s /bin/sh -m harmony && \
    chown -R harmony:harmony /app /data && \
    chmod +x /start.sh

USER harmony

EXPOSE 3000
EXPOSE 40000-40100/udp
EXPOSE 40000-40100/tcp

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/start.sh"]
