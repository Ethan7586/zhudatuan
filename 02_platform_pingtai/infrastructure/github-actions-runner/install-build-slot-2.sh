#!/usr/bin/env bash
# Install the second isolated build slot on the Runner host.
set -euo pipefail

readonly REPOSITORY_URL='https://github.com/Ethan7586/zhudatuan'
readonly RUNNER_VERSION='2.337.0'
readonly RUNNER_ARCHIVE='actions-runner-linux-x64-2.337.0.tar.gz'
readonly RUNNER_ARCHIVE_SHA256='70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613'
readonly RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"
readonly RUNNER_NAME='aliyun-staging-zdt-build-2'
readonly RUNNER_USER='zdt-build-2'
readonly RUNNER_ROOT='/opt/actions-runner-build-2'
readonly NETWORK_ENV='/etc/zdt-runner/github-network.env'
readonly NODE_VERSION='22.22.0'
readonly NODE_ARCHIVE_SHA256='9aa8e9d2298ab68c600bd6fb86a6c13bce11a4eca1ba9b39d79fa021755d7c37'
readonly NO_PROXY_VALUE='localhost,127.0.0.1,::1,100.100.100.200,123.57.62.202,123.57.232.253,172.27.70.37,.aliyuncs.com,.fufuwang.com.cn'

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the Runner host.' >&2; exit 64; }
[[ "${ZDT_GITHUB_PROXY_URL:-}" =~ ^http://127\.0\.0\.1:[0-9]{2,5}$ ]] || {
  echo 'ZDT_GITHUB_PROXY_URL must be a loopback HTTP proxy.' >&2; exit 64;
}
[ -f "$NETWORK_ENV" ] || { echo "Install the authoritative Runner network file first: ${NETWORK_ENV}" >&2; exit 64; }
if find /proc/[0-9]*/exe -lname '*/Runner.Worker' -print -quit 2>/dev/null | grep -q .; then
  echo 'A Runner job is active; retry after it finishes.' >&2; exit 75
fi

if [ ! -f "$RUNNER_ROOT/.runner" ]; then
  [ -n "${RUNNER_REGISTRATION_TOKEN:-}" ] || { echo 'RUNNER_REGISTRATION_TOKEN is required.' >&2; exit 64; }
  install_root="$(mktemp -d /var/tmp/zdt-build-2.XXXXXX)"
  trap 'rm -rf -- "$install_root"' EXIT
  curl -fL --retry 4 --retry-all-errors --connect-timeout 15 --max-time 180 \
    --proxy "$ZDT_GITHUB_PROXY_URL" "$RUNNER_URL" -o "$install_root/$RUNNER_ARCHIVE"
  printf '%s  %s\n' "$RUNNER_ARCHIVE_SHA256" "$install_root/$RUNNER_ARCHIVE" | sha256sum -c -
  id "$RUNNER_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUNNER_USER"
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0700 "$RUNNER_ROOT"
  tar -xzf "$install_root/$RUNNER_ARCHIVE" -C "$RUNNER_ROOT"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"
  runuser -u "$RUNNER_USER" -- env \
    HTTP_PROXY="$ZDT_GITHUB_PROXY_URL" HTTPS_PROXY="$ZDT_GITHUB_PROXY_URL" \
    NO_PROXY="$NO_PROXY_VALUE" \
    "$RUNNER_ROOT/config.sh" --unattended \
    --url "$REPOSITORY_URL" --token "$RUNNER_REGISTRATION_TOKEN" --name "$RUNNER_NAME" \
    --labels 'zdt-aliyun-build,zdt-aliyun-build-2' --work '_work' --replace
  unset RUNNER_REGISTRATION_TOKEN
  rm -rf -- "$install_root"
  trap - EXIT
fi

service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${RUNNER_NAME}.service" -print -quit)"
if [ -z "$service_path" ]; then (cd "$RUNNER_ROOT" && ./svc.sh install "$RUNNER_USER"); fi
service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${RUNNER_NAME}.service" -print -quit)"
[ -n "$service_path" ] || { echo 'Build slot 2 service was not installed.' >&2; exit 1; }
service_name="$(basename "$service_path")"
node_root="$RUNNER_ROOT/_work/_tool/node/$NODE_VERSION/x64"
if [ ! -x "$node_root/bin/node" ]; then
  node_tmp="$(mktemp -d /var/tmp/zdt-node-22.XXXXXX)"
  trap 'rm -rf -- "$node_tmp"' EXIT
  curl -fL --retry 4 --retry-all-errors --connect-timeout 15 --max-time 180 \
    --proxy "$ZDT_GITHUB_PROXY_URL" "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    -o "$node_tmp/node.tar.xz"
  printf '%s  %s\n' "$NODE_ARCHIVE_SHA256" "$node_tmp/node.tar.xz" | sha256sum -c -
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0700 "$node_root"
  tar -xJf "$node_tmp/node.tar.xz" --strip-components=1 -C "$node_root"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT/_work"
  test "$($node_root/bin/node --version)" = "v${NODE_VERSION}"
  test "$($node_root/bin/npm --version)" = '10.9.4'
fi
drop_in="/etc/systemd/system/${service_name}.d"
install -d -m 0755 "$drop_in"
env_tmp="$(mktemp "$RUNNER_ROOT/.env.new.XXXXXX")"
grep -Ev '^(HTTP_PROXY|HTTPS_PROXY|http_proxy|https_proxy|NO_PROXY|no_proxy)=' "$RUNNER_ROOT/.env" > "$env_tmp" || true
install -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0600 "$env_tmp" "$RUNNER_ROOT/.env"
rm -f -- "$env_tmp"
printf '%s\n' '[Service]' \
  "EnvironmentFile=${NETWORK_ENV}" \
  'UMask=0077' 'TasksMax=2048' \
  > "$drop_in/20-zdt-runner.conf"
chmod 0700 "$RUNNER_ROOT" "$RUNNER_ROOT/_work" 2>/dev/null || true
systemctl daemon-reload
systemctl disable "$service_name" >/dev/null 2>&1 || true
systemctl stop "$service_name" >/dev/null 2>&1 || true
printf 'Build slot 2 installed offline; apply the shared capacity policy before activation: %s\n' "$service_name"
