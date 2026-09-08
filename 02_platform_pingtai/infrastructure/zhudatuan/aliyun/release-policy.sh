#!/usr/bin/env bash
set -euo pipefail

umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

if ((BASH_VERSINFO[0] < 4)); then
  printf 'release-policy: Bash 4 or newer is required\n' >&2
  exit 64
fi

CONFIG_FILE="${ZHUDATUAN_RELEASE_POLICY_CONFIG:-/etc/zhudatuan/release-retention.conf}"
if [[ -r "$CONFIG_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  set +a
fi

KEEP_RECENT_PER_ROOT="${KEEP_RECENT_PER_ROOT:-12}"
MAX_RELEASES_PER_ROOT="${MAX_RELEASES_PER_ROOT:-30}"
RELEASE_GRACE_HOURS="${RELEASE_GRACE_HOURS:-12}"
MIN_FREE_GIB="${MIN_FREE_GIB:-15}"
MIN_FREE_PERCENT="${MIN_FREE_PERCENT:-15}"
RELEASE_ROOTS="${RELEASE_ROOTS:-/opt/zhudatuan/releases:/opt/zhudatuan/storefront-releases:/opt/sfl/releases}"
DISCOVER_RELEASE_PATTERNS="${DISCOVER_RELEASE_PATTERNS-/opt/sfl/nodes/*/releases /opt/sfl/nodes/*/console/releases}"
POINTER_SCAN_POLICIES="${POINTER_SCAN_POLICIES:-/opt/zhudatuan,2 /opt/sfl/nodes,3}"
TRANSIENT_POLICIES="${TRANSIENT_POLICIES:-/opt/zhudatuan/incoming,2 /opt/zhudatuan/candidates,24 /opt/sfl/incoming,2 /opt/sfl/candidates,24}"
PINS_FILE="${PINS_FILE:-/etc/zhudatuan/release-pins}"
AUDIT_DIR="${AUDIT_DIR:-/var/log/zhudatuan-release-policy}"
AUDIT_RETENTION_DAYS="${AUDIT_RETENTION_DAYS:-30}"
LOCK_FILE="${LOCK_FILE:-/run/lock/zhudatuan-release-policy.lock}"
LOCK_WAIT_SECONDS="${LOCK_WAIT_SECONDS:-30}"
FILESYSTEM_TO_CHECK="${FILESYSTEM_TO_CHECK:-/}"
PROC_ROOT="${PROC_ROOT:-/proc}"
ALLOWED_BASES="${ALLOWED_BASES:-/opt/zhudatuan:/opt/sfl}"

die() {
  printf 'release-policy: %s\n' "$*" >&2
  exit 64
}

integer() {
  [[ "$2" =~ ^[0-9]+$ ]] || die "$1 must be a non-negative integer"
}

for setting in \
  KEEP_RECENT_PER_ROOT MAX_RELEASES_PER_ROOT RELEASE_GRACE_HOURS MIN_FREE_GIB \
  MIN_FREE_PERCENT AUDIT_RETENTION_DAYS LOCK_WAIT_SECONDS; do
  integer "$setting" "${!setting}"
done

action="${1:-audit}"
case "$action" in
  audit) apply=false; require_capacity=false ;;
  collect) apply=true; require_capacity=false ;;
  preflight|postdeploy) apply=true; require_capacity=true ;;
  *) die 'usage: release-policy.sh [audit|collect|preflight|postdeploy]' ;;
esac

absolute_non_root() {
  [[ "$1" == /* && "$1" != / ]] || die "unsafe non-absolute path: $1"
}

allowed_path() {
  local path="$1" base old_ifs="$IFS"
  IFS=':' read -r -a bases <<< "$ALLOWED_BASES"
  IFS="$old_ifs"
  for base in "${bases[@]}"; do
    [[ -n "$base" ]] || continue
    case "$path" in "$base"|"$base"/*) return 0 ;; esac
  done
  return 1
}

absolute_non_root "$AUDIT_DIR"
absolute_non_root "$LOCK_FILE"
mkdir -p -- "$AUDIT_DIR" "$(dirname -- "$LOCK_FILE")"
find "$AUDIT_DIR" -mindepth 1 -maxdepth 1 -type f -mtime "+$AUDIT_RETENTION_DAYS" -delete 2>/dev/null || true

exec 9>"$LOCK_FILE"
flock -w "$LOCK_WAIT_SECONDS" 9 || die 'another release-policy run still owns the lock'

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
audit_file="$AUDIT_DIR/$stamp-$action.log"
exec > >(tee -a "$audit_file") 2>&1
finish_logging() {
  local status=$?
  trap - EXIT
  exec 1>&- 2>&-
  wait || true
  exit "$status"
}
trap finish_logging EXIT
printf 'POLICY_START action=%s timestamp=%s\n' "$action" "$stamp"

declare -a release_roots=()
add_release_root() {
  local root="${1%/}" existing
  [[ -n "$root" && -d "$root" && ! -L "$root" ]] || return 0
  absolute_non_root "$root"
  allowed_path "$root" || die "release root outside allowed bases: $root"
  for existing in "${release_roots[@]:-}"; do [[ "$existing" == "$root" ]] && return 0; done
  release_roots+=("$root")
}

old_ifs="$IFS"
IFS=':' read -r -a configured_roots <<< "$RELEASE_ROOTS"
IFS="$old_ifs"
for root in "${configured_roots[@]}"; do add_release_root "$root"; done
for pattern in $DISCOVER_RELEASE_PATTERNS; do
  for root in $pattern; do add_release_root "$root"; done
done
((${#release_roots[@]} > 0)) || die 'no release roots exist'

declare -A protected=()
matched_item=''
release_item_for_path() {
  local candidate="$1" root remainder first
  matched_item=''
  for root in "${release_roots[@]}"; do
    case "$candidate" in
      "$root"/*)
        remainder="${candidate#"$root"/}"
        first="${remainder%%/*}"
        [[ -n "$first" ]] || return 1
        matched_item="$root/$first"
        return 0
        ;;
    esac
  done
  return 1
}

protect_path() {
  local candidate="$1" reason="$2"
  release_item_for_path "$candidate" || return 0
  [[ -e "$matched_item" || -L "$matched_item" ]] || return 0
  if [[ -z "${protected[$matched_item]+set}" ]]; then
    protected["$matched_item"]="$reason"
  fi
}

protect_recent_and_grace() {
  local root="$1" now mtime age item count=0
  now="$(date +%s)"
  while IFS= read -r item; do
    [[ -n "$item" ]] || continue
    if ((count < KEEP_RECENT_PER_ROOT)); then protect_path "$item" 'recent-successful'; fi
    count=$((count + 1))
    mtime="$(stat -c %Y -- "$item" 2>/dev/null || printf '0')"
    age=$((now - mtime))
    if ((age < RELEASE_GRACE_HOURS * 3600)); then protect_path "$item" 'release-grace'; fi
  done < <(find "$root" -mindepth 1 -maxdepth 1 -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
}

for root in "${release_roots[@]}"; do protect_recent_and_grace "$root"; done

declare -a pointer_scan_roots=()
declare -a pointer_scan_depths=()
for specification in $POINTER_SCAN_POLICIES; do
  scan_root="${specification%,*}"
  scan_depth="${specification##*,}"
  [[ "$scan_root" != "$scan_depth" ]] || die "invalid pointer scan policy: $specification"
  integer 'pointer scan depth' "$scan_depth"
  if [[ -d "$scan_root" ]]; then
    pointer_scan_roots+=("$scan_root")
    pointer_scan_depths+=("$scan_depth")
  fi
done

protect_pointers() {
  local index scan depth link target
  for index in "${!pointer_scan_roots[@]}"; do
    scan="${pointer_scan_roots[$index]}"
    depth="${pointer_scan_depths[$index]}"
    while IFS= read -r -d '' link; do
      target="$(readlink -f -- "$link" 2>/dev/null || true)"
      [[ -n "$target" ]] && protect_path "$target" "pointer:$link"
    done < <(find -P "$scan" -maxdepth "$depth" -type l -print0 2>/dev/null)
  done
}

protect_processes() {
  local process target token
  for process in "$PROC_ROOT"/[0-9]*; do
    [[ -d "$process" ]] || continue
    target="$(readlink -f -- "$process/cwd" 2>/dev/null || true)"
    [[ -n "$target" ]] && protect_path "$target" "process-cwd:${process##*/}"
    if [[ -r "$process/cmdline" ]]; then
      while IFS= read -r token; do
        [[ -n "$token" ]] && protect_path "$token" "process-command:${process##*/}"
      done < <(tr '\0' '\n' < "$process/cmdline" 2>/dev/null || true)
    fi
  done
}

protect_pins() {
  local line path
  [[ -r "$PINS_FILE" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    path="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//')"
    [[ -n "$path" ]] || continue
    absolute_non_root "$path"
    protect_path "$path" 'manual-pin'
  done < "$PINS_FILE"
}

protect_dependencies() {
  local pass before after item link target
  for pass in 1 2 3; do
    before="${#protected[@]}"
    mapfile -t protected_snapshot < <(printf '%s\n' "${!protected[@]}" | sort)
    for item in "${protected_snapshot[@]}"; do
      [[ -e "$item" ]] || continue
      while IFS= read -r -d '' link; do
        target="$(readlink -f -- "$link" 2>/dev/null || true)"
        [[ -n "$target" ]] && protect_path "$target" "dependency:$item"
      done < <(find -P "$item" -maxdepth 2 -type l -print0 2>/dev/null)
    done
    after="${#protected[@]}"
    ((after == before)) && break
  done
}

protect_pointers
protect_processes
protect_pins
protect_dependencies

item_in_use_now() {
  local item="$1" index scan depth link target process token
  for index in "${!pointer_scan_roots[@]}"; do
    scan="${pointer_scan_roots[$index]}"
    depth="${pointer_scan_depths[$index]}"
    while IFS= read -r -d '' link; do
      target="$(readlink -f -- "$link" 2>/dev/null || true)"
      case "$target" in "$item"|"$item"/*) return 0 ;; esac
    done < <(find -P "$scan" -maxdepth "$depth" -type l -print0 2>/dev/null)
  done
  for process in "$PROC_ROOT"/[0-9]*; do
    [[ -d "$process" ]] || continue
    target="$(readlink -f -- "$process/cwd" 2>/dev/null || true)"
    case "$target" in "$item"|"$item"/*) return 0 ;; esac
    if [[ -r "$process/cmdline" ]]; then
      while IFS= read -r token; do
        case "$token" in "$item"|"$item"/*) return 0 ;; esac
      done < <(tr '\0' '\n' < "$process/cmdline" 2>/dev/null || true)
    fi
  done
  return 1
}

delete_child() {
  local parent="$1" item="$2" reason="$3"
  [[ "$(dirname -- "$item")" == "$parent" && "$item" != "$parent" ]] || die "refused unsafe deletion: $item"
  allowed_path "$item" || die "refused deletion outside allowed bases: $item"
  if item_in_use_now "$item"; then
    printf 'SKIP path=%q reason=became-active\n' "$item"
    return 0
  fi
  if [[ "$apply" == true ]]; then
    printf 'DELETE path=%q reason=%s\n' "$item" "$reason"
    ionice -c 2 -n 7 nice -n 10 rm -rf --one-file-system -- "$item"
  else
    printf 'WOULD_DELETE path=%q reason=%s\n' "$item" "$reason"
  fi
}

release_candidates=0
for root in "${release_roots[@]}"; do
  root_count=0
  while IFS= read -r -d '' item; do
    root_count=$((root_count + 1))
    [[ -n "${protected[$item]+set}" ]] && continue
    release_candidates=$((release_candidates + 1))
    delete_child "$root" "$item" 'unprotected-release'
  done < <(find "$root" -mindepth 1 -maxdepth 1 -print0)
  protected_count="$(printf '%s\n' "${!protected[@]}" | awk -v prefix="$root/" 'index($0,prefix)==1 { count++ } END { print count+0 }')"
  printf 'ROOT root=%q items_before=%s protected=%s\n' "$root" "$root_count" "$protected_count"
done

transient_candidates=0
for specification in $TRANSIENT_POLICIES; do
  transient_root="${specification%,*}"
  ttl_hours="${specification##*,}"
  [[ "$transient_root" != "$ttl_hours" ]] || die "invalid transient policy: $specification"
  integer 'transient TTL' "$ttl_hours"
  [[ -d "$transient_root" && ! -L "$transient_root" ]] || continue
  absolute_non_root "$transient_root"
  allowed_path "$transient_root" || die "transient root outside allowed bases: $transient_root"
  now="$(date +%s)"
  while IFS= read -r -d '' item; do
    mtime="$(stat -c %Y -- "$item" 2>/dev/null || printf '%s' "$now")"
    age_seconds=$((now - mtime))
    ((age_seconds >= ttl_hours * 3600)) || continue
    transient_candidates=$((transient_candidates + 1))
    delete_child "$transient_root" "$item" "transient-older-than-${ttl_hours}h"
  done < <(find "$transient_root" -mindepth 1 -maxdepth 1 -print0)
done

capacity_ok=true
read -r available_kib used_percent < <(df -k --output=avail,pcent "$FILESYSTEM_TO_CHECK" | tail -1)
used_percent="${used_percent%%%}"
free_percent=$((100 - used_percent))
minimum_kib=$((MIN_FREE_GIB * 1024 * 1024))
if ((available_kib < minimum_kib || free_percent < MIN_FREE_PERCENT)); then capacity_ok=false; fi

count_limit_ok=true
for root in "${release_roots[@]}"; do
  remaining="$(find "$root" -mindepth 1 -maxdepth 1 | wc -l)"
  if ((remaining > MAX_RELEASES_PER_ROOT)); then
    count_limit_ok=false
    printf 'LIMIT_EXCEEDED root=%q remaining=%s maximum=%s\n' "$root" "$remaining" "$MAX_RELEASES_PER_ROOT"
  fi
done

printf 'POLICY_SUMMARY action=%s protected=%s release_candidates=%s transient_candidates=%s free_gib=%s free_percent=%s capacity_ok=%s count_limit_ok=%s audit=%s\n' \
  "$action" "${#protected[@]}" "$release_candidates" "$transient_candidates" "$((available_kib / 1024 / 1024))" "$free_percent" "$capacity_ok" "$count_limit_ok" "$audit_file"

if [[ "$require_capacity" == true && ("$capacity_ok" != true || "$count_limit_ok" != true) ]]; then
  printf 'RELEASE_REFUSED reason=capacity-or-release-count\n' >&2
  exit 70
fi
