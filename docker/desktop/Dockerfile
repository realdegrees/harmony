# =============================================================================
# Harmony Desktop Build Container
# =============================================================================
# Builds the Tauri 2 desktop app for Linux (x86_64) without needing a local
# Rust toolchain. Outputs .deb, .AppImage, and .rpm bundles.
#
# Usage (via docker compose):
#   docker compose -f docker/desktop/docker-compose.build.yml run --rm build
#
# Or directly:
#   docker build -t harmony-desktop-builder -f docker/desktop/Dockerfile .
#   docker run --rm \
#     -v $(pwd):/workspace \
#     -v harmony-cargo-cache:/root/.cargo \
#     -v harmony-rust-target:/workspace/desktop/src-tauri/target \
#     harmony-desktop-builder
# =============================================================================

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV CARGO_HOME=/root/.cargo
ENV RUSTUP_HOME=/root/.rustup
ENV PATH="/root/.cargo/bin:${PATH}"
# Bun install directory
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

# ---------------------------------------------------------------------------
# System dependencies
# Tauri 2 on Linux requires webkit2gtk-4.1 (not 4.0)
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    build-essential \
    pkg-config \
    curl \
    wget \
    git \
    unzip \
    ca-certificates \
    # Tauri 2 webkit requirement
    libwebkit2gtk-4.1-dev \
    # Tauri extras
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    # GTK / GLib (needed for webkit)
    libgtk-3-dev \
    libglib2.0-dev \
    libssl-dev \
    # For AppImage bundling
    file \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Rust stable toolchain
# ---------------------------------------------------------------------------
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal \
    && rustup target add x86_64-unknown-linux-gnu

# ---------------------------------------------------------------------------
# Bun (for building the frontend and workspace deps)
# ---------------------------------------------------------------------------
RUN curl -fsSL https://bun.sh/install | bash

# ---------------------------------------------------------------------------
# Working directory — the repo is mounted here at runtime
# ---------------------------------------------------------------------------
WORKDIR /workspace

# ---------------------------------------------------------------------------
# Build script
# Runs as the container's entrypoint:
#   1. Install JS/TS dependencies
#   2. Build the shared package
#   3. Build the frontend with adapter-static (for Tauri)
#   4. Run tauri build (compiles Rust, bundles frontend)
# ---------------------------------------------------------------------------
COPY docker/desktop/build.sh /build.sh
RUN chmod +x /build.sh

ENTRYPOINT ["/build.sh"]
