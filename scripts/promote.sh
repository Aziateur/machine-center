#!/bin/bash
# ─────────────────────────────────────────────────────
# promote.sh — Safely promote dev → stable
#
# What it does:
#   1. Checks for recent data backups
#   2. Type-checks the entire codebase (tsc --noEmit)
#   3. Builds production bundle (vite build)
#   4. If both pass: atomically replaces /stable with new build
#   5. If anything fails: aborts, stable is untouched
#
# Data is NEVER touched — only code files are replaced.
#
# Usage:
#   npm run promote
# ─────────────────────────────────────────────────────

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STABLE_DIR="$PROJECT_DIR/stable"
DIST_DIR="$PROJECT_DIR/dist"
BACKUP_DIR="$PROJECT_DIR/.stable-backup"
BACKUPS_DATA="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Machine Center — Promote to Stable   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ────── Step 0: Check data backups ──────
echo "📋 Step 0/3: Checking data backups..."
node scripts/backup-data.mjs

# ────── Step 1: Type Check ──────
echo "🔍 Step 1/3: Type-checking..."
if npx tsc --noEmit 2>&1; then
    echo "   ✅ Type check passed"
else
    echo "   ❌ Type check FAILED — aborting. Stable is untouched."
    exit 1
fi

echo ""

# ────── Step 2: Build ──────
echo "🔨 Step 2/3: Building production bundle..."
if npx vite build 2>&1; then
    echo "   ✅ Build succeeded"
else
    echo "   ❌ Build FAILED — aborting. Stable is untouched."
    exit 1
fi

echo ""

# ────── Step 3: Promote ──────
echo "🚀 Step 3/3: Promoting to stable..."

# Backup current stable build (if exists)
if [ -d "$STABLE_DIR" ]; then
    echo "   📦 Backing up current stable build → .stable-backup/"
    rm -rf "$BACKUP_DIR"
    cp -r "$STABLE_DIR" "$BACKUP_DIR"
fi

# Atomic-ish replace: remove old, copy new
rm -rf "$STABLE_DIR"
cp -r "$DIST_DIR" "$STABLE_DIR"

echo "   ✅ Stable updated successfully"
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Promotion complete!                  ║"
echo "║                                          ║"
echo "║  🟢 Stable: http://localhost:4173        ║"
echo "║  🟠 Dev:    http://localhost:5173        ║"
echo "║                                          ║"
echo "║  ⚠️  Restart stable: npm run stable      ║"
echo "║                                          ║"
echo "║  🔒 Data: UNTOUCHED (IndexedDB is safe) ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Promoted at: $TIMESTAMP"
echo ""
