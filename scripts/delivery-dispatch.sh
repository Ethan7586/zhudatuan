#!/usr/bin/env bash
# Runner 1.6 control-side dispatcher. No build, package, upload, deploy, or rollback runs here.
set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

operation="${1:-}"
identifier=''
target=''
physical_node=''
case "$operation" in
  release|status|retry)
    [ "$#" -eq 2 ] || { echo "Usage: delivery-dispatch.sh $operation <source-sha-or-release-id>" >&2; exit 64; }
    identifier="$2"
    ;;
  rollback)
    [ "$#" -eq 3 ] || { echo 'Usage: delivery-dispatch.sh rollback <target> <physical-node>' >&2; exit 64; }
    target="$2"
    physical_node="$3"
    ;;
  *) echo 'Runner 1.6 operations: release, status, retry, rollback' >&2; exit 64 ;;
esac

workflow='delivery-1-6.yml'
gh workflow view "$workflow" --ref zdt-next --yaml >/dev/null \
  || { echo 'Runner 1.6 workflow is unavailable on zdt-next.' >&2; exit 1; }
previous_id="$(gh run list --workflow "$workflow" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "Runner 1.6 ${operation}: ${identifier:-${physical_node}/${target}}"
gh workflow run "$workflow" --ref zdt-next \
  -f operation="$operation" -f identifier="$identifier" -f release_target="$target" -f physical_node="$physical_node"
echo '状态：QUEUED'

expected_title="Runner 1.6 ${operation} ${identifier} ${target} ${physical_node}"
run_id=''
for attempt in {1..30}; do
  run_id="$(gh run list --workflow "$workflow" --event workflow_dispatch --limit 30 --json databaseId,displayTitle \
    --jq ".[] | select(.databaseId > ${previous_id} and .displayTitle == \"${expected_title}\") | .databaseId" | head -1)"
  [ -z "$run_id" ] || break
  sleep "$(( attempt < 3 ? attempt : 3 ))"
done
[ -n "$run_id" ] || { echo 'Request was dispatched but its GitHub run was not found.' >&2; exit 1; }
echo "Release id: ${identifier:-rollback-${run_id}}"
echo "GitHub run: $run_id"
echo '状态：RUNNING'
gh run watch "$run_id" --exit-status
gh run view "$run_id" --log | sed -n '/RUNNER_1_6_RESULT=/p' | tail -1
