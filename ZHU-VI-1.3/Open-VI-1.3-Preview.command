#!/bin/zsh
set -e

VI13_ROOT="$(cd "$(dirname "$0")" && pwd)"
VI13_PREVIEW_LOG="/tmp/smart-wing-vi-1-3-preview.log"

cd "$VI13_ROOT"
python3 -m http.server 4194 >"$VI13_PREVIEW_LOG" 2>&1 &
VI13_PREVIEW_PID=$!

cleanup_vi13_preview() {
  kill "$VI13_PREVIEW_PID" 2>/dev/null || true
}

trap cleanup_vi13_preview EXIT INT TERM
sleep 1
open 'http://127.0.0.1:4194/preview/vi-1-3-han-template.html'
wait "$VI13_PREVIEW_PID"
