# =============================================================================
# Harmony — single-container build
# Bun (backend) + Node.js (mediasoup SFU subprocess) + SvelteKit static frontend
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: dependency install (Bun workspace)
# Uses node:22-bookworm-slim as base so mediasoup's C++ worker can compile.
# We install Bun on top.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Install Bun
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /var/lib/apt/lists/*

# Install build dependencies for mediasoup native C++ worker
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests for layer caching
COPY package.json bun.lock* bunfig.toml* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Install all workspace deps with Bun (handles shared/backend/frontend)
RUN bun install --frozen-lockfile

# Install media deps separately with npm (mediasoup compiles native binaries under Node.js)
COPY media/package.json media/package-lock.json* ./media/
RUN cd media && npm install

# -----------------------------------------------------------------------------
# Stage 2: build frontend (SvelteKit static adapter)
# -----------------------------------------------------------------------------
FROM deps AS frontend-build

COPY package.json bunfig.toml* ./
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
# Stage 4: production runtime image
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS production

WORKDIR /app

# Install Bun in the runtime image
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip ca-certificates tini ffmpeg curl && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /var/lib/apt/lists/*

# Workspace manifests
COPY package.json bunfig.toml* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Runtime node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules 2>/dev/null || true
COPY --from=deps /app/backend/node_modules ./backend/node_modules 2>/dev/null || true

# Media node_modules (includes compiled mediasoup worker)
COPY --from=deps /app/media/node_modules ./media/node_modules

# Application source
COPY shared/ ./shared/
COPY backend/ ./backend/

# Built frontend static assets
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Built media server JS
COPY --from=media-build /app/media/dist ./media/dist
COPY media/package.json ./media/

# Startup script
COPY docker/app/start.sh /start.sh

# Create data directory and non-root user
RUN mkdir -p /data/uploads && \
    groupadd -g 1001 harmony && \
    useradd -u 1001 -g harmony -s /bin/sh -m harmony && \
    chown -R harmony:harmony /app /data/uploads && \
    chmod +x /start.sh

USER harmony

EXPOSE 3000
# RTC ports for mediasoup (must match MEDIASOUP_RTC_MIN/MAX_PORT)
EXPOSE 40000-40100/udp
EXPOSE 40000-40100/tcp

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/start.sh"]
