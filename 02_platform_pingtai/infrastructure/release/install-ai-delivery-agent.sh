#!/usr/bin/env bash
set -euo pipefail

mode="${1:-agent}"
repo_root="${2:-$(pwd)}"
node_scope="${3:-all}"
if [[ "$mode" == /* ]]; then
  repo_root="$mode"
  mode=agent
fi
case "$mode" in
  agent-candidate|agent|access-candidate|runtime-candidate|verify) ;;
  *) printf 'usage: %s [agent-candidate|agent|access-candidate|runtime-candidate|verify] [repo-root]\n' "$0" >&2; exit 64 ;;
esac
case "$node_scope" in
  all|zhudatuan-l0|hbbtzn-l1) ;;
  *) printf 'unsupported node scope: %s\n' "$node_scope" >&2; exit 64 ;;
esac
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { printf 'AI delivery install requires root\n' >&2; exit 1; }

expected_instance_id="${EXPECTED_INSTANCE_ID:-i-2zeewhay0farxq8lucrd}"
metadata_url='http://100.100.100.200/latest/meta-data/instance-id'
actual_instance_id="$(curl -fsS --max-time 2 "$metadata_url")"
[[ "$actual_instance_id" == "$expected_instance_id" ]] || {
  printf 'AI delivery install refused: expected instance %s, got %s\n' "$expected_instance_id" "$actual_instance_id" >&2
  exit 1
}

agent_source="$repo_root/04_tools/release-engine/remote/agent.mjs"
candidate_gateway_source="$repo_root/04_tools/release-engine/remote/candidate-gateway.mjs"
candidate_keys_source="$repo_root/02_platform_pingtai/infrastructure/release/zdt-next.candidate-authorized-keys"
policy_source="$repo_root/02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json"
unit_source="$repo_root/02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd"
node --check "$agent_source"
node --check "$candidate_gateway_source"
node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync(process.argv[1])); if(p.schema!=="ai.delivery.remote-policy.v1"||p.project!=="zdt-next") process.exit(1)' "$policy_source"
[[ "$(grep -c '^ssh-ed25519 ' "$candidate_keys_source")" -ge 2 ]] || { printf 'candidate authorization requires separately attributable CI and workstation keys\n' >&2; exit 1; }

if [[ "$mode" == agent-candidate ]]; then
  printf 'AI delivery agent candidate validated without installation, pointer, process, service, or traffic changes: project=zdt-next source=%s\n' "$repo_root"
  exit 0
fi

if [[ "$mode" == access-candidate ]]; then
  candidate_user=zdt-candidate
  candidate_home=/var/lib/ai-delivery-candidate
  if ! getent group "$candidate_user" >/dev/null 2>&1; then
    groupadd --system "$candidate_user"
  fi
  if ! id "$candidate_user" >/dev/null 2>&1; then
    useradd --system --gid "$candidate_user" --create-home --home-dir "$candidate_home" --shell /bin/bash "$candidate_user"
  fi
  usermod --lock --shell /bin/bash "$candidate_user"
  install -d -o root -g root -m 0755 "$candidate_home" "$candidate_home/.ssh" /usr/local/sbin /etc/sudoers.d
  install -m 0755 "$candidate_gateway_source" /usr/local/sbin/ai-delivery-candidate
  candidate_authorized_keys="$(mktemp)"
  candidate_sudoers="$(mktemp)"
  trap 'rm -f "$candidate_authorized_keys" "$candidate_sudoers"' EXIT
  sed 's#^#restrict,command="/usr/local/sbin/ai-delivery-candidate" #' "$candidate_keys_source" > "$candidate_authorized_keys"
  install -o root -g root -m 0644 "$candidate_authorized_keys" "$candidate_home/.ssh/authorized_keys"
  printf '%s\n' 'zdt-candidate ALL=(root) NOPASSWD: /usr/local/sbin/ai-delivery-candidate --agent *' > "$candidate_sudoers"
  chmod 0440 "$candidate_sudoers"
  visudo -cf "$candidate_sudoers" >/dev/null
  install -o root -g root -m 0440 "$candidate_sudoers" /etc/sudoers.d/ai-delivery-zdt-candidate
  install -d -o root -g root -m 0700 /opt/ai-delivery/incoming
  install -d -o "$candidate_user" -g "$candidate_user" -m 0700 /opt/ai-delivery/uploads
  [[ "$(stat -c '%U:%a' /usr/local/lib/ai-delivery/agent.mjs)" == root:755 ]] || { printf 'candidate account must not own the executor\n' >&2; exit 1; }
  [[ "$(stat -c '%U:%a' /etc/ai-delivery/projects/zdt-next.json)" == root:644 ]] || { printf 'candidate account must not own the policy\n' >&2; exit 1; }
  printf 'Candidate-only SSH identity installed: user=%s actions=lookup,reuse,stage,status,verify production-actions=denied\n' "$candidate_user"
  exit 0
fi

if [[ "$mode" == verify ]]; then
  cmp -s "$agent_source" /usr/local/lib/ai-delivery/agent.mjs
  cmp -s "$policy_source" /etc/ai-delivery/projects/zdt-next.json
  cmp -s "$candidate_gateway_source" /usr/local/sbin/ai-delivery-candidate
  id zdt-candidate >/dev/null
  visudo -cf /etc/sudoers.d/ai-delivery-zdt-candidate >/dev/null
  printf 'AI delivery agent verified: project=zdt-next\n'
  exit 0
fi

install -d -m 0755 \
  /usr/local/lib/ai-delivery \
  /etc/ai-delivery/projects \
  /etc/ai-delivery/candidates \
  /opt/ai-delivery/incoming \
  /opt/ai-delivery/dependency-layers \
  /var/log/ai-delivery
install -m 0755 "$agent_source" /usr/local/lib/ai-delivery/agent.mjs
install -m 0644 "$policy_source" /etc/ai-delivery/projects/zdt-next.json

if [[ "$mode" == agent ]]; then
  printf 'AI delivery agent installed without pointer, process, service, or traffic changes: project=zdt-next\n'
  exit 0
fi

required_pointers=()
units=()
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  required_pointers+=(
    /opt/zhudatuan/targets/storefront/current
    /opt/zhudatuan/targets/storefront/runtime
    /opt/zhudatuan/targets/identity-api/current
    /opt/zhudatuan/targets/purchase-api/current
    /opt/zhudatuan/targets/web-api/current
    /opt/zhudatuan/targets/catalog-api/current
    /opt/zhudatuan/targets/catalog-jobs/current
    /opt/zhudatuan/targets/payment-webhook-api/current
    /opt/zhudatuan/targets/payment-jobs/current
  )
  units+=(
    zhudatuan-api.service
    zhudatuan-purchase-api.service
    zhudatuan-web-api.service
    zhudatuan-catalog-api.service
    zhudatuan-catalog-jobs.service
    zhudatuan-payment-webhook-api.service
    zhudatuan-payment-jobs.service
  )
fi
if [[ "$node_scope" == all || "$node_scope" == hbbtzn-l1 ]]; then
  required_pointers+=(
    /opt/sfl/nodes/hbbtzn-l1/targets/storefront/current
    /opt/sfl/nodes/hbbtzn-l1/targets/storefront/runtime
    /opt/sfl/nodes/hbbtzn-l1/targets/identity-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/purchase-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/web-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/catalog-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/catalog-jobs/current
    /opt/sfl/nodes/hbbtzn-l1/targets/payment-webhook-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/payment-jobs/current
  )
  units+=(
    sfl-storefront@.service
    sfl-identity-api@.service
    sfl-purchase-api@.service
    sfl-web-api@.service
    sfl-catalog-api@.service
    sfl-catalog-jobs@.service
    sfl-payment-webhook-api@.service
    sfl-payment-jobs@.service
  )
fi
for pointer in "${required_pointers[@]}"; do
  [[ -L "$pointer" && -e "$pointer" ]] || { printf 'runtime layout refused: seed and verify %s first\n' "$pointer" >&2; exit 1; }
  target_root="${pointer%/*}"
  target_parent="${target_root%/*}"
  chmod 0755 "$target_parent" "$target_root"
done

for unit in "${units[@]}"; do install -m 0644 "$unit_source/$unit" "/etc/systemd/system/$unit"; done
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  install -m 0644 "$repo_root/02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs" /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs
fi
systemctl daemon-reload
printf 'Runtime definitions installed for %s only after seed verification; no service was restarted and no traffic was switched.\n' "$node_scope"
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  printf 'The PM2 storefront candidate remains inactive at /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs.\n'
fi
