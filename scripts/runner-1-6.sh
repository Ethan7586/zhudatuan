#!/usr/bin/env bash
# Shared Runner 1.6 execution core. Both Aliyun and GitHub Hosted runners invoke this file.
set -euo pipefail

operation="${1:?operation required}"
control_root="${CONTROL_ROOT:?CONTROL_ROOT required}"
source_root="${SOURCE_ROOT:-}"
identifier="${RELEASE_IDENTIFIER:-}"
target="${RELEASE_TARGET:-}"
node="${PHYSICAL_NODE:-}"

install -d -m 700 "$HOME/.ssh"
install -m 600 "$control_root/02_platform_pingtai/infrastructure/release/zdt-next.ssh-known-hosts" "$HOME/.ssh/known_hosts"
if [ -n "${ZDT_RELEASE_SSH_KEY:-}" ]; then
  printf '%s\n' "$ZDT_RELEASE_SSH_KEY" > "$HOME/.ssh/zdt_release"
  chmod 600 "$HOME/.ssh/zdt_release"
  printf 'Host *\n  IdentityFile %s\n  IdentitiesOnly yes\n' "$HOME/.ssh/zdt_release" > "$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
fi

args=("$operation" --control-root "$control_root")
if [ -n "$source_root" ]; then args+=(--source-root "$source_root"); fi
if [ -n "$identifier" ]; then args+=(--identifier "$identifier"); fi
if [ -n "$target" ]; then args+=(--target "$target"); fi
if [ -n "$node" ]; then args+=(--node "$node"); fi
exec node "$control_root/04_tools/release-engine/runner-1-6.mjs" "${args[@]}"
