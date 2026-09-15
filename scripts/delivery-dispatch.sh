#!/usr/bin/env bash
# Internal dispatcher for the single user-visible Delivery Control 1.5 workflow.
set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

gh_read() {
  local output='' error_file="${TMPDIR:-/tmp}/zdt-delivery-read-$$"
  for attempt in 1 2 3; do
    if output="$(gh "$@" 2>"$error_file")"; then rm -f -- "$error_file"; printf '%s\n' "$output"; return 0; fi
    if ! grep -Eqi 'reset|timed out|temporar|502|503|504' "$error_file" || [ "$attempt" -eq 3 ]; then
      rm -f -- "$error_file"; return 1
    fi
    sleep "$attempt"
  done
}

operation="${1:-}"
case "$operation" in
  prepare|deploy)
    [ "$#" -eq 4 ] || { echo "Usage: delivery-dispatch.sh $operation <target> <full-source-sha> <physical-node>" >&2; exit 64; }
    target="$2" source_sha="$3" physical_node="$4"
    ;;
  deploy-source)
    [ "$#" -eq 2 ] || { echo 'Usage: delivery-dispatch.sh deploy-source <full-source-sha>' >&2; exit 64; }
    target='' source_sha="$2" physical_node=''
    ;;
  *) echo 'Usage: delivery-dispatch.sh <prepare|deploy|deploy-source> ...' >&2; exit 64 ;;
esac

[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Delivery stopped: source must be one full lowercase Git SHA.' >&2; exit 64; }
if [ "$operation" != deploy-source ]; then
  node -e 'const c=require("./02_platform_pingtai/infrastructure/release/zdt-next.release.json");const [target,node]=process.argv.slice(1);const d=c.targets[target]&&c.nodes[node]?.deployments?.[target];if(!d||d.hostedBy&&d.hostedBy!==node)process.exit(1)' "$target" "$physical_node" \
    || { echo "Delivery stopped: no physical channel for ${physical_node}/${target}." >&2; exit 64; }
fi
[ "$(git rev-parse "${source_sha}^{commit}" 2>/dev/null || true)" = "$source_sha" ] \
  || { echo 'Delivery stopped: exact commit is unavailable in this control worktree.' >&2; exit 64; }
remote_sha="$(gh_read api "repos/{owner}/{repo}/commits/${source_sha}" --jq .sha || true)"
[ "$remote_sha" = "$source_sha" ] || { echo 'Delivery stopped: exact commit is not available to GitHub.' >&2; exit 1; }
merge_base="$(gh_read api "repos/{owner}/{repo}/compare/${source_sha}...zdt-next" --jq .merge_base_commit.sha || true)"
[ "$merge_base" = "$source_sha" ] || { echo 'Delivery stopped: exact commit does not belong to zdt-next history.' >&2; exit 64; }

workflow='delivery-1-4-3.yml'
gh_read workflow view "$workflow" --ref zdt-next --yaml >/dev/null \
  || { echo 'Delivery stopped: the unified 1.5 control workflow is unavailable.' >&2; exit 1; }
previous_id="$(gh_read run list --workflow "$workflow" --limit 1 --json databaseId --jq '.[0].databaseId // 0')"
echo "1.5 ${operation}: ${source_sha}${target:+ -> ${physical_node}/${target}}"
gh workflow run "$workflow" --ref zdt-next \
  -f operation="$operation" -f head_sha="$source_sha" -f release_target="$target" -f physical_node="$physical_node"

# Another task can dispatch the same workflow concurrently. Correlate the
# resulting run with every immutable dispatch input rather than using only
# its creation order.
if [ -n "$target" ]; then
  expected_title="Delivery 1.5 ${operation} ${source_sha} ${target} ${physical_node}"
  run_selector=".[] | select(.databaseId > ${previous_id} and .displayTitle == \\\"${expected_title}\\\") | .databaseId"
else
  run_selector=".[] | select(.databaseId > ${previous_id} and (.displayTitle | test(\\\"^Delivery 1\\\\.4\\\\.3 ${operation} ${source_sha}( *)$\\\"))) | .databaseId"
fi

if [ -z "$target" ]; then
  expected_title="Delivery 1.5 ${operation} ${source_sha}"
  run_selector=".[] | select(.databaseId > ${previous_id} and (.displayTitle | startswith(\\\"${expected_title}\\\"))) | .databaseId"
fi

run_id=''
for attempt in {1..30}; do
  run_id="$(gh_read run list --workflow "$workflow" --event workflow_dispatch --limit 30 --json databaseId,displayTitle \
    --jq "$run_selector" | head -1 || true)"
  [ -z "$run_id" ] || break
  sleep "$(( attempt < 3 ? attempt : 3 ))"
done
[ -n "$run_id" ] || { echo 'Delivery was dispatched but its run ID was not found; query status without redispatching.' >&2; exit 1; }
echo "GitHub run: $run_id"
gh run watch "$run_id" --exit-status
