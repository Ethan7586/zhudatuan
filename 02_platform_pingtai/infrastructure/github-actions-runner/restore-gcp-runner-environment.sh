#!/usr/bin/env bash
# Install two portable build Runner slots on one persistent GCP Linux host.
set -euo pipefail

readonly REPOSITORY_URL='https://github.com/Ethan7586/zhudatuan'
readonly RUNNER_VERSION='2.337.0'
readonly RUNNER_ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
readonly RUNNER_ARCHIVE_SHA256='70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613'
readonly RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"
readonly NODE_VERSION='22.22.0'
readonly NODE_ARCHIVE_SHA256='9aa8e9d2298ab68c600bd6fb86a6c13bce11a4eca1ba9b39d79fa021755d7c37'
readonly CPU_QUOTA="${ZDT_BUILD_CPU_QUOTA:-350%}"
readonly MEMORY_HIGH="${ZDT_BUILD_MEMORY_HIGH:-6G}"
readonly MEMORY_MAX="${ZDT_BUILD_MEMORY_MAX:-6800M}"

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the GCP Runner host.' >&2; exit 64; }
[ "$(uname -s)" = 'Linux' ] && [ "$(uname -m)" = 'x86_64' ] || {
  echo 'The GCP Runner requires persistent Linux x64 compute.' >&2; exit 64;
}
[ -n "${RUNNER_REGISTRATION_TOKEN:-}" ] || { echo 'RUNNER_REGISTRATION_TOKEN is required.' >&2; exit 64; }
for command in curl find grep install runuser sha256sum systemctl tar useradd xz; do
  command -v "$command" >/dev/null || { echo "Required command is missing: ${command}" >&2; exit 69; }
done

download_root="$(mktemp -d /var/tmp/zdt-gcp-runner.XXXXXX)"
trap 'rm -rf -- "$download_root"' EXIT
curl_options=(--fail --location --retry 4 --retry-all-errors --connect-timeout 15 --max-time 180)
if [ -n "${ZDT_GITHUB_PROXY_URL:-}" ]; then curl_options+=(--proxy "$ZDT_GITHUB_PROXY_URL"); fi

download_runner() {
  [ -f "$download_root/$RUNNER_ARCHIVE" ] && return
  curl "${curl_options[@]}" "$RUNNER_URL" -o "$download_root/$RUNNER_ARCHIVE"
  printf '%s  %s\n' "$RUNNER_ARCHIVE_SHA256" "$download_root/$RUNNER_ARCHIVE" | sha256sum -c -
}

download_node() {
  [ -f "$download_root/node.tar.xz" ] && return
  curl "${curl_options[@]}" \
    "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    -o "$download_root/node.tar.xz"
  printf '%s  %s\n' "$NODE_ARCHIVE_SHA256" "$download_root/node.tar.xz" | sha256sum -c -
}

printf '%s\n' '[Slice]' "CPUQuota=${CPU_QUOTA}" "MemoryHigh=${MEMORY_HIGH}" \
  "MemoryMax=${MEMORY_MAX}" 'TasksMax=3072' > /etc/systemd/system/zdt-build.slice

services=()
for slot in 1 2; do
  runner_name="gcp-zdt-build-${slot}"
  runner_user="zdt-build-${slot}"
  runner_root="/opt/actions-runner-build-${slot}"
  runner_labels="zdt-build,zdt-build-${slot}"

  id "$runner_user" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$runner_user"
  if [ ! -f "$runner_root/.runner" ]; then
    download_runner
    install -d -o "$runner_user" -g "$runner_user" -m 0700 "$runner_root"
    tar -xzf "$download_root/$RUNNER_ARCHIVE" -C "$runner_root"
    chown -R "$runner_user:$runner_user" "$runner_root"
    runner_environment=()
    if [ -n "${ZDT_GITHUB_PROXY_URL:-}" ]; then
      runner_environment+=(HTTP_PROXY="$ZDT_GITHUB_PROXY_URL" HTTPS_PROXY="$ZDT_GITHUB_PROXY_URL")
    fi
    runuser -u "$runner_user" -- env "${runner_environment[@]}" \
      "$runner_root/config.sh" --unattended --url "$REPOSITORY_URL" \
      --token "$RUNNER_REGISTRATION_TOKEN" --name "$runner_name" \
      --labels "$runner_labels" --work '_work' --replace
  fi

  service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${runner_name}.service" -print -quit)"
  if [ -z "$service_path" ]; then (cd "$runner_root" && ./svc.sh install "$runner_user"); fi
  service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${runner_name}.service" -print -quit)"
  [ -n "$service_path" ] || { echo "Runner service was not installed: ${runner_name}" >&2; exit 1; }
  service_name="$(basename "$service_path")"
  services+=("$service_name")

  node_root="$runner_root/_work/_tool/node/$NODE_VERSION/x64"
  if [ ! -x "$node_root/bin/node" ]; then
    download_node
    install -d -o "$runner_user" -g "$runner_user" -m 0700 "$node_root"
    tar -xJf "$download_root/node.tar.xz" --strip-components=1 -C "$node_root"
    chown -R "$runner_user:$runner_user" "$runner_root/_work"
    test "$("$node_root/bin/node" --version)" = "v${NODE_VERSION}"
    test "$("$node_root/bin/npm" --version)" = '10.9.4'
  fi
  install -o "$runner_user" -g "$runner_user" -m 0600 /dev/null \
    "$runner_root/_work/_tool/node/$NODE_VERSION/x64.complete"

  drop_in="/etc/systemd/system/${service_name}.d"
  install -d -m 0755 "$drop_in"
  printf '%s\n' '[Service]' 'UMask=0077' 'Slice=zdt-build.slice' 'TasksMax=2048' \
    > "$drop_in/30-gcp-build-capacity.conf"
  chmod 0700 "$runner_root" "$runner_root/_work" 2>/dev/null || true
done

systemctl daemon-reload
for service in "${services[@]}"; do
  systemctl enable "$service" >/dev/null
  systemctl is-active --quiet "$service" || systemctl start "$service"
done
for service in "${services[@]}"; do systemctl is-active --quiet "$service"; done

printf 'GCP Runner environment online: slots=%s label=zdt-build CPUQuota=%s MemoryHigh=%s MemoryMax=%s\n' \
  "${#services[@]}" "$CPU_QUOTA" "$MEMORY_HIGH" "$MEMORY_MAX"
