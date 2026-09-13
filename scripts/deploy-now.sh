#!/usr/bin/env bash
# GitHub -> Aliyun direct deployment.
# Usage:
#   scripts/deploy-now.sh                       # affected targets from latest zdt-next
#   scripts/deploy-now.sh console               # console from latest zdt-next
#   scripts/deploy-now.sh console <commit>      # console from an exact commit
#   scripts/deploy-now.sh console <commit> zhudatuan-l0

set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

TARGET="${1:-}"
SHA="${2:-}"
NODE="${3:-hbbtzn-l1}"
if [ -z "$SHA" ]; then
  git fetch origin zdt-next --quiet
  SHA="$(git rev-parse origin/zdt-next)"
fi

dispatch=(workflow run deploy.yml --ref zdt-next -f head_sha="$SHA" -f release_node="$NODE")
if [ -n "$TARGET" ]; then
  dispatch+=(-f release_target="$TARGET")
fi

echo "Direct deploy: ${SHA} -> ${NODE}/${TARGET:-affected}"
gh "${dispatch[@]}"

TITLE="Direct ${SHA} ${NODE} ${TARGET:-affected}"
RUN_ID=""
for _ in {1..20}; do
  RUN_ID="$(gh run list --workflow deploy.yml --event workflow_dispatch --limit 20 \
    --json databaseId,displayTitle \
    --jq ".[] | select(.displayTitle == \"$TITLE\") | .databaseId" | head -1)"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 1
done
if [ -z "$RUN_ID" ]; then
  echo "Direct deployment was dispatched but its run id was not found." >&2
  exit 1
fi

echo "GitHub run: $RUN_ID"
gh run watch "$RUN_ID" --exit-status
