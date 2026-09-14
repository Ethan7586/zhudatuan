#!/usr/bin/env bash
# Read-only GitHub view of the three-Runner fleet. This command never gates delivery.
set -euo pipefail

readonly REPOSITORY='Ethan7586/zhudatuan'
readonly BUILD='aliyun-staging-zdt-build'
readonly RELEASE='aliyun-staging-zdt-release'
readonly STANDBY='aliyun-staging-zdt-release-standby'

payload="$(gh api "repos/${REPOSITORY}/actions/runners")"
printf 'NAME\tSTATUS\tBUSY\tROLE LABELS\n'
for name in "$BUILD" "$RELEASE" "$STANDBY"; do
  row="$(jq -r --arg name "$name" '
    .runners[]? | select(.name == $name) |
    [.name, .status, (.busy | tostring), ([.labels[].name | select(startswith("zdt-"))] | join(","))] | @tsv
  ' <<<"$payload")"
  if [ -n "$row" ]; then
    printf '%s\n' "$row"
  else
    printf '%s\tmissing\tfalse\t-\n' "$name"
  fi
done

unknown="$(jq -r --arg build "$BUILD" --arg release "$RELEASE" --arg standby "$STANDBY" '
  [.runners[] | select(
    .name != $build and .name != $release and .name != $standby and
    any(.labels[]; .name == "zdt-aliyun-build" or .name == "zdt-aliyun-release")
  ) | .name] | join(",")
' <<<"$payload")"
if [ -n "$unknown" ]; then
  printf 'NOTICE unexpected role consumers: %s\n' "$unknown"
fi

runner_state() {
  jq -r --arg name "$1" '[.runners[] | select(.name == $name)][0].status // "missing"' <<<"$payload"
}

build_state="$(runner_state "$BUILD")"
release_state="$(runner_state "$RELEASE")"
standby_state="$(runner_state "$STANDBY")"
if [ "$build_state" = 'online' ] && [ "$release_state" = 'online' ] && [ "$standby_state" = 'offline' ]; then
  echo 'Fleet state: primary build/release online; release standby cold.'
elif [ "$standby_state" = 'online' ]; then
  echo 'Fleet state: release standby is active.'
elif [ "$standby_state" = 'missing' ]; then
  echo 'Fleet state: release standby is not installed.'
else
  printf 'Fleet state: degraded (build=%s release=%s standby=%s).\n' "$build_state" "$release_state" "$standby_state"
fi
