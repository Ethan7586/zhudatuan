#!/usr/bin/env bash
set -Eeuo pipefail

: "${ARTIFACT_URL:?ARTIFACT_URL is required}"
: "${ARTIFACT_SHA:?ARTIFACT_SHA is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"
: "${RELEASE_TARGET:?RELEASE_TARGET is required}"

case "$ARTIFACT_SHA" in (*[!0-9a-f]*|'') echo "Invalid artifact SHA" >&2; exit 1 ;; esac
case "$SOURCE_SHA" in (*[!0-9a-f]*|'') echo "Invalid source SHA" >&2; exit 1 ;; esac

case "$RELEASE_TARGET" in
  identity-api)
    target_specs=(
      'identity-api|/opt/sfl/nodes/hbbtzn-l1/targets/identity-api|sfl-identity-api@hbbtzn-l1.service'
    )
    ;;
  commerce-api)
    target_specs=(
      'mall-provisioning-api|/opt/sfl/nodes/zhudatuan-l0/targets/mall-provisioning-api|sfl-mall-provisioning-api@zhudatuan-l0.service'
      'support-api|/opt/zhudatuan/targets/support-api|zhudatuan-console-support.service'
      'purchase-api|/opt/sfl/nodes/zhudatuan-l0/targets/purchase-api|sfl-purchase-api@zhudatuan-l0.service'
      'web-api|/opt/sfl/nodes/zhudatuan-l0/targets/web-api|sfl-web-api@zhudatuan-l0.service'
      'catalog-api|/opt/sfl/nodes/zhudatuan-l0/targets/catalog-api|sfl-catalog-api@zhudatuan-l0.service'
      'payment-webhook-api|/opt/sfl/nodes/zhudatuan-l0/targets/payment-webhook-api|sfl-payment-webhook-api@zhudatuan-l0.service'
    )
    ;;
  workers)
    target_specs=(
      'identity-notification-jobs|/opt/sfl/nodes/hbbtzn-l1/targets/identity-notification-jobs|sfl-identity-notification-jobs@hbbtzn-l1.service'
      'catalog-jobs|/opt/sfl/nodes/zhudatuan-l0/targets/catalog-jobs|sfl-catalog-jobs@zhudatuan-l0.service'
      'payment-jobs|/opt/sfl/nodes/zhudatuan-l0/targets/payment-jobs|sfl-payment-jobs@zhudatuan-l0.service'
    )
    ;;
  *) echo "Unsupported runtime target: $RELEASE_TARGET" >&2; exit 1 ;;
esac

bundle_root="/opt/sfl/oss-runtime/$RELEASE_TARGET"
release_id="${SOURCE_SHA:0:12}-${ARTIFACT_SHA:0:16}"
archive_path="$bundle_root/.${release_id}.$$.tar.gz"
staging_dir="$bundle_root/.${release_id}.$$.staging"
mkdir -p "$bundle_root"

declare -A previous_targets=()
declare -A release_targets=()
declare -A was_active=()
switched_targets=()
rollback_required=0
manifest_changed=0
manifest_path=''
manifest_backup_path=''
manifest_env_backup_dir=''
manifest_env_paths=()

cleanup() {
  unlink "$archive_path" 2>/dev/null || true
  if [ -d "$staging_dir" ]; then rm -rf -- "$staging_dir"; fi
}

rollback() {
  local status=$?
  trap - ERR
  set +e
  if [ "$rollback_required" = 1 ]; then
    for spec in "${target_specs[@]}"; do
      IFS='|' read -r name root unit <<<"$spec"
      previous="${previous_targets[$name]:-}"
      rollback_link="$root/.current.$$.rollback"
      if [ -n "$previous" ]; then
        ln -s "$previous" "$rollback_link" && mv -Tf "$rollback_link" "$root/current"
      else
        unlink "$root/current" 2>/dev/null || true
      fi
    done
    if [ "$manifest_changed" = 1 ]; then
      manifest_rollback_tmp="${manifest_path}.$$.rollback"
      install -o root -g root -m 0644 "$manifest_backup_path" "$manifest_rollback_tmp"
      mv -Tf "$manifest_rollback_tmp" "$manifest_path"
      for env_path in "${manifest_env_paths[@]}"; do
        env_rollback_tmp="${env_path}.$$.rollback"
        cp -a "$manifest_env_backup_dir/$(basename "$env_path")" "$env_rollback_tmp"
        mv -Tf "$env_rollback_tmp" "$env_path"
      done
    fi
    for spec in "${target_specs[@]}"; do
      IFS='|' read -r name root unit <<<"$spec"
      if [ "${was_active[$name]:-0}" = 1 ]; then systemctl restart "$unit" || true; fi
    done
  fi
  cleanup
  exit "$status"
}
trap cleanup EXIT
trap rollback ERR

curl -fsSL --connect-timeout 8 --max-time 120 "$ARTIFACT_URL" -o "$archive_path"
printf '%s  %s\n' "$ARTIFACT_SHA" "$archive_path" | sha256sum -c - >/dev/null
mkdir -p "$staging_dir"
tar -xzf "$archive_path" -C "$staging_dir"
test -s "$staging_dir/release-version.json"

for spec in "${target_specs[@]}"; do
  IFS='|' read -r name root unit <<<"$spec"
  source_dir="$staging_dir/targets/$name"
  test -d "$source_dir/service"
  find "$source_dir/service" -maxdepth 1 -type f -name '*.js' -print -quit | grep -q .
  mkdir -p "$root/releases"
  release_dir="$root/releases/$release_id"
  if [ ! -d "$release_dir" ]; then
    mv "$source_dir" "$release_dir"
    cp "$staging_dir/release-version.json" "$release_dir/release-version.json"
  fi
  previous_targets[$name]="$(readlink "$root/current" 2>/dev/null || true)"
  release_targets[$name]="$release_dir"
  if systemctl is-active --quiet "$unit"; then was_active[$name]=1; else was_active[$name]=0; fi
done

rollback_required=1
if [ "$RELEASE_TARGET" = 'identity-api' ]; then
  manifest_path='/opt/sfl/nodes/hbbtzn-l1/manifest.json'
  next_manifest="${release_targets[identity-api]}/node-manifest.json"
  test -s "$next_manifest"
  jq -e '.node_id == "node:hbbtzn:l1" and .node_profile == "operating_mall"' "$next_manifest" >/dev/null
  manifest_backup_dir="$bundle_root/manifest-rollbacks"
  mkdir -p "$manifest_backup_dir"
  manifest_backup_path="$manifest_backup_dir/${release_id}-$(date -u +%Y%m%dT%H%M%SZ)-$$.json"
  cp -a "$manifest_path" "$manifest_backup_path"
  new_manifest_digest="$(jq -r '.manifest_digest' "$next_manifest")"
  case "$new_manifest_digest" in (sha256:[0-9a-f][0-9a-f]*) ;; (*) echo 'Invalid node manifest digest' >&2; false ;; esac
  for env_path in /opt/sfl/nodes/hbbtzn-l1/runtime/*.env; do
    if grep -qx 'NODE_MANIFEST_PATH=/opt/sfl/nodes/hbbtzn-l1/manifest.json' "$env_path"; then
      grep -q '^NODE_MANIFEST_DIGEST=' "$env_path"
      manifest_env_paths+=("$env_path")
    fi
  done
  test "${#manifest_env_paths[@]}" -gt 0
  manifest_env_backup_dir="$manifest_backup_dir/${release_id}-$(date -u +%Y%m%dT%H%M%SZ)-$$.env"
  mkdir -p "$manifest_env_backup_dir"
  for env_path in "${manifest_env_paths[@]}"; do
    cp -a "$env_path" "$manifest_env_backup_dir/$(basename "$env_path")"
  done
  manifest_changed=1
  manifest_next_tmp="${manifest_path}.$$.next"
  install -o root -g root -m 0644 "$next_manifest" "$manifest_next_tmp"
  mv -Tf "$manifest_next_tmp" "$manifest_path"
  for env_path in "${manifest_env_paths[@]}"; do
    env_next_tmp="${env_path}.$$.next"
    cp -a "$env_path" "$env_next_tmp"
    sed -i "s|^NODE_MANIFEST_DIGEST=.*$|NODE_MANIFEST_DIGEST=$new_manifest_digest|" "$env_next_tmp"
    mv -Tf "$env_next_tmp" "$env_path"
  done
fi
for spec in "${target_specs[@]}"; do
  IFS='|' read -r name root unit <<<"$spec"
  next_link="$root/.current.$$.next"
  ln -s "${release_targets[$name]}" "$next_link"
  mv -Tf "$next_link" "$root/current"
  switched_targets+=("$name")
done

for spec in "${target_specs[@]}"; do
  IFS='|' read -r name root unit <<<"$spec"
  if [ "${was_active[$name]}" = 1 ]; then
    systemctl restart "$unit"
    ready=0
    for _attempt in $(seq 1 30); do
      if systemctl is-active --quiet "$unit"; then ready=1; break; fi
      sleep 1
    done
    if [ "$ready" != 1 ]; then
      systemctl status "$unit" --no-pager -n 20 >&2 || true
      false
    fi
  fi
done

rollback_required=0
trap - ERR
printf 'DEPLOYED_TARGET=%s\n' "$RELEASE_TARGET"
printf 'SOURCE_SHA=%s\n' "$SOURCE_SHA"
if [ "$manifest_changed" = 1 ]; then
  printf 'CURRENT_MANIFEST=%s\n' "$manifest_path"
  printf 'ROLLBACK_MANIFEST=%s\n' "$manifest_backup_path"
  printf 'ROLLBACK_MANIFEST_ENVS=%s\n' "$manifest_env_backup_dir"
fi
for spec in "${target_specs[@]}"; do
  IFS='|' read -r name root unit <<<"$spec"
  printf 'CURRENT_%s=%s\n' "$name" "${release_targets[$name]}"
  printf 'ROLLBACK_%s=%s\n' "$name" "${previous_targets[$name]:-none}"
  printf 'RESTARTED_%s=%s\n' "$name" "${was_active[$name]}"
done
