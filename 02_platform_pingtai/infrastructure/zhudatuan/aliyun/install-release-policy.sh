#!/usr/bin/env bash
set -euo pipefail

script_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
expected_instance_id="${EXPECTED_INSTANCE_ID:-i-2zeewhay0farxq8lucrd}"
metadata_url='http://100.100.100.200/latest/meta-data/instance-id'
actual_instance_id="$(curl -fsS --max-time 2 "$metadata_url")"
[[ "$actual_instance_id" == "$expected_instance_id" ]] || {
  printf 'release-policy install refused: expected %s, got %s\n' "$expected_instance_id" "$actual_instance_id" >&2
  exit 1
}

install -D -m 0755 "$script_root/release-policy.sh" /usr/local/sbin/zhudatuan-release-policy
install -d -m 0755 /etc/zhudatuan
if [[ ! -e /etc/zhudatuan/release-retention.conf ]]; then
  install -m 0644 "$script_root/release-retention.conf.example" /etc/zhudatuan/release-retention.conf
fi
if [[ ! -e /etc/zhudatuan/release-pins ]]; then
  install -m 0644 /dev/null /etc/zhudatuan/release-pins
fi
for unit in zhudatuan-release-policy.service zhudatuan-release-policy.timer zhudatuan-release-policy.path; do
  install -m 0644 "$script_root/systemd/$unit" "/etc/systemd/system/$unit"
done

systemctl daemon-reload
/usr/local/sbin/zhudatuan-release-policy preflight
systemctl enable --now zhudatuan-release-policy.timer zhudatuan-release-policy.path
systemctl start zhudatuan-release-policy.service
printf 'release-policy installed for instance %s\n' "$actual_instance_id"
