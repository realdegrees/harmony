# Development Dockerfile for the Bun app server
# Source code is mounted via volumes - no COPY of src here
FROM oven/bun:latest

WORKDIR /app

# Install ffmpeg for audio/image processing and development utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
        procps \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests for dependency installation
# Source code will be mounted at runtime via docker-compose volumes
COPY package.json bunfig.toml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY media/package.json ./media/
COPY desktop/package.json ./desktop/

# Install all workspace dependencies
RUN bun install

COPY docker/app.dev/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]
