#!/usr/bin/env bash
# =============================================================================
# Harmony - Local Development Setup
# =============================================================================
# Run once after cloning to prepare your local environment.
# Assumes PostgreSQL and Redis are already installed and running.
# =============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${BOLD}${GREEN}==>${RESET} $*"; }
warn()    { echo -e "${YELLOW}Warning:${RESET} $*"; }
error()   { echo -e "${RED}Error:${RESET} $*" >&2; exit 1; }

echo ""
echo -e "${BOLD}Setting up Harmony development environment...${RESET}"
echo ""

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

command -v bun >/dev/null 2>&1 \
  || error "bun is required but not found. Install from https://bun.sh"

command -v node >/dev/null 2>&1 \
  || warn "node not found. The media server (tsx) requires Node.js."

command -v ffmpeg >/dev/null 2>&1 \
  || warn "ffmpeg not found. Audio/image conversion will not work."

command -v psql >/dev/null 2>&1 \
  || warn "psql not found. Make sure PostgreSQL is running and accessible."

command -v redis-cli >/dev/null 2>&1 \
  || warn "redis-cli not found. Make sure Redis is running on port 6379."

# ---------------------------------------------------------------------------
# Environment file
# ---------------------------------------------------------------------------
info "Configuring environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
  echo "  Edit .env with your local database credentials if needed."
else
  echo "  .env already exists — skipping copy."
fi

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
info "Installing dependencies..."
bun install

# ---------------------------------------------------------------------------
# Upload directories
# ---------------------------------------------------------------------------
info "Creating upload directories..."
mkdir -p uploads/avatars uploads/emojis uploads/sounds uploads/attachments
echo "  uploads/ structure ready."

# ---------------------------------------------------------------------------
# Prisma client
# ---------------------------------------------------------------------------
info "Generating Prisma client..."
(cd backend && bunx prisma generate)

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}Setup complete!${RESET}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Ensure PostgreSQL is running and create the database:"
echo "       createdb -U harmony harmony"
echo "     (or adjust DATABASE_URL in .env to match your local setup)"
echo ""
echo "  2. Ensure Redis is running on port 6379."
echo ""
echo "  3. Apply database migrations:"
echo "       cd backend && bunx prisma migrate dev"
echo ""
echo "  4. (Optional) Seed the database:"
echo "       cd backend && bun run db:seed"
echo ""
echo "  5. Start the stack — pick one of:"
echo ""
echo "     a) VSCode: open the Run & Debug panel and launch 'Full Stack'"
echo ""
echo "     b) Manually in separate terminals:"
echo "          Terminal 1: bun run backend/src/index.ts"
echo "          Terminal 2: bun --filter @harmony/frontend dev"
echo "          Terminal 3: npx tsx media/src/index.ts"
echo ""
