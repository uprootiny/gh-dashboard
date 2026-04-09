#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_SRC="$REPO_ROOT/deploy/launchd/com.uprootiny.hynous-foundry.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.uprootiny.hynous-foundry.plist"

echo "=== Hynous Foundry — install as launchd service ==="

# Kill any existing background process on the port
lsof -i :8788 -t 2>/dev/null | xargs kill 2>/dev/null || true

# Unload existing service if present
if [ -f "$PLIST_DST" ]; then
  echo ">>> Unloading existing service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Copy plist
echo ">>> Installing plist..."
cp "$PLIST_SRC" "$PLIST_DST"

# Load
echo ">>> Loading service..."
launchctl load "$PLIST_DST"

# Verify
sleep 2
if curl -s http://localhost:8788/api/health | grep -q '"ok": true'; then
  echo ""
  echo "=== Service is running ==="
  echo "  URL:    http://localhost:8788"
  echo "  Logs:   ~/Library/Logs/hynous-foundry.log"
  echo "  Errors: ~/Library/Logs/hynous-foundry.err"
  echo ""
  echo "  Stop:   launchctl unload $PLIST_DST"
  echo "  Start:  launchctl load $PLIST_DST"
  echo "  Status: curl -s http://localhost:8788/api/health"
else
  echo ""
  echo "WARNING: Service loaded but health check failed."
  echo "Check logs: tail -20 ~/Library/Logs/hynous-foundry.err"
  exit 1
fi
