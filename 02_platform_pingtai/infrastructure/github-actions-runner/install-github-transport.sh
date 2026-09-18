#!/usr/bin/env bash
# Install a GitHub-only sing-box line for the Aliyun Runner processes.
# GitHub traffic uses the local proxy; OSS, metadata and production stay direct.
set -euo pipefail

readonly SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CONFIG_ROOT='/etc/sing-box'
readonly CONFIG_PATH="$CONFIG_ROOT/zdt-github-line.json"
readonly SERVICE_PATH='/etc/systemd/system/zdt-github-line.service'
readonly NETWORK_ENV_ROOT='/etc/zdt-runner'
readonly NETWORK_ENV_PATH="$NETWORK_ENV_ROOT/github-network.env"
readonly PROXY_PORT="${ZDT_GITHUB_LINE_LISTEN_PORT:-7890}"
readonly PROXY_URL="http://127.0.0.1:${PROXY_PORT}"
readonly NO_PROXY_VALUE='localhost,127.0.0.1,::1,100.100.100.200,123.57.62.202,123.57.232.253,172.27.70.37,.aliyuncs.com,.fufuwang.com.cn'
readonly RUNNER_SERVICES=(
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build.service'
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build-2.service'
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release.service'
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release-standby.service'
)

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the Aliyun Runner host.' >&2; exit 64; }
sing_box="$(command -v sing-box)"
node_bin="$(command -v node)"

install -d -m 0700 "$CONFIG_ROOT"
config_tmp="$(mktemp "$CONFIG_ROOT/.zdt-github-line.XXXXXX")"
trap 'rm -f -- "$config_tmp"' EXIT
"$node_bin" "$SCRIPT_ROOT/render-github-singbox-config.mjs" > "$config_tmp"
install -m 0600 "$config_tmp" "$CONFIG_PATH"
rm -f -- "$config_tmp"
trap - EXIT

service_tmp="$(mktemp /etc/systemd/system/.zdt-github-line.XXXXXX)"
printf '%s\n' \
  '[Unit]' \
  'Description=ZDT GitHub sing-box line' \
  'After=network-online.target' \
  'Wants=network-online.target' \
  '' \
  '[Service]' \
  'Type=simple' \
  "ExecStart=${sing_box} run -c ${CONFIG_PATH}" \
  'Restart=on-failure' \
  'RestartSec=1' \
  '' \
  '[Install]' \
  'WantedBy=multi-user.target' \
  > "$service_tmp"
install -m 0644 "$service_tmp" "$SERVICE_PATH"
rm -f -- "$service_tmp"

install -d -m 0755 "$NETWORK_ENV_ROOT"
network_tmp="$(mktemp "$NETWORK_ENV_ROOT/.github-network.XXXXXX")"
printf '%s\n' \
  "HTTP_PROXY=${PROXY_URL}" \
  "HTTPS_PROXY=${PROXY_URL}" \
  "http_proxy=${PROXY_URL}" \
  "https_proxy=${PROXY_URL}" \
  "NO_PROXY=${NO_PROXY_VALUE}" \
  "no_proxy=${NO_PROXY_VALUE}" \
  'GIT_HTTP_LOW_SPEED_LIMIT=1024' \
  'GIT_HTTP_LOW_SPEED_TIME=20' \
  > "$network_tmp"
install -m 0644 "$network_tmp" "$NETWORK_ENV_PATH"
rm -f -- "$network_tmp"

configured=()
for service in "${RUNNER_SERVICES[@]}"; do
  systemctl cat "$service" >/dev/null 2>&1 || continue
  drop_in="/etc/systemd/system/${service}.d"
  install -d -m 0755 "$drop_in"
  printf '%s\n' \
    '[Service]' \
    "EnvironmentFile=${NETWORK_ENV_PATH}" \
    > "$drop_in/20-github-transport.conf"
  configured+=("$service")
done

systemctl daemon-reload
systemctl enable zdt-github-line.service
systemctl restart zdt-github-line.service

applied=()
pending=()
for service in "${configured[@]}"; do
  if ! systemctl is-active --quiet "$service"; then continue; fi
  control_group="$(systemctl show "$service" -p ControlGroup --value)"
  worker_active=true
  if [ -r "/sys/fs/cgroup${control_group}/cgroup.procs" ]; then
    worker_active=false
    while read -r pid; do
      if tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null | grep -q 'Runner.Worker'; then
        worker_active=true
        break
      fi
    done < "/sys/fs/cgroup${control_group}/cgroup.procs"
  fi
  if [ "$worker_active" = true ]; then
    pending+=("$service")
  else
    systemctl restart "$service"
    applied+=("$service")
  fi
done

printf 'GitHub sing-box line installed: proxy=%s configured=%s applied=%s pending-next-restart=%s\n' \
  "$PROXY_URL" "${#configured[@]}" "${#applied[@]}" "${#pending[@]}"
