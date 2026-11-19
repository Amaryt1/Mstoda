#!/usr/bin/env bash
# Runs only within the owner's GitHub Codespace. GitHub forwards port 8765
# as PRIVATE by default; verify port visibility in the Codespaces PORTS panel.
set -euo pipefail
cd "${CODESPACE_VSCODE_FOLDER:-$(dirname "$0")/..}"
if curl -fsS --max-time 2 http://127.0.0.1:8765/ >/dev/null 2>&1; then
  echo "AMARYT Admin is already running on port 8765."
  exit 0
fi
nohup python3 scripts/run_private_admin.py --host 127.0.0.1 --port 8765 > /tmp/amaryt-admin.log 2>&1 < /dev/null &
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 2 http://127.0.0.1:8765/ >/dev/null 2>&1; then
    echo "AMARYT Admin ready on port 8765."
    echo "Open the PRIVATE port from the GitHub Codespaces PORTS tab."
    exit 0
  fi
  sleep 1
done
echo "Failed to start AMARYT Admin. See /tmp/amaryt-admin.log." >&2
exit 1
