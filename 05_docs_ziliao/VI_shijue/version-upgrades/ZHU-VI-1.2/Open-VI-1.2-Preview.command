#!/bin/zsh
set -e

VI12_PREVIEW_ROOT="$(cd "$(dirname "$0")/preview" && pwd)"
VI12_PREVIEW_LOG="/tmp/smart-wing-vi-1-2-preview.log"

cd "$VI12_PREVIEW_ROOT"
python3 -m http.server 4193 >"$VI12_PREVIEW_LOG" 2>&1 &
VI12_PREVIEW_PID=$!

cleanup_vi12_preview() {
  kill "$VI12_PREVIEW_PID" 2>/dev/null || true
}

trap cleanup_vi12_preview EXIT INT TERM
sleep 1
open 'http://127.0.0.1:4193/?path=/story/vi-1-2-%E5%9F%BA%E7%A1%80%E7%BB%84%E4%BB%B6-%E5%B7%A5%E4%BD%9C%E5%8F%B0%E7%BB%84%E5%90%88--complete-foundation'
wait "$VI12_PREVIEW_PID"
