#!/usr/bin/env bash
# Install one cold release Runner on the Runner host.
# The Runner is registered with GitHub but left stopped and disabled.
set -euo pipefail

readonly REPOSITORY_URL='https://github.com/Ethan7586/zhudatuan'
readonly RUNNER_VERSION='2.337.0'
readonly RUNNER_ARCHIVE='actions-runner-linux-x64-2.337.0.tar.gz'
readonly RUNNER_ARCHIVE_SHA256='70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613'
readonly RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"
readonly RUNNER_NAME='aliyun-staging-zdt-release-standby'
readonly RUNNER_USER='zdt-release-standby'
readonly RUNNER_ROOT='/opt/actions-runner-release-standby'

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this installer as root on the Runner host.' >&2
  exit 64
fi
if [ "$(uname -s)" != 'Linux' ] || [ "$(uname -m)" != 'x86_64' ]; then
  echo 'The standby Runner requires Linux x64.' >&2
  exit 64
fi

if [ ! -f "$RUNNER_ROOT/.runner" ]; then
  if [ -z "${RUNNER_REGISTRATION_TOKEN:-}" ]; then
    echo 'RUNNER_REGISTRATION_TOKEN is required for first installation.' >&2
    exit 64
  fi

  install_root="$(mktemp -d /var/tmp/zdt-release-standby.XXXXXX)"
  cleanup() {
    rm -rf -- "$install_root"
  }
  trap cleanup EXIT

  curl -fL --retry 4 --retry-all-errors --connect-timeout 15 --max-time 180 \
    "$RUNNER_URL" -o "$install_root/$RUNNER_ARCHIVE"
  printf '%s  %s\n' "$RUNNER_ARCHIVE_SHA256" "$install_root/$RUNNER_ARCHIVE" | sha256sum -c -

  id "$RUNNER_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUNNER_USER"
  install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0755 "$RUNNER_ROOT"
  tar -xzf "$install_root/$RUNNER_ARCHIVE" -C "$RUNNER_ROOT"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"

  runuser -u "$RUNNER_USER" -- "$RUNNER_ROOT/config.sh" \
    --unattended \
    --url "$REPOSITORY_URL" \
    --token "$RUNNER_REGISTRATION_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels 'zdt-aliyun-release,zdt-aliyun-release-standby' \
    --work '_work' \
    --replace
  unset RUNNER_REGISTRATION_TOKEN
fi

service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${RUNNER_NAME}.service" -print -quit)"
if [ -z "$service_path" ]; then
  (
    cd "$RUNNER_ROOT"
    ./svc.sh install "$RUNNER_USER"
  )
  service_path="$(find /etc/systemd/system -maxdepth 1 -type f -name "actions.runner.*.${RUNNER_NAME}.service" -print -quit)"
fi
if [ -z "$service_path" ]; then
  echo 'Standby service unit was not installed.' >&2
  exit 1
fi
service_name="$(basename "$service_path")"
systemctl stop "$service_name" >/dev/null 2>&1 || true
systemctl disable "$service_name" >/dev/null 2>&1 || true
if systemctl is-active --quiet "$service_name"; then
  echo 'Standby service must remain stopped after installation.' >&2
  exit 1
fi

printf 'Registered cold standby: %s\nService: %s\nState: stopped and disabled\n' "$RUNNER_NAME" "$service_name"
