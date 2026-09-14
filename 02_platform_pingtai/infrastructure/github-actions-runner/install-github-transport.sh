#!/usr/bin/env bash
# Route only GitHub traffic from the two Runner services through the existing
# loopback HTTP proxy. Aliyun metadata, OSS and production traffic stay direct.
set -euo pipefail

readonly EXPECTED_INSTANCE_ID='i-2zeewhay0farxq8lucrc'
readonly BUILD_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build.service'
readonly RELEASE_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release.service'
readonly STANDBY_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release-standby.service'
readonly NO_PROXY_VALUE='localhost,127.0.0.1,::1,100.100.100.200,123.57.62.202,123.57.232.253,172.27.70.37,.aliyuncs.com,.hbbtzn.com'
readonly ACTIVE_SERVICES=("$BUILD_SERVICE" "$RELEASE_SERVICE")
readonly ALL_SERVICES=("$BUILD_SERVICE" "$RELEASE_SERVICE" "$STANDBY_SERVICE")

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

for service in "${ALL_SERVICES[@]}"; do
  systemctl cat "$service" >/dev/null
done
if pgrep -f '/opt/actions-runner-(build|release|release-standby)/bin/Runner.Worker' >/dev/null; then
  echo 'A Runner job is active; retry after it finishes.' >&2
  exit 75
fi

for endpoint in https://github.com/ https://api.github.com/rate_limit; do
  curl -fsSL --retry 2 --retry-all-errors --max-time 20 \
    --proxy "$ZDT_GITHUB_PROXY_URL" -o /dev/null "$endpoint"
done
curl -fsSIL --retry 2 --retry-all-errors --max-time 20 \
  --proxy "$ZDT_GITHUB_PROXY_URL" -o /dev/null \
  https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-linux-x64-2.337.0.tar.gz

for service in "${ALL_SERVICES[@]}"; do
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
    'Environment=GIT_HTTP_LOW_SPEED_LIMIT=1024' \
    'Environment=GIT_HTTP_LOW_SPEED_TIME=20' \
    > "$drop_in/20-github-transport.conf"
done

systemctl daemon-reload
systemctl restart "${ACTIVE_SERVICES[@]}"
for service in "${ACTIVE_SERVICES[@]}"; do
  systemctl is-active --quiet "$service"
done
if systemctl is-active --quiet "$STANDBY_SERVICE" || systemctl is-enabled --quiet "$STANDBY_SERVICE"; then
  echo 'Cold standby must remain stopped and disabled.' >&2
  exit 1
fi

echo 'Runner GitHub transport installed; Aliyun and production destinations remain direct.'
