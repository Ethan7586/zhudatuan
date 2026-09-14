#!/usr/bin/env bash
# Deploy every physical target recorded by one successful automatic closure.
# Usage: scripts/deploy-source.sh <full-commit-sha>

set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

if [ "$#" -ne 1 ] || [[ ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: scripts/deploy-source.sh <full-commit-sha>" >&2
  exit 64
fi

SHA="$1"
WORKFLOW="deploy-source-aliyun.yml"
if [ "$(git rev-parse "${SHA}^{commit}" 2>/dev/null || true)" != "$SHA" ]; then
  echo "Deploy stopped: exact commit is unavailable in this worktree." >&2
  exit 64
fi
REMOTE_SHA="$(gh api "repos/{owner}/{repo}/commits/${SHA}" --jq .sha 2>/dev/null || true)"
if [ "$REMOTE_SHA" != "$SHA" ]; then
  echo "Deploy stopped: exact commit is not available to GitHub." >&2
  exit 1
fi
ZDT_NEXT_MERGE_BASE="$(gh api "repos/{owner}/{repo}/compare/${SHA}...zdt-next" --jq .merge_base_commit.sha 2>/dev/null || true)"
if [ "$ZDT_NEXT_MERGE_BASE" != "$SHA" ]; then
  echo "Deploy stopped: exact commit does not belong to zdt-next history." >&2
  exit 64
fi
if ! gh workflow view "$WORKFLOW" --ref zdt-next --yaml >/dev/null 2>&1; then
  echo "Deploy stopped: the sealed-source orchestration channel does not exist." >&2
  exit 1
fi

last_run_id="$(gh run list --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "Aliyun sealed-source deployment: ${SHA}"
gh workflow run "$WORKFLOW" --ref zdt-next -f head_sha="$SHA"

title="Deploy sealed source ${SHA}"
run_id=""
for _ in {1..30}; do
  run_id="$(gh run list --workflow "$WORKFLOW" --event workflow_dispatch --limit 30 \
    --json databaseId,displayTitle \
    --jq ".[] | select(.displayTitle == \"$title\" and .databaseId > $last_run_id) | .databaseId" | head -1)"
  [ -z "$run_id" ] || break
  sleep 1
done
[ -n "$run_id" ] || { echo "Deployment was dispatched but its run id was not found." >&2; exit 1; }

echo "GitHub run: $run_id"
gh run watch "$run_id" --exit-status
