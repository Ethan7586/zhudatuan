#!/usr/bin/env bash
# Route only GitHub traffic from the two Runner services through the existing
# loopback HTTP proxy. Aliyun metadata, OSS and production traffic stay direct.
set -euo pipefail

readonly EXPECTED_INSTANCE_ID='i-2zeewhay0farxq8lucrc'
readonly BUILD_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build.service'
readonly RELEASE_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release.service'
readonly NO_PROXY_VALUE='localhost,127.0.0.1,::1,100.100.100.200,123.57.62.202,123.57.232.253,172.27.70.37,.aliyuncs.com,.hbbtzn.com'

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this installer as root on the staging ECS.' >&2
  exit 64
fi
if [[ ! "${ZDT_GITHUB_PROXY_URL:-}" =~ ^http://127\.0\.0\.1:[0-9]{2,5}$ ]]; then
  echo 'ZDT_GITHUB_PROXY_URL must be a loopback HTTP proxy such as http://127.0.0.1:7890.' >&2
  exit 64
fi

metadata_token="$(curl -fsS --max-time 3 -X PUT \
  -H 'X-aliyun-ecs-metadata-token-ttl-seconds: 60' \
  http://100.100.100.200/latest/api/token)"
instance_id="$(curl -fsS --max-time 3 \
  -H "X-aliyun-ecs-metadata-token: ${metadata_token}" \
  http://100.100.100.200/latest/meta-data/instance-id)"
if [ "$instance_id" != "$EXPECTED_INSTANCE_ID" ]; then
  echo "Refusing transport installation on ${instance_id}; expected ${EXPECTED_INSTANCE_ID}." >&2
  exit 64
fi

for service in "$BUILD_SERVICE" "$RELEASE_SERVICE"; do
  systemctl cat "$service" >/dev/null
done
if pgrep -f '/opt/actions-runner-(build|release)/bin/Runner.Worker' >/dev/null; then
  echo 'A Runner job is active; retry after it finishes.' >&2
  exit 75
fi

for endpoint in \
  https://github.com/ \
  https://api.github.com/rate_limit \
  https://codeload.github.com/actions/checkout/tar.gz/refs/tags/v6; do
  curl -fsSIL --max-time 20 --proxy "$ZDT_GITHUB_PROXY_URL" -o /dev/null "$endpoint"
done

for service in "$BUILD_SERVICE" "$RELEASE_SERVICE"; do
  drop_in="/etc/systemd/system/${service}.d"
  install -d -m 0755 "$drop_in"
  umask 022
  printf '%s\n' \
    '[Service]' \
    "Environment=HTTP_PROXY=${ZDT_GITHUB_PROXY_URL}" \
    "Environment=HTTPS_PROXY=${ZDT_GITHUB_PROXY_URL}" \
    "Environment=http_proxy=${ZDT_GITHUB_PROXY_URL}" \
    "Environment=https_proxy=${ZDT_GITHUB_PROXY_URL}" \
    "Environment=NO_PROXY=${NO_PROXY_VALUE}" \
    "Environment=no_proxy=${NO_PROXY_VALUE}" \
    > "$drop_in/20-github-transport.conf"
done

systemctl daemon-reload
systemctl restart "$BUILD_SERVICE" "$RELEASE_SERVICE"
systemctl is-active --quiet "$BUILD_SERVICE"
systemctl is-active --quiet "$RELEASE_SERVICE"

echo 'Runner GitHub transport installed; Aliyun and production destinations remain direct.'
