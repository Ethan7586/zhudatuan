#!/usr/bin/env bash
set -euo pipefail

: "${ARTIFACT_URL:?ARTIFACT_URL is required}"
: "${ARTIFACT_SHA:?ARTIFACT_SHA is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"
: "${RELEASE_TARGET:?RELEASE_TARGET is required}"

case "$ARTIFACT_SHA" in (*[!0-9a-f]*|'') echo "Invalid artifact SHA" >&2; exit 1 ;; esac
case "$SOURCE_SHA" in (*[!0-9a-f]*|'') echo "Invalid source SHA" >&2; exit 1 ;; esac
test "$RELEASE_TARGET" = node-operations

target_root=/opt/sfl/control/node-operations
release_id="${SOURCE_SHA:0:12}-${ARTIFACT_SHA:0:16}"
release_dir="$target_root/releases/$release_id"
archive_path="$target_root/.${release_id}.$$.tar.gz"
staging_dir="$target_root/.${release_id}.$$.staging"
current_link="$target_root/current"
next_link="$target_root/.current.$$.next"
mkdir -p "$target_root/releases"

cleanup() {
  unlink "$archive_path" 2>/dev/null || true
  unlink "$next_link" 2>/dev/null || true
  if [ -d "$staging_dir" ]; then rm -rf -- "$staging_dir"; fi
}
trap cleanup EXIT

curl -fsSL --connect-timeout 8 --max-time 120 "$ARTIFACT_URL" -o "$archive_path"
printf '%s  %s\n' "$ARTIFACT_SHA" "$archive_path" | sha256sum -c - >/dev/null
mkdir -p "$staging_dir"
tar -xzf "$archive_path" -C "$staging_dir"
test -s "$staging_dir/release-version.json"
for file in autonode-operate.mjs autonode-operations-engine.mjs autonode-operations-provider.mjs \
  autonode-control-main.mjs autonode-control-server.mjs l-arch-state-file.mjs \
  autonode-task-engine.mjs autonode-task-executor.mjs; do
  test -s "$staging_dir/runtime/$file"
  /usr/bin/node --check "$staging_dir/runtime/$file"
done
test -s "$staging_dir/runtime/autonode-activate-runtime.mjs"
/usr/bin/node --check "$staging_dir/runtime/autonode-activate-runtime.mjs"
test -s "$staging_dir/systemd/sfl-autonode-control.service"

if [ ! -d "$release_dir" ]; then mv "$staging_dir" "$release_dir"; fi
previous_target="$(readlink "$current_link" 2>/dev/null || true)"
if [ -n "$previous_target" ]; then
  previous_link="$target_root/.previous.$$.next"
  ln -s "$previous_target" "$previous_link"
  mv -Tf "$previous_link" "$target_root/previous"
fi
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

test "$(node -p "require('$current_link/release-version.json').sourceSha")" = "$SOURCE_SHA"
unit_file=/etc/systemd/system/sfl-autonode-control.service
install -m 0644 "$current_link/systemd/sfl-autonode-control.service" "$unit_file"
systemctl daemon-reload
systemctl enable sfl-autonode-control.service >/dev/null
systemctl restart sfl-autonode-control.service
control_ready=false
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 2 http://127.0.0.1:4370/health/ready >/dev/null; then
    control_ready=true
    break
  fi
  sleep 1
done
if [ "$control_ready" != true ]; then
  if [ -n "$previous_target" ] && [ -s "$previous_target/runtime/autonode-control-main.mjs" ]; then
    rollback_link="$target_root/.current.$$.rollback"
    ln -s "$previous_target" "$rollback_link"
    mv -Tf "$rollback_link" "$current_link"
    systemctl restart sfl-autonode-control.service || true
  else
    systemctl disable --now sfl-autonode-control.service >/dev/null 2>&1 || true
  fi
  echo "AutoNode control plane failed readiness" >&2
  exit 1
fi
printf 'DEPLOYED_TARGET=node-operations\n'
printf 'SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'CURRENT_NODE_OPERATIONS=%s\n' "$release_dir"
printf 'PREVIOUS_NODE_OPERATIONS=%s\n' "${previous_target:-none}"
printf 'AUTONODE_CONTROL_STATUS=READY\n'
