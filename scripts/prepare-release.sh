#!/usr/bin/env bash
# Prepare and seal one immutable 1.4 Aliyun release candidate.
# Usage:
#   scripts/prepare-release.sh <target> <full-commit-sha> <physical-node>
#   ZDT_PREPARE_RUNNER=aliyun|github overrides automatic build routing.

set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

if [ "$#" -ne 3 ]; then
  echo "Usage: scripts/prepare-release.sh <target> <full-commit-sha> <physical-node>" >&2
  exit 64
fi

TARGET="$1"
SHA="$2"
NODE="$3"
REQUESTED_BUILD_RUNNER="${ZDT_PREPARE_RUNNER:-auto}"
BUILD_RUNNER=""
WORKFLOW_PREPARE="prepare-artifact-aliyun.yml"
WORKFLOW_DEPLOY="deploy-prepared-aliyun.yml"

case "$REQUESTED_BUILD_RUNNER" in
  auto|aliyun|github) ;;
  *) echo "Prepare stopped: ZDT_PREPARE_RUNNER must be auto, aliyun or github." >&2; exit 64 ;;
esac

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Prepare stopped: commit must be one full lowercase Git SHA." >&2
  exit 64
fi
if ! node -e 'const c=require("./02_platform_pingtai/infrastructure/release/zdt-next.release.json");const [target,node]=process.argv.slice(1);const d=c.targets[target]&&c.nodes[node]?.deployments?.[target];if(!d)process.exit(1);if(d.hostedBy&&d.hostedBy!==node){console.error(`Prepare stopped: ${node}/${target} is physically hosted by ${d.hostedBy}; use the physical node.`);process.exit(2)}' "$TARGET" "$NODE"; then
  echo "Prepare stopped: no physical channel for ${NODE}/${TARGET}." >&2
  exit 64
fi
if [ "$(git rev-parse "${SHA}^{commit}" 2>/dev/null || true)" != "$SHA" ]; then
  echo "Prepare stopped: exact commit is unavailable in this worktree." >&2
  exit 64
fi
REMOTE_SHA="$(gh api "repos/{owner}/{repo}/commits/${SHA}" --jq .sha 2>/dev/null || true)"
if [ "$REMOTE_SHA" != "$SHA" ]; then
  echo "Prepare stopped: exact commit is not available to GitHub." >&2
  exit 1
fi
ZDT_NEXT_MERGE_BASE="$(gh api "repos/{owner}/{repo}/compare/${SHA}...zdt-next" --jq .merge_base_commit.sha 2>/dev/null || true)"
if [ "$ZDT_NEXT_MERGE_BASE" != "$SHA" ]; then
  echo "Prepare stopped: exact commit does not belong to zdt-next history." >&2
  exit 64
fi
for workflow in "$WORKFLOW_PREPARE" "$WORKFLOW_DEPLOY"; do
  if ! gh workflow view "$workflow" --ref zdt-next --yaml >/dev/null 2>&1; then
    echo "Prepare stopped: required zdt-next workflow ${workflow} does not exist." >&2
    exit 1
  fi
done

select_build_runner() {
  if [ "$REQUESTED_BUILD_RUNNER" != auto ]; then
    printf '%s\n' "$REQUESTED_BUILD_RUNNER"
    return
  fi

  local idle_slots queued_runs
  idle_slots="$(gh api repos/{owner}/{repo}/actions/runners \
    --jq '[.runners[] | select(.status == "online" and .busy == false and ([.labels[].name] | index("zdt-aliyun-build")))] | length' \
    2>/dev/null || true)"
  queued_runs="$(gh run list --workflow "$WORKFLOW_PREPARE" --status queued --limit 100 \
    --json displayTitle \
    --jq '[.[] | select((.displayTitle | endswith(" [github]")) | not)] | length' \
    2>/dev/null || true)"

  if [[ "$idle_slots" =~ ^[0-9]+$ && "$queued_runs" =~ ^[0-9]+$ ]] && (( idle_slots > queued_runs )); then
    printf 'aliyun\n'
  else
    printf 'github\n'
  fi
}

BUILD_RUNNER="$(select_build_runner)"
if [ "$REQUESTED_BUILD_RUNNER" = auto ]; then
  echo "Build route auto-selected: ${BUILD_RUNNER}."
fi

find_dispatched_run() {
  local workflow="$1"
  local title="$2"
  local previous_id="$3"
  local run_id=""
  for _ in {1..30}; do
    run_id="$(gh run list --workflow "$workflow" --event workflow_dispatch --limit 30 \
      --json databaseId,displayTitle \
      --jq ".[] | select(.displayTitle == \"$title\" and .databaseId > $previous_id) | .databaseId" | head -1)"
    if [ -n "$run_id" ]; then
      printf '%s\n' "$run_id"
      return 0
    fi
    sleep 1
  done
  return 1
}

last_prepare_id="$(gh run list --workflow "$WORKFLOW_PREPARE" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "正在封装：${SHA} -> ${TARGET} (${BUILD_RUNNER})"
gh workflow run "$WORKFLOW_PREPARE" --ref zdt-next \
  -f head_sha="$SHA" \
  -f release_target="$TARGET" \
  -f build_runner="$BUILD_RUNNER" \
  -f release_node="$NODE"
prepare_title="Prepare 1.4 ${SHA} ${TARGET}"
if [ "$BUILD_RUNNER" = github ]; then prepare_title+=" [github]"; fi
prepare_run_id="$(find_dispatched_run "$WORKFLOW_PREPARE" "$prepare_title" "$last_prepare_id")" || {
  echo "未封板：classification=BUILD_ACTION_NOT_FOUND retryable=true" >&2
  exit 1
}
echo "Prepare run: $prepare_run_id"
if ! gh run watch "$prepare_run_id" --exit-status; then
  echo "未封板：classification=BUILD_ACTION_FAILED retryable=true request=${prepare_run_id}" >&2
  exit 1
fi

last_seal_id="$(gh run list --workflow "$WORKFLOW_DEPLOY" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "正在验证：${SHA} -> ${NODE}/${TARGET}"
gh workflow run "$WORKFLOW_DEPLOY" --ref zdt-next \
  -f head_sha="$SHA" \
  -f release_node="$NODE" \
  -f release_target="$TARGET" \
  -f operation=validate-candidate
seal_title="Deploy 1.4 validate-candidate ${SHA} ${NODE} ${TARGET}"
seal_run_id="$(find_dispatched_run "$WORKFLOW_DEPLOY" "$seal_title" "$last_seal_id")" || {
  echo "未封板：classification=SEAL_ACTION_NOT_FOUND retryable=true" >&2
  exit 1
}
echo "Candidate seal run: $seal_run_id"
if ! gh run watch "$seal_run_id" --exit-status; then
  echo "未封板：classification=VALIDATION_OR_SEAL_ACTION_FAILED retryable=true request=${seal_run_id}" >&2
  exit 1
fi

seal_attempt="$(gh api "repos/{owner}/{repo}/actions/runs/${seal_run_id}" --jq .run_attempt)"
receipt_dir="$(mktemp -d "${TMPDIR:-/tmp}/zdt-seal-result.XXXXXX")"
trap 'rm -rf -- "$receipt_dir"' EXIT
receipt_name="prepared-validate-candidate-${TARGET}-${SHA}-${seal_run_id}-${seal_attempt}"
gh run download "$seal_run_id" --name "$receipt_name" --dir "$receipt_dir"
node -e '
const fs=require("node:fs");
const p=process.argv[1];
const envelope=JSON.parse(fs.readFileSync(p,"utf8"));
if(!envelope.ok||envelope.result?.finalStatus!=="sealed"||envelope.result?.finalSealReceipt?.schema!=="ai.delivery.final-seal.v1") {
  console.error("未封板：classification=FINAL_SEAL_RECEIPT_MISSING retryable=true");
  process.exit(1);
}
const x=envelope.result;
console.log(JSON.stringify({
  status:"已封板", sourceSha:x.sourceSha, controlPlaneSha:x.controlPlane.sourceSha,
  target:x.target, physicalNode:x.node, artifactDigest:x.artifactIdentity,
  sealKey:x.sealKey, finalSealReceiptObject:x.finalSealReceiptObject,
  buildRunner:x.finalSealReceipt.build_runner, releaseRunner:x.finalSealReceipt.release_runner,
  reusedArtifact:x.finalSealReceipt.reused_artifact, reusedReceipt:x.reusedSeal,
  productionSwitched:false
},null,2));
' "$receipt_dir/envelope.json"
