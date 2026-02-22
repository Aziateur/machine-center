#!/bin/bash
# ─────────────────────────────────────────────────────
# serve-stable.sh — Serve the stable production build
#
# Serves the /stable directory on port 4173
# This is the "always works" version.
#
# Usage:
#   npm run stable
#   ./scripts/serve-stable.sh
# ─────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STABLE_DIR="$PROJECT_DIR/stable"

if [ ! -d "$STABLE_DIR" ]; then
    echo ""
    echo "⚠️  No stable build found!"
    echo ""
    echo "Run this first:"
    echo "  npm run promote"
    echo ""
    exit 1
fi

# Kill any existing process on port 4173
kill $(lsof -ti:4173) 2>/dev/null
sleep 0.5

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  🟢 Machine Center — STABLE             ║"
echo "║     http://localhost:4173               ║"
echo "║                                          ║"
echo "║  This is the production build.           ║"
echo "║  It only changes when you promote.       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Serve using npx serve (zero-config static server)
npx -y serve "$STABLE_DIR" -l 4173 -s
