#!/bin/bash
# ─────────────────────────────────────────────────────
# rollback.sh — Revert to the previous stable build
#
# If a promotion went wrong, this restores the backup.
#
# Usage:
#   npm run rollback
#   ./scripts/rollback.sh
# ─────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STABLE_DIR="$PROJECT_DIR/stable"
BACKUP_DIR="$PROJECT_DIR/.stable-backup"

if [ ! -d "$BACKUP_DIR" ]; then
    echo ""
    echo "⚠️  No backup found. Nothing to rollback to."
    echo ""
    exit 1
fi

echo ""
echo "🔄 Rolling back stable to previous version..."
rm -rf "$STABLE_DIR"
mv "$BACKUP_DIR" "$STABLE_DIR"
echo "✅ Rollback complete. Stable is back to the previous version."
echo ""
echo "Restart the stable server:"
echo "  npm run stable"
echo ""
