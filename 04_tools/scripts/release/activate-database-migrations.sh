#!/usr/bin/env bash
set -euo pipefail

: "${ARTIFACT_URL:?ARTIFACT_URL is required}"
: "${ARTIFACT_SHA:?ARTIFACT_SHA is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"

case "$ARTIFACT_SHA" in (*[!0-9a-f]*|'') echo "Invalid artifact SHA" >&2; exit 1 ;; esac
case "$SOURCE_SHA" in (*[!0-9a-f]*|'') echo "Invalid source SHA" >&2; exit 1 ;; esac

target_root=/opt/ai-delivery/database-migrations/zdt-next
release_id="${SOURCE_SHA:0:12}-${ARTIFACT_SHA:0:16}"
release_dir="$target_root/releases/$release_id"
archive_path="$target_root/.${release_id}.$$.tar.gz"
staging_dir="$target_root/.${release_id}.$$.staging"
mkdir -p "$target_root/releases"

cleanup() {
  unlink "$archive_path" 2>/dev/null || true
  if [ -d "$staging_dir" ]; then rm -rf -- "$staging_dir"; fi
}
trap cleanup EXIT

curl -fsSL --connect-timeout 8 --max-time 120 "$ARTIFACT_URL" -o "$archive_path"
printf '%s  %s\n' "$ARTIFACT_SHA" "$archive_path" | sha256sum -c - >/dev/null
mkdir -p "$staging_dir"
tar -xzf "$archive_path" -C "$staging_dir"
test -s "$staging_dir/executor/DatabaseMigrationExecutor.js"
test -s "$staging_dir/executor/RunDatabaseMigrations.mjs"
test -d "$staging_dir/database/supabase/migrations"
test -s "$staging_dir/database/contracts/history.json"

if [ ! -d "$release_dir" ]; then mv "$staging_dir" "$release_dir"; fi
previous_target="$(readlink "$target_root/current" 2>/dev/null || true)"
/usr/bin/node "$release_dir/executor/RunDatabaseMigrations.mjs" "$release_dir" "$SOURCE_SHA"

if [ -n "$previous_target" ]; then
  previous_link="$target_root/.previous.$$.next"
  ln -s "$previous_target" "$previous_link"
  mv -Tf "$previous_link" "$target_root/previous"
fi
next_link="$target_root/.current.$$.next"
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$target_root/current"

printf 'DEPLOYED_TARGET=database-migrations\n'
printf 'SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'CURRENT_DATABASE_MIGRATIONS=%s\n' "$release_dir"
printf 'PREVIOUS_DATABASE_MIGRATIONS=%s\n' "${previous_target:-none}"
