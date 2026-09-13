#!/usr/bin/env bash
# Dispatch the parallel 1.3 prepared-artifact deployment channel.
# Usage:
#   scripts/deploy-prepared.sh <target> <full-commit-sha> <node>

set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

if [ "$#" -ne 3 ]; then
  echo "Usage: scripts/deploy-prepared.sh <target> <full-commit-sha> <node>" >&2
  exit 64
fi

TARGET="$1"
SHA="$2"
NODE="$3"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Deploy stopped: commit must be one full lowercase Git SHA." >&2
  exit 64
fi
if ! node -e 'const c=require("./02_platform_pingtai/infrastructure/release/zdt-next.release.json"); const [target,node]=process.argv.slice(1); if (!c.targets[target] || !c.nodes[node]?.deployments?.[target]) process.exit(1)' "$TARGET" "$NODE"; then
  echo "Deploy stopped: no configured channel for ${NODE}/${TARGET}." >&2
  exit 64
fi
if [ "$(git rev-parse "${SHA}^{commit}")" != "$SHA" ]; then
  echo "Deploy stopped: exact commit is unavailable in this worktree." >&2
  exit 64
fi
REMOTE_SHA="$(gh api "repos/{owner}/{repo}/commits/${SHA}" --jq .sha 2>/dev/null || true)"
if [ "$REMOTE_SHA" != "$SHA" ]; then
  echo "Deploy stopped: exact commit is not available to GitHub." >&2
  exit 1
fi
if ! gh workflow view deploy-prepared.yml --ref zdt-next --yaml >/dev/null 2>&1; then
  echo "Deploy stopped: the zdt-next Deploy channel does not exist." >&2
  exit 1
fi

echo "Prepared deploy: ${SHA} -> ${NODE}/${TARGET}"
APPROVAL="zdt-next:prepared-deploy:${SHA}:${NODE}:${TARGET}"
gh workflow run deploy-prepared.yml --ref zdt-next \
  -f head_sha="$SHA" \
  -f release_node="$NODE" \
  -f release_target="$TARGET" \
  -f operation=deploy \
  -f production_approval="$APPROVAL"

TITLE="Prepared Deploy ${SHA} ${NODE} ${TARGET}"
RUN_ID=""
for _ in {1..20}; do
  RUN_ID="$(gh run list --workflow deploy-prepared.yml --event workflow_dispatch --limit 20 \
    --json databaseId,displayTitle \
    --jq ".[] | select(.displayTitle == \"$TITLE\") | .databaseId" | head -1)"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 1
done
if [ -z "$RUN_ID" ]; then
  echo "Prepared deployment was dispatched but its run id was not found." >&2
  exit 1
fi

echo "GitHub run: $RUN_ID"
gh run watch "$RUN_ID" --exit-status
