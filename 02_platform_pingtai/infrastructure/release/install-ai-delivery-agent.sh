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
  agent-candidate|agent|runtime-candidate|verify) ;;
  *) printf 'usage: %s [agent-candidate|agent|runtime-candidate|verify] [repo-root]\n' "$0" >&2; exit 64 ;;
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
policy_source="$repo_root/02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json"
unit_source="$repo_root/02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd"
gateway_source="$repo_root/02_platform_pingtai/config/node-runtime/hbbtzn-l1/api-gateway.Caddyfile"
node --check "$agent_source"
node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync(process.argv[1])); if(p.schema!=="ai.delivery.remote-policy.v1"||p.project!=="zdt-next") process.exit(1)' "$policy_source"

if [[ "$mode" == agent-candidate ]]; then
  printf 'AI delivery agent candidate validated without installation, pointer, process, service, or traffic changes: project=zdt-next source=%s\n' "$repo_root"
  exit 0
fi

if [[ "$mode" == verify ]]; then
  cmp -s "$agent_source" /usr/local/lib/ai-delivery/agent.mjs
  cmp -s "$policy_source" /etc/ai-delivery/projects/zdt-next.json
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
    /opt/zhudatuan/targets/support-api/current
    /opt/zhudatuan/targets/purchase-api/current
    /opt/zhudatuan/targets/web-api/current
    /opt/zhudatuan/targets/catalog-api/current
    /opt/zhudatuan/targets/catalog-jobs/current
    /opt/zhudatuan/targets/payment-webhook-api/current
    /opt/zhudatuan/targets/payment-jobs/current
  )
  units+=(
    zhudatuan-api.service
    zhudatuan-console-support.service
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
    /opt/sfl/nodes/hbbtzn-l1/targets/auth-web/current
  )
  units+=(
    sfl-api-gateway@.service
    sfl-storefront@.service
  )
fi
for pointer in "${required_pointers[@]}"; do
  [[ -L "$pointer" && -e "$pointer" ]] || { printf 'runtime layout refused: seed and verify %s first\n' "$pointer" >&2; exit 1; }
  target_root="${pointer%/*}"
  target_parent="${target_root%/*}"
  chmod 0755 "$target_parent" "$target_root"
done

for unit in "${units[@]}"; do install -m 0644 "$unit_source/$unit" "/etc/systemd/system/$unit"; done
if [[ "$node_scope" == hbbtzn-l1 ]]; then
  gateway_candidate=/etc/ai-delivery/candidates/hbbtzn-l1.api-gateway.Caddyfile
  install -o root -g zhudatuan -m 0640 "$gateway_source" "$gateway_candidate"
  caddy validate --config "$gateway_candidate" --adapter caddyfile
  printf 'Gateway candidate validated for %s without installation, reload, or traffic changes.\n' "$node_scope"
fi
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  install -m 0644 "$repo_root/02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs" /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs
fi
systemctl daemon-reload
printf 'Runtime definitions installed for %s only after seed verification; no service was restarted and no traffic was switched.\n' "$node_scope"
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  printf 'The PM2 storefront candidate remains inactive at /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs.\n'
fi
