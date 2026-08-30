#!/usr/bin/env bash
set -Eeuo pipefail

readonly FULL_ROOT='/opt/zhudatuan-staging-full'
readonly CANDIDATE_CADDY="${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/Caddyfile.full"
readonly CANDIDATE_DROP_IN="${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/caddy-zhudatuan-staging-full.conf"
readonly CADDY_ENV="${FULL_ROOT}/shared/full-caddy.env"
readonly READINESS_MAIN="${FULL_ROOT}/current/services/commerce/dist/StagingReadinessMain.js"
readonly READINESS_EVIDENCE="${FULL_ROOT}/shared/evidence/readiness.yml"
readonly ACTIVE_CADDY='/etc/caddy/Caddyfile'
readonly CADDY_DROP_IN_DIR='/etc/systemd/system/caddy.service.d'
readonly ACTIVE_DROP_IN="${CADDY_DROP_IN_DIR}/zhudatuan-staging-full.conf"
readonly BACKUP_DIR="${FULL_ROOT}/shared/caddy-backups"
readonly MANAGED_MARKER='# Managed by the Zhudatuan isolated full-staging deployment.'

declare -ar REQUIRED_HOST_KEYS=(
  'ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST'
  'ZHUDATUAN_STAGING_FULL_CONSOLE_HOST'
  'ZHUDATUAN_STAGING_FULL_API_HOST'
)

die() {
  printf 'caddy candidate install refused: %s\n' "$*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

assert_root_owned_regular() {
  local path="$1"
  local label="$2"
  local mode

  [[ -e "$path" ]] || die "${label} is missing: ${path}"
  [[ ! -L "$path" && -f "$path" ]] || die "${label} must be a regular, non-symlink file: ${path}"
  [[ "$(stat -c '%u' -- "$path")" == '0' ]] || die "${label} must be owned by root: ${path}"
  mode="$(stat -c '%a' -- "$path")"
  (( (8#${mode} & 8#022) == 0 )) || die "${label} must not be group/world writable: ${path}"
}

assert_root_owned_directory() {
  local path="$1"
  local label="$2"
  local mode

  [[ ! -L "$path" && -d "$path" ]] || die "${label} must be a directory, not a symlink: ${path}"
  [[ "$(stat -c '%u' -- "$path")" == '0' ]] || die "${label} must be owned by root: ${path}"
  mode="$(stat -c '%a' -- "$path")"
  (( (8#${mode} & 8#022) == 0 )) || die "${label} must not be group/world writable: ${path}"
}

reject_production_or_import() {
  local path="$1"
  local label="$2"

  if grep -Eiq -- '(^|[^a-z0-9.-])(accounts|console|api)\.zhudatuan\.com([^a-z0-9.-]|$)' "$path"; then
    die "${label} contains a production-domain reference: ${path}"
  fi
  if grep -Eiq -- '^[[:space:]]*import([[:space:]]|$)' "$path"; then
    die "${label} contains an import directive: ${path}"
  fi
}

assert_virgin_or_managed_caddy() {
  local normalized

  if grep -Fqx -- "$MANAGED_MARKER" "$ACTIVE_CADDY"; then
    [[ "$(sed -n '1p' -- "$ACTIVE_CADDY")" == "$MANAGED_MARKER" ]] \
      || die 'the managed Caddy marker must be the first line of the active Caddyfile'
    return
  fi

  normalized="$(sed -E '/^[[:space:]]*(#|$)/d; s/^[[:space:]]+//; s/[[:space:]]+$//' -- "$ACTIVE_CADDY")"
  [[ "$normalized" == $':80 {\nroot * /usr/share/caddy\nfile_server\n}' ]] \
    || die 'active Caddyfile is neither the exact distro virgin configuration nor a managed staging version'
}

backup_file_once() {
  local source="$1"
  local label="$2"
  local digest
  local target
  local temporary

  digest="$(sha256sum -- "$source" | awk '{print $1}')"
  [[ "$digest" =~ ^[0-9a-f]{64}$ ]] || die "could not hash ${label}"
  target="${BACKUP_DIR}/${label}.${digest}.bak"

  if [[ -e "$target" || -L "$target" ]]; then
    assert_root_owned_regular "$target" "existing ${label} backup"
    [[ "$(stat -c '%a' -- "$target")" == '600' ]] || die "existing ${label} backup must have mode 0600"
    cmp -s -- "$source" "$target" || die "existing ${label} backup does not match its digest name"
    return
  fi

  temporary="$(mktemp "${BACKUP_DIR}/.${label}.tmp.XXXXXX")"
  install -o root -g root -m 0600 -- "$source" "$temporary"
  mv -T -- "$temporary" "$target"
}

validate_drop_in_candidate() {
  local raw_line
  local line
  local service_sections=0
  local environment_files=0

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="$(trim "${raw_line%$'\r'}")"
    case "$line" in
      ''|'#'*) ;;
      '[Service]') ((service_sections += 1)) ;;
      'EnvironmentFile=/opt/zhudatuan-staging-full/shared/full-caddy.env')
        ((environment_files += 1))
        ;;
      *) die "Caddy drop-in contains an unsupported directive: ${line}" ;;
    esac
  done < "$CANDIDATE_DROP_IN"

  [[ "$service_sections" == '1' ]] || die 'Caddy drop-in must contain exactly one [Service] section'
  [[ "$environment_files" == '1' ]] || die 'Caddy drop-in must contain exactly one approved EnvironmentFile'
}

validate_hostname() {
  local key="$1"
  local hostname="$2"
  local lowered
  local label
  local -a labels

  [[ "${#hostname}" -le 253 ]] || die "${key} exceeds the DNS hostname length limit"
  [[ "$hostname" == *.* ]] || die "${key} must be a fully qualified staging hostname"
  [[ "$hostname" =~ ^[A-Za-z0-9.-]+$ ]] || die "${key} must not contain a scheme, port, path, wildcard, or whitespace"
  [[ ! "$hostname" =~ ^[0-9.]+$ ]] || die "${key} must be a hostname, not an IP address"

  lowered="${hostname,,}"
  [[ ".${lowered}." == *'.staging.'* ]] || die "${key} must contain a staging DNS label"
  [[ "$lowered" != 'accounts.zhudatuan.com' && "$lowered" != 'console.zhudatuan.com'
    && "$lowered" != 'api.zhudatuan.com' ]] || die "${key} must not use a production hostname"

  IFS='.' read -r -a labels <<< "$hostname"
  for label in "${labels[@]}"; do
    [[ "${#label}" -ge 1 && "${#label}" -le 63 ]] || die "${key} contains an invalid DNS label length"
    [[ "$label" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]] \
      || die "${key} contains an invalid DNS label: ${label}"
  done
}

declare -A caddy_hosts=()

read_and_validate_environment() {
  local raw_line
  local line
  local key
  local value
  local required_key
  local normalized
  declare -A normalized_hosts=()

  [[ "$(stat -c '%a' -- "$CADDY_ENV")" == '600' ]] || die "Caddy environment must have mode 0600: ${CADDY_ENV}"

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="$(trim "${raw_line%$'\r'}")"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=([^[:space:]#]+)$ ]] \
      || die "Caddy environment contains an invalid line"
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$key" in
      ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST|ZHUDATUAN_STAGING_FULL_CONSOLE_HOST|ZHUDATUAN_STAGING_FULL_API_HOST) ;;
      *) die "Caddy environment contains an unknown key: ${key}" ;;
    esac
    [[ -z "${caddy_hosts[$key]+present}" ]] || die "Caddy environment repeats key: ${key}"
    validate_hostname "$key" "$value"
    normalized="${value,,}"
    [[ -z "${normalized_hosts[$normalized]+present}" ]] || die 'Caddy public hostnames must be distinct'
    caddy_hosts["$key"]="$value"
    normalized_hosts["$normalized"]="$key"
  done < "$CADDY_ENV"

  for required_key in "${REQUIRED_HOST_KEYS[@]}"; do
    [[ -n "${caddy_hosts[$required_key]+present}" ]] || die "Caddy environment is missing key: ${required_key}"
  done
  [[ "${#caddy_hosts[@]}" == "${#REQUIRED_HOST_KEYS[@]}" ]] || die 'Caddy environment must contain exactly three host keys'
}

assert_distro_caddy_unit() {
  local fragment_path
  local exec_start
  local drop_in_paths

  command -v systemctl >/dev/null 2>&1 || die 'systemctl is unavailable'
  systemctl cat caddy.service >/dev/null 2>&1 || die 'the distro caddy.service unit is unavailable'
  fragment_path="$(systemctl show caddy.service --no-pager --property=FragmentPath --value)"
  case "$fragment_path" in
    '/lib/systemd/system/caddy.service'|'/usr/lib/systemd/system/caddy.service') ;;
    *) die "caddy.service does not use a distro unit fragment: ${fragment_path}" ;;
  esac
  exec_start="$(systemctl show caddy.service --no-pager --property=ExecStart --value)"
  [[ "$exec_start" == *'/etc/caddy/Caddyfile'* ]] \
    || die 'the effective distro caddy.service ExecStart does not use /etc/caddy/Caddyfile'
  drop_in_paths="$(systemctl show caddy.service --no-pager --property=DropInPaths --value)"
  [[ -z "$drop_in_paths" || "$drop_in_paths" == "$ACTIVE_DROP_IN" ]] \
    || die "caddy.service has an unapproved drop-in: ${drop_in_paths}"
}

assert_live_dedicated_host() {
  [[ -x /usr/bin/node ]] || die '/usr/bin/node is unavailable'
  assert_root_owned_regular "$READINESS_MAIN" 'staging readiness executable'
  assert_root_owned_regular "$READINESS_EVIDENCE" 'staging readiness evidence'
  /usr/bin/node "$READINESS_MAIN" --evidence "$READINESS_EVIDENCE" --check P05 \
    || die 'P05 live IMDSv2 dedicated-host verification failed'
}

install_atomically() {
  local source="$1"
  local target="$2"
  local target_directory="$3"
  local mode="$4"
  local temporary

  temporary="$(mktemp "${target_directory}/.$(basename "$target").tmp.XXXXXX")"
  install -o root -g root -m "$mode" -- "$source" "$temporary"
  mv -fT -- "$temporary" "$target"
}

main() {
  local caddy_bin

  [[ "${EUID}" == '0' ]] || die 'this installer must run as root'
  [[ "${1:-}" == '--dedicated-staging-host' && "$#" == '1' ]] \
    || die 'pass --dedicated-staging-host only after the ECS isolation gate is approved'

  assert_root_owned_regular "$CANDIDATE_CADDY" 'candidate Caddyfile'
  assert_root_owned_regular "$CANDIDATE_DROP_IN" 'candidate Caddy drop-in'
  assert_root_owned_regular "$CADDY_ENV" 'Caddy environment'
  assert_live_dedicated_host
  assert_root_owned_regular "$ACTIVE_CADDY" 'active Caddyfile'
  assert_root_owned_directory '/etc/caddy' 'Caddy configuration directory'
  assert_root_owned_directory '/etc/systemd/system' 'systemd configuration directory'

  reject_production_or_import "$CANDIDATE_CADDY" 'candidate Caddyfile'
  reject_production_or_import "$ACTIVE_CADDY" 'active Caddyfile'
  grep -Fqx -- "$MANAGED_MARKER" "$CANDIDATE_CADDY" \
    || die 'candidate Caddyfile does not carry the exact managed marker'
  [[ "$(sed -n '1p' -- "$CANDIDATE_CADDY")" == "$MANAGED_MARKER" ]] \
    || die 'candidate Caddy marker must be the first line'
  assert_virgin_or_managed_caddy
  validate_drop_in_candidate
  read_and_validate_environment
  assert_distro_caddy_unit

  if [[ -e "$ACTIVE_DROP_IN" || -L "$ACTIVE_DROP_IN" ]]; then
    assert_root_owned_regular "$ACTIVE_DROP_IN" 'active Caddy drop-in'
    grep -Fqx -- "$MANAGED_MARKER" "$ACTIVE_DROP_IN" \
      || die "an unmanaged Caddy drop-in already occupies ${ACTIVE_DROP_IN}"
  fi

  caddy_bin="$(command -v caddy)" || die 'caddy is unavailable'
  env \
    "ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST=${caddy_hosts[ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST]}" \
    "ZHUDATUAN_STAGING_FULL_CONSOLE_HOST=${caddy_hosts[ZHUDATUAN_STAGING_FULL_CONSOLE_HOST]}" \
    "ZHUDATUAN_STAGING_FULL_API_HOST=${caddy_hosts[ZHUDATUAN_STAGING_FULL_API_HOST]}" \
    "$caddy_bin" validate --config "$CANDIDATE_CADDY" --adapter caddyfile

  if [[ ! -e "$CADDY_DROP_IN_DIR" && ! -L "$CADDY_DROP_IN_DIR" ]]; then
    install -d -o root -g root -m 0755 -- "$CADDY_DROP_IN_DIR"
  fi
  assert_root_owned_directory "$CADDY_DROP_IN_DIR" 'Caddy systemd drop-in directory'

  if [[ ! -e "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]]; then
    install -d -o root -g root -m 0700 -- "$BACKUP_DIR"
  fi
  assert_root_owned_directory "$BACKUP_DIR" 'Caddy backup directory'
  [[ "$(stat -c '%a' -- "$BACKUP_DIR")" == '700' ]] || die 'Caddy backup directory must have mode 0700'
  backup_file_once "$ACTIVE_CADDY" 'Caddyfile'
  if [[ -e "$ACTIVE_DROP_IN" ]]; then
    backup_file_once "$ACTIVE_DROP_IN" 'zhudatuan-staging-full.conf'
  fi

  install_atomically "$CANDIDATE_DROP_IN" "$ACTIVE_DROP_IN" "$CADDY_DROP_IN_DIR" '0644'
  install_atomically "$CANDIDATE_CADDY" "$ACTIVE_CADDY" '/etc/caddy' '0644'

  printf '%s\n' \
    'Caddy candidate files installed without daemon-reload, reload, restart, or traffic change.' \
    'A separate approved step must re-verify the installed bytes, run systemctl daemon-reload,' \
    'validate the active configuration with the same environment, and restart caddy.'
}

main "$@"
