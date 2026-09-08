#!/usr/bin/env bash
set -euo pipefail

policy="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/release-policy.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT

mkdir -p "$fixture/releases" "$fixture/pointers" "$fixture/incoming" "$fixture/candidates" "$fixture/proc/100" "$fixture/audit" "$fixture/lock"
for name in oldest pinned active dependency disposable recent-a recent-b; do mkdir -p "$fixture/releases/$name"; done

touch -d '7 days ago' "$fixture/releases/oldest" "$fixture/releases/pinned" "$fixture/releases/active" "$fixture/releases/dependency" "$fixture/releases/disposable"
touch -d '2 hours ago' "$fixture/releases/recent-a"
touch -d '1 hour ago' "$fixture/releases/recent-b"
ln -s "$fixture/releases/oldest" "$fixture/pointers/current"
ln -s "$fixture/releases/active" "$fixture/proc/100/cwd"
ln -s "$fixture/releases/dependency" "$fixture/releases/recent-b/node_modules"
printf '%s\n' "$fixture/releases/pinned" > "$fixture/pins"
mkdir -p "$fixture/incoming/expired" "$fixture/incoming/fresh" "$fixture/candidates/expired"
touch -d '3 hours ago' "$fixture/incoming/expired"
touch -d '10 minutes ago' "$fixture/incoming/fresh"
touch -d '25 hours ago' "$fixture/candidates/expired"

common_env=(
  ZHUDATUAN_RELEASE_POLICY_CONFIG=/dev/null
  KEEP_RECENT_PER_ROOT=2
  MAX_RELEASES_PER_ROOT=10
  RELEASE_GRACE_HOURS=1
  MIN_FREE_GIB=0
  MIN_FREE_PERCENT=0
  RELEASE_ROOTS="$fixture/releases"
  DISCOVER_RELEASE_PATTERNS=''
  POINTER_SCAN_POLICIES="$fixture/pointers,2"
  TRANSIENT_POLICIES="$fixture/incoming,2 $fixture/candidates,24"
  PINS_FILE="$fixture/pins"
  AUDIT_DIR="$fixture/audit"
  LOCK_FILE="$fixture/lock/policy.lock"
  FILESYSTEM_TO_CHECK="$fixture"
  PROC_ROOT="$fixture/proc"
  ALLOWED_BASES="$fixture"
)

env "${common_env[@]}" "$policy" audit
[[ -d "$fixture/releases/disposable" && -d "$fixture/incoming/expired" ]]
env "${common_env[@]}" "$policy" collect

[[ ! -e "$fixture/releases/disposable" ]]
[[ -d "$fixture/releases/oldest" ]]
[[ -d "$fixture/releases/pinned" ]]
[[ -d "$fixture/releases/active" ]]
[[ -d "$fixture/releases/dependency" ]]
[[ -d "$fixture/releases/recent-a" && -d "$fixture/releases/recent-b" ]]
[[ ! -e "$fixture/incoming/expired" && -d "$fixture/incoming/fresh" ]]
[[ ! -e "$fixture/candidates/expired" ]]

if env "${common_env[@]}" MIN_FREE_GIB=999999 "$policy" preflight >/dev/null 2>&1; then
  printf 'expected capacity preflight to refuse deployment\n' >&2
  exit 1
fi

printf 'release-policy fixture: protected, collected, and capacity-refused\n'
