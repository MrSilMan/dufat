#!/usr/bin/env bash
# Hourly probe (cron) for the INVGEST route blackhole (65.108.52.21/32).
# 000 = still blocked upstream · 401 = route restored, only the API key step remains.
# Logs every result; on the first 401 it drops a marker file so the change is
# impossible to miss even without reading the log.

set -u
LOG_DIR="/home/deploy/dufat-app/logs"
LOG_FILE="$LOG_DIR/invgest-connectivity.log"
MARKER="$LOG_DIR/INVGEST-ROUTE-RESTORED"
mkdir -p "$LOG_DIR"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://invgest.ao/api/v1/items 2>/dev/null)
[ -z "$code" ] && code=000
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') HTTP=$code" >> "$LOG_FILE"

if [ "$code" != "000" ] && [ ! -f "$MARKER" ]; then
  {
    echo "INVGEST route restored at $(date -u '+%Y-%m-%dT%H:%M:%SZ') — first non-timeout response: HTTP $code."
    echo "Next steps: notify INVGEST (they are watching for egress IP 187.124.165.145),"
    echo "then test the key: HTTP 401=invalid/revoked · 403=missing items:read scope · 200=ready to import."
  } > "$MARKER"
fi
