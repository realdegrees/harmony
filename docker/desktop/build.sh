#!/usr/bin/env bash
# =============================================================================
# Harmony Desktop Build Script (runs inside the build container)
# =============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}==>${RESET} ${BOLD}$*${RESET}"; }
ok()   { echo -e "${GREEN}✓${RESET} $*"; }

echo ""
echo -e "${BOLD}Harmony Desktop Builder${RESET}"
echo "Rust: $(rustc --version)"
echo "Bun:  $(bun --version)"
echo ""

# ---------------------------------------------------------------------------
# 1. Install JS/TS workspace dependencies
# ---------------------------------------------------------------------------
step "Installing dependencies..."
bun install --frozen-lockfile
ok "Dependencies installed"

# ---------------------------------------------------------------------------
# 2. Build the shared package (types, constants, validation)
# ---------------------------------------------------------------------------
step "Building shared package..."
bun run build:shared
ok "Shared package built"

# ---------------------------------------------------------------------------
# 3. Build the SvelteKit frontend with adapter-static
#    This produces frontend/build/ which Tauri bundles into the binary
# ---------------------------------------------------------------------------
step "Building frontend (static adapter)..."
BUILD_ADAPTER=static bun --filter @harmony/frontend build
ok "Frontend built → frontend/build/"

# ---------------------------------------------------------------------------
# 4. Build the Tauri desktop app
#    Outputs to: desktop/src-tauri/target/release/bundle/
#    - Linux: .deb, .AppImage, .rpm
# ---------------------------------------------------------------------------
step "Building Tauri desktop app (this takes a while on first run)..."
cd desktop
# Skip the beforeBuildCommand — we already built everything above
bun run tauri build
cd ..

# ---------------------------------------------------------------------------
# 5. Copy artifacts to /workspace/dist/desktop/ for easy retrieval
# ---------------------------------------------------------------------------
step "Collecting artifacts..."
mkdir -p /workspace/dist/desktop

find desktop/src-tauri/target/release/bundle \
    \( -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" \) \
    -exec cp -v {} /workspace/dist/desktop/ \;

echo ""
ok "Done! Artifacts are in: ./dist/desktop/"
ls -lh /workspace/dist/desktop/
echo ""
