#!/usr/bin/env bash
# Configure the shared build slice for the two build Runner services.
set -euo pipefail

readonly SERVICES=(
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build.service'
  'actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-build-2.service'
)

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the Runner host.' >&2; exit 64; }
if find /proc/[0-9]*/exe -lname '*/Runner.Worker' -print -quit 2>/dev/null | grep -q .; then
  echo 'A Runner job is active; retry after it finishes.' >&2; exit 75
fi
for service in "${SERVICES[@]}"; do systemctl cat "$service" >/dev/null; done

rm -f -- /etc/tmpfiles.d/zdt-build-lock.conf /run/lock/zdt-build/heavy.lock
rmdir -- /run/lock/zdt-build 2>/dev/null || true

build_cpu_quota="${ZDT_BUILD_CPU_QUOTA:-350%}"
build_memory_high="${ZDT_BUILD_MEMORY_HIGH:-6G}"
build_memory_max="${ZDT_BUILD_MEMORY_MAX:-6800M}"
printf '%s\n' '[Slice]' "CPUQuota=${build_cpu_quota}" "MemoryHigh=${build_memory_high}" "MemoryMax=${build_memory_max}" 'TasksMax=3072' \
  > /etc/systemd/system/zdt-build.slice

for service in "${SERVICES[@]}"; do
  drop_in="/etc/systemd/system/${service}.d"
  install -d -m 0755 "$drop_in"
  printf '%s\n' '[Service]' 'UMask=0077' 'Slice=zdt-build.slice' 'CPUWeight=100' \
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
printf 'Two build slots active in one slice: CPUQuota=%s MemoryHigh=%s MemoryMax=%s\n' "$build_cpu_quota" "$build_memory_high" "$build_memory_max"
