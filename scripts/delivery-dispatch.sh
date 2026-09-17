#!/usr/bin/env bash
# Runner 1.7 control-side dispatcher. No build, package, upload, deploy, or rollback runs here.
set -euo pipefail

operation="${1:-}"
identifier=''
target=''
physical_node=''
case "$operation" in
  release|status)
    if [ "$operation" = release ]; then
      { [ "$#" -eq 2 ] || [ "$#" -eq 4 ]; } || { echo 'Usage: delivery-dispatch.sh release <source-sha-or-release-id> [target physical-node]' >&2; exit 64; }
    else
      [ "$#" -eq 2 ] || { echo 'Usage: delivery-dispatch.sh status <source-sha-or-release-id>' >&2; exit 64; }
    fi
    identifier="$2"
    [[ "$identifier" =~ ^[0-9a-f]{40}$ || "$identifier" =~ ^r16-[0-9a-f]{40}$ ]] \
      || { echo "$operation requires a full lowercase Source SHA or r16 release id" >&2; exit 64; }
    if [ "$#" -eq 4 ]; then target="$3"; physical_node="$4"; fi
    ;;
  retry)
    { [ "$#" -eq 2 ] || [ "$#" -eq 4 ]; } || { echo 'Usage: delivery-dispatch.sh retry <r16-release-id> [target physical-node]' >&2; exit 64; }
    identifier="$2"
    [[ "$identifier" =~ ^r16-[0-9a-f]{40}$ ]] \
      || { echo 'retry requires an r16 release id' >&2; exit 64; }
    if [ "$#" -eq 4 ]; then target="$3"; physical_node="$4"; fi
    ;;
  rollback)
    [ "$#" -eq 3 ] || { echo 'Usage: delivery-dispatch.sh rollback <target> <physical-node>' >&2; exit 64; }
    target="$2"
    physical_node="$3"
    ;;
  control-update)
    [ "$#" -eq 1 ] || { echo 'Usage: delivery-dispatch.sh control-update' >&2; exit 64; }
    ;;
  *) echo 'Runner 1.7 operations: release, status, retry, rollback, control-update' >&2; exit 64 ;;
esac

workflow='delivery-1-6.yml'
gh workflow view "$workflow" --ref zdt-next --yaml >/dev/null \
  || { echo 'Runner 1.7 workflow is unavailable on zdt-next.' >&2; exit 1; }
previous_id="$(gh run list --workflow "$workflow" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "Runner 1.7 ${operation}: ${identifier:-${physical_node}/${target}}"
expected_title="Runner 1.7 ${operation} ${identifier} ${target} ${physical_node}"
run_id=''
dispatch_run() {
  local after_id="$1"
  local execution_location="$2"
  gh workflow run "$workflow" --ref zdt-next \
    -f operation="$operation" -f identifier="$identifier" -f release_target="$target" -f physical_node="$physical_node" \
    -f execution_location="$execution_location"
  echo '状态：QUEUED'
  run_id=''
  for attempt in {1..30}; do
    run_id="$(gh run list --workflow "$workflow" --event workflow_dispatch --limit 30 --json databaseId,displayTitle \
      --jq ".[] | select(.databaseId > ${after_id} and .displayTitle == \"${expected_title}\") | .databaseId" | head -1)"
    [ -z "$run_id" ] || break
    sleep "$(( attempt < 3 ? attempt : 3 ))"
  done
  [ -n "$run_id" ] || { echo 'Request was dispatched but its GitHub run was not found.' >&2; exit 1; }
}

dispatch_run "$previous_id" auto
case "$operation" in
  rollback) echo "Rollback run: $run_id" ;;
  control-update) echo "Control update run: $run_id" ;;
  *) echo "Release id: $identifier" ;;
esac
echo "GitHub run: $run_id"
echo '状态：RUNNING'

# Runner availability can change after routing. First wait for the route to
# exist; the 20-second Aliyun startup clock begins only then.
for attempt in {1..30}; do
  execute_name="$(gh run view "$run_id" --json jobs --jq '.jobs[]? | select(.name | startswith("Execute on ")) | .name' | head -1)"
  [ -z "$execute_name" ] || break
  sleep 2
done
if [ "$execute_name" = 'Execute on aliyun' ]; then
  for attempt in {1..10}; do
    started_steps="$(gh run view "$run_id" --json jobs --jq '[.jobs[]? | select(.name == "Execute on aliyun") | .steps[]? | select(.startedAt != null)] | length')"
    [ "${started_steps:-0}" -gt 0 ] && break
    sleep 2
  done
fi

if [ "${execute_name:-}" = 'Execute on aliyun' ] && [ "${started_steps:-0}" -eq 0 ]; then
  aliyun_run_id="$run_id"
  echo '阿里云执行器 20 秒内未启动；仅取消尚未开始核心的运行。'
  gh run cancel "$aliyun_run_id" >/dev/null
  for attempt in {1..30}; do
    run_status="$(gh run view "$aliyun_run_id" --json status --jq .status)"
    [ "$run_status" = completed ] && break
    sleep 1
  done
  [ "${run_status:-}" = completed ] || { echo 'Aliyun run cancellation was not confirmed; Hosted fallback was not started.' >&2; exit 1; }
  core_steps="$(gh run view "$aliyun_run_id" --json jobs --jq '[.jobs[].steps[]? | select(.startedAt != null and (.name | test("shared release core"; "i")))] | length')"
  [ "${core_steps:-0}" -eq 0 ] || { echo 'The shared core started before cancellation; Hosted fallback was not started.' >&2; exit 1; }
  dispatch_run "$aliyun_run_id" github-hosted
  echo "Hosted fallback run: $run_id"
fi

watch_status=0
gh run watch "$run_id" --exit-status || watch_status=$?
gh run view "$run_id" --log | sed -n '/RUNNER_1_6_RESULT=/p' | tail -1 || true
gh run view "$run_id" --json createdAt,jobs | node scripts/delivery-timings.mjs || echo 'DELIVERY_PRE_CORE_TIMINGS=unavailable'
finished_ms="$(($(date +%s) * 1000))"
end_to_end_ms="$((finished_ms - ${ZDT_DELIVERY_STARTED_MS:-finished_ms}))"
printf 'DELIVERY_END_TO_END_MS=%s\n' "$end_to_end_ms"
exit "$watch_status"
