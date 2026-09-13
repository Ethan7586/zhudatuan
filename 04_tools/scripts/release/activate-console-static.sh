#!/usr/bin/env bash
set -euo pipefail

: "${ARTIFACT_URL:?ARTIFACT_URL is required}"
: "${ARTIFACT_SHA:?ARTIFACT_SHA is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"

case "$ARTIFACT_SHA" in
  (*[!0-9a-f]*|'') echo "Invalid artifact SHA" >&2; exit 1 ;;
esac
case "$SOURCE_SHA" in
  (*[!0-9a-f]*|'') echo "Invalid source SHA" >&2; exit 1 ;;
esac

target_root=/opt/sfl/nodes/hbbtzn-l1/targets/console
releases_root="$target_root/releases"
release_id="${SOURCE_SHA:0:12}-${ARTIFACT_SHA:0:16}"
release_dir="$releases_root/$release_id"
archive_path="$releases_root/.${release_id}.$$.tar.gz"
staging_dir="$releases_root/.${release_id}.$$.staging"
next_link="$target_root/.current.$$.next"
current_link="$target_root/current"

mkdir -p "$releases_root"
previous_target="$(readlink "$current_link")"

cleanup() {
  unlink "$archive_path" 2>/dev/null || true
  unlink "$next_link" 2>/dev/null || true
  if [ -d "$staging_dir" ]; then
    rm -rf -- "$staging_dir"
  fi
}
trap cleanup EXIT

curl -fsSL --connect-timeout 8 --max-time 120 "$ARTIFACT_URL" -o "$archive_path"
printf '%s  %s\n' "$ARTIFACT_SHA" "$archive_path" | sha256sum -c - >/dev/null

mkdir -p "$staging_dir"
tar -xzf "$archive_path" -C "$staging_dir"
test -s "$staging_dir/static/index.html"
test -s "$staging_dir/static/release-version.json"

if [ ! -d "$release_dir" ]; then
  mv "$staging_dir" "$release_dir"
fi

ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

health_url="https://console.hbbtzn.com/release-version.json?source=${SOURCE_SHA}&nonce=$(date +%s)"
if ! health_body="$(curl -fsSL --connect-timeout 8 --max-time 20 "$health_url")" ||
   ! grep -Fq "\"sourceSha\":\"$SOURCE_SHA\"" <<<"$health_body"; then
  rollback_link="$target_root/.current.$$.rollback"
  ln -s "$previous_target" "$rollback_link"
  mv -Tf "$rollback_link" "$current_link"
  echo "Console health check failed; restored $previous_target" >&2
  exit 1
fi

printf 'DEPLOYED_RELEASE=%s\n' "$release_dir"
printf 'ROLLBACK_TARGET=%s\n' "$previous_target"
printf 'SOURCE_SHA=%s\n' "$SOURCE_SHA"
