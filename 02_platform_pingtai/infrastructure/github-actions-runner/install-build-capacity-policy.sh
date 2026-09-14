#!/usr/bin/env bash
# Bound two build slots to the 4-vCPU/8-GiB staging host budget.
set -euo pipefail

readonly EXPECTED_INSTANCE_ID='i-2zeewhay0farxq8lucrc'
readonly SERVICES=(
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build.service'
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build-2.service'
)

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the staging ECS.' >&2; exit 64; }
token="$(curl -fsS --max-time 3 -X PUT -H 'X-aliyun-ecs-metadata-token-ttl-seconds: 60' http://100.100.100.200/latest/api/token)"
instance="$(curl -fsS --max-time 3 -H "X-aliyun-ecs-metadata-token: $token" http://100.100.100.200/latest/meta-data/instance-id)"
[ "$instance" = "$EXPECTED_INSTANCE_ID" ] || { echo "Refusing capacity policy on $instance." >&2; exit 64; }
if find /proc/[0-9]*/exe -lname '*/Runner.Worker' -print -quit 2>/dev/null | grep -q .; then
  echo 'A Runner job is active; retry after it finishes.' >&2; exit 75
fi

getent group zdt-builders >/dev/null || groupadd --system zdt-builders
for user in zdt-build zdt-build-2; do usermod -a -G zdt-builders "$user"; done
install -d -o root -g zdt-builders -m 0770 /run/lock/zdt-build
install -o root -g zdt-builders -m 0660 /dev/null /run/lock/zdt-build/heavy.lock
printf '%s\n' \
  'd /run/lock/zdt-build 0770 root zdt-builders -' \
  'f /run/lock/zdt-build/heavy.lock 0660 root zdt-builders -' \
  > /etc/tmpfiles.d/zdt-build-lock.conf
printf '%s\n' '[Slice]' 'CPUQuota=350%' 'MemoryHigh=6G' 'MemoryMax=6800M' 'TasksMax=3072' \
  > /etc/systemd/system/zdt-build.slice

for service in "${SERVICES[@]}"; do
  systemctl cat "$service" >/dev/null
  drop_in="/etc/systemd/system/${service}.d"
  install -d -m 0755 "$drop_in"
  printf '%s\n' '[Service]' 'UMask=0077' 'Slice=zdt-build.slice' 'SupplementaryGroups=zdt-builders' 'CPUWeight=100' \
    'TasksMax=2048' > "$drop_in/30-build-capacity.conf"
done
chmod 0700 /opt/actions-runner-build /opt/actions-runner-build/_work \
  /opt/actions-runner-build-2 /opt/actions-runner-build-2/_work
systemctl daemon-reload
for service in "${SERVICES[@]}"; do
  systemctl enable "$service" >/dev/null
  systemctl kill --kill-who=all --signal=SIGTERM "$service" >/dev/null 2>&1 || true
  for _ in {1..15}; do
    systemctl is-active --quiet "$service" || break
    sleep 1
  done
  if systemctl is-active --quiet "$service"; then
    systemctl kill --kill-who=all --signal=SIGKILL "$service"
  fi
  systemctl reset-failed "$service" >/dev/null 2>&1 || true
  systemctl start "$service"
done
for service in "${SERVICES[@]}"; do systemctl is-active --quiet "$service"; done
echo 'Two build slots active inside one 3.5-CPU/6.8-GiB slice; heavy builds share one host lock.'
