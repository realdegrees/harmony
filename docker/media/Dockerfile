# mediasoup Node.js media server
# Uses bookworm-slim for glibc compatibility (mediasoup C++ worker requires it)
FROM node:22-bookworm-slim

WORKDIR /app

# Install build dependencies for mediasoup C++ worker compilation
# python3 and build-essential are required by mediasoup's native addon
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        build-essential \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifest and tsconfig first for layer caching
COPY media/package.json ./
COPY media/package-lock.json* ./
COPY media/tsconfig.json ./

# Install ALL deps including devDependencies (tsx, typescript) so we can
# both compile and run TypeScript. mediasoup's C++ worker is also compiled here.
RUN if [ -f package-lock.json ]; then \
        npm ci; \
    else \
        npm install; \
    fi

# Copy media server source
COPY media/src ./src

# Compile TypeScript → dist/ using the project's own tsconfig
RUN node_modules/.bin/tsc --project tsconfig.json

# Create a non-root user for security
RUN groupadd -g 1001 harmony && \
    useradd -u 1001 -g harmony -s /bin/sh -m harmony && \
    chown -R harmony:harmony /app

USER harmony

# Internal HTTP API port (used by the main app server to control mediasoup)
EXPOSE 3001

# RTC media ports (UDP + TCP) - range must match MEDIASOUP_RTC_MIN/MAX_PORT
EXPOSE 40000-40100/udp
EXPOSE 40000-40100/tcp

# Production: run compiled JS
# Dev: docker-compose.dev.yml overrides this with tsx for hot reload
CMD ["node", "dist/index.js"]
