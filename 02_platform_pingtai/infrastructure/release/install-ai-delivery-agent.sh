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
  agent-candidate|agent|runtime-candidate|runtime|verify) ;;
  *) printf 'usage: %s [agent-candidate|agent|runtime-candidate|runtime|verify] [repo-root]\n' "$0" >&2; exit 64 ;;
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
    /opt/sfl/nodes/zhudatuan-l0/targets/identity-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/identity-notification-jobs/current
    /opt/sfl/nodes/zhudatuan-l0/targets/mall-provisioning-api/current
    /opt/zhudatuan/targets/support-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/purchase-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/web-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/catalog-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/catalog-jobs/current
    /opt/sfl/nodes/zhudatuan-l0/targets/payment-webhook-api/current
    /opt/sfl/nodes/zhudatuan-l0/targets/payment-jobs/current
  )
  units+=(
    sfl-identity-api@.service
    sfl-identity-notification-jobs@.service
    sfl-mall-provisioning-api@.service
    zhudatuan-console-support.service
    sfl-purchase-api@.service
    sfl-web-api@.service
    sfl-catalog-api@.service
    sfl-catalog-jobs@.service
    sfl-payment-webhook-api@.service
    sfl-payment-jobs@.service
  )
fi
if [[ "$node_scope" == all || "$node_scope" == hbbtzn-l1 ]]; then
  required_pointers+=(
    /opt/sfl/nodes/hbbtzn-l1/targets/storefront/current
    /opt/sfl/nodes/hbbtzn-l1/targets/storefront/runtime
    /opt/sfl/nodes/hbbtzn-l1/targets/auth-web/current
    /opt/sfl/nodes/hbbtzn-l1/targets/console/current
    /opt/sfl/nodes/hbbtzn-l1/targets/identity-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/identity-notification-jobs/current
    /opt/sfl/nodes/hbbtzn-l1/targets/purchase-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/web-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/catalog-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/catalog-jobs/current
    /opt/sfl/nodes/hbbtzn-l1/targets/payment-webhook-api/current
    /opt/sfl/nodes/hbbtzn-l1/targets/payment-jobs/current
  )
  units+=(
    sfl-api-gateway@.service
    sfl-storefront@.service
    sfl-identity-api@.service
    sfl-identity-notification-jobs@.service
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
if [[ "$node_scope" == hbbtzn-l1 ]]; then
  systemctl unmask sfl-identity-api@hbbtzn-l1.service
  gateway_candidate=/etc/ai-delivery/candidates/hbbtzn-l1.api-gateway.Caddyfile
  install -o root -g zhudatuan -m 0640 "$gateway_source" "$gateway_candidate"
  caddy validate --config "$gateway_candidate" --adapter caddyfile
  printf 'Gateway candidate validated for %s without installation, reload, or traffic changes.\n' "$node_scope"

  if [[ "$mode" == runtime ]]; then
    gateway_active=/opt/sfl/nodes/hbbtzn-l1/runtime/api-gateway.Caddyfile
    gateway_unit=sfl-api-gateway@hbbtzn-l1.service
    [[ -f "$gateway_active" ]] || { printf 'active gateway config missing: %s\n' "$gateway_active" >&2; exit 1; }

    gateway_work="$(mktemp -d)"
    trap 'rm -rf "$gateway_work"' EXIT
    sed 's/reverse_proxy 127\.0\.0\.1:4433/reverse_proxy 127.0.0.1:4321/' "$gateway_candidate" > "$gateway_work/expected-old.Caddyfile"
    [[ "$(grep -c 'reverse_proxy 127\.0\.0\.1:4433' "$gateway_candidate")" -eq 1 ]] || {
      printf 'gateway cutover refused: candidate must contain exactly one L1 Identity upstream\n' >&2
      exit 1
    }
    caddy adapt --config "$gateway_active" --adapter caddyfile --pretty > "$gateway_work/active-before.json"
    caddy adapt --config "$gateway_candidate" --adapter caddyfile --pretty > "$gateway_work/candidate.json"
    caddy adapt --config "$gateway_work/expected-old.Caddyfile" --adapter caddyfile --pretty > "$gateway_work/expected-old.json"
    before_digest="$(sha256sum "$gateway_work/active-before.json" | cut -d' ' -f1)"
    candidate_digest="$(sha256sum "$gateway_work/candidate.json" | cut -d' ' -f1)"

    if cmp -s "$gateway_work/active-before.json" "$gateway_work/candidate.json"; then
      printf 'Gateway runtime already current: status=noop semanticDigest=sha256:%s\n' "$candidate_digest"
    else
      cmp -s "$gateway_work/active-before.json" "$gateway_work/expected-old.json" || {
        printf 'gateway cutover refused: active semantic config differs from the single approved 4321-to-4433 transition\n' >&2
        exit 1
      }

      rollback_id="$(date -u +%Y%m%dT%H%M%SZ)-hbbtzn-l1-api-gateway"
      rollback_dir="/opt/ai-delivery/rollback/zdt-next/$rollback_id"
      install -d -m 0750 "$rollback_dir"
      cp -a "$gateway_active" "$rollback_dir/api-gateway.Caddyfile"
      backup_digest="$(sha256sum "$rollback_dir/api-gateway.Caddyfile" | cut -d' ' -f1)"
      old_gateway_pid="$(systemctl show --property MainPID --value "$gateway_unit")"
      [[ "$old_gateway_pid" =~ ^[1-9][0-9]*$ ]] || { printf 'gateway cutover refused: invalid current PID %s\n' "$old_gateway_pid" >&2; exit 1; }

      node -e 'const p=require(process.argv[1]); for(const x of p.protectedProcesses) if(x.kind==="systemd"&&x.name!=="sfl-api-gateway@hbbtzn-l1.service") console.log(x.name)' "$policy_source" \
        | while IFS= read -r unit; do printf '%s=%s\n' "$unit" "$(systemctl show --property MainPID --value "$unit")"; done \
        > "$gateway_work/processes-before"

      install -o root -g zhudatuan -m 0640 "$gateway_candidate" "$gateway_active"
      if ! systemctl restart "$gateway_unit"; then
        cp -a "$rollback_dir/api-gateway.Caddyfile" "$gateway_active"
        systemctl restart "$gateway_unit" || true
        printf 'gateway cutover failed and config rollback was attempted: %s\n' "$rollback_dir" >&2
        exit 1
      fi

      gateway_ready=false
      for _ in $(seq 1 30); do
        if systemctl is-active --quiet "$gateway_unit" \
          && curl --noproxy '*' -kfsS --max-time 2 --resolve api.hbbtzn.com:4430:127.0.0.1 https://api.hbbtzn.com:4430/health/gateway >/dev/null; then
          gateway_ready=true
          break
        fi
        sleep 1
      done
      if [[ "$gateway_ready" != true ]]; then
        cp -a "$rollback_dir/api-gateway.Caddyfile" "$gateway_active"
        systemctl restart "$gateway_unit" || true
        printf 'gateway readiness failed and config rollback was attempted: %s\n' "$rollback_dir" >&2
        exit 1
      fi

      new_gateway_pid="$(systemctl show --property MainPID --value "$gateway_unit")"
      [[ "$new_gateway_pid" =~ ^[1-9][0-9]*$ && "$new_gateway_pid" != "$old_gateway_pid" ]] || {
        printf 'gateway cutover refused: gateway PID did not change (%s -> %s)\n' "$old_gateway_pid" "$new_gateway_pid" >&2
        exit 1
      }
      node -e 'const p=require(process.argv[1]); for(const x of p.protectedProcesses) if(x.kind==="systemd"&&x.name!=="sfl-api-gateway@hbbtzn-l1.service") console.log(x.name)' "$policy_source" \
        | while IFS= read -r unit; do printf '%s=%s\n' "$unit" "$(systemctl show --property MainPID --value "$unit")"; done \
        > "$gateway_work/processes-after"
      cmp -s "$gateway_work/processes-before" "$gateway_work/processes-after" || {
        cp -a "$rollback_dir/api-gateway.Caddyfile" "$gateway_active"
        systemctl restart "$gateway_unit" || true
        printf 'gateway cutover refused: a protected non-gateway process changed; config rollback was attempted\n' >&2
        exit 1
      }

      caddy adapt --config "$gateway_active" --adapter caddyfile --pretty > "$gateway_work/active-after.json"
      cmp -s "$gateway_work/active-after.json" "$gateway_work/candidate.json" || {
        printf 'gateway cutover failed: active semantic config does not match candidate\n' >&2
        exit 1
      }
      identity_status="$(curl --noproxy '*' -ksS -o /dev/null -w '%{http_code}' --max-time 5 --resolve api.hbbtzn.com:4430:127.0.0.1 https://api.hbbtzn.com:4430/api/v1/identity/session)"
      [[ "$identity_status" == 401 ]] || { printf 'gateway Identity route returned %s instead of 401\n' "$identity_status" >&2; exit 1; }
      printf 'Gateway runtime activated: status=success beforeDigest=sha256:%s afterDigest=sha256:%s oldPID=%s newPID=%s rollback=%s backupSha256=sha256:%s identityStatus=%s nonTargetProcesses=unchanged\n' \
        "$before_digest" "$candidate_digest" "$old_gateway_pid" "$new_gateway_pid" "$rollback_dir" "$backup_digest" "$identity_status"
    fi
  fi
fi
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  install -m 0644 "$repo_root/02_platform_pingtai/infrastructure/zhudatuan/aliyun/ecosystem.config.cjs" /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs
fi
systemctl daemon-reload
if [[ "$mode" == runtime ]]; then
  printf 'Runtime definitions and approved gateway runtime installed for %s.\n' "$node_scope"
else
  printf 'Runtime definitions installed for %s only after seed verification; no service was restarted and no traffic was switched.\n' "$node_scope"
fi
if [[ "$node_scope" == all || "$node_scope" == zhudatuan-l0 ]]; then
  printf 'The PM2 storefront candidate remains inactive at /etc/ai-delivery/candidates/zdt-next.ecosystem.config.cjs.\n'
fi
