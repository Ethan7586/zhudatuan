#!/usr/bin/env bash
# Rebuild the versioned Aliyun Runner environment on a Linux x64 host.
set -euo pipefail

readonly SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROXY_PORT="${ZDT_GITHUB_LINE_LISTEN_PORT:-7890}"

[ "$(id -u)" -eq 0 ] || { echo 'Run as root on the Aliyun Runner host.' >&2; exit 64; }
[ -n "${RUNNER_REGISTRATION_TOKEN:-}" ] || { echo 'RUNNER_REGISTRATION_TOKEN is required.' >&2; exit 64; }
for command in curl find grep install node runuser sha256sum sing-box systemctl tar xz; do
  command -v "$command" >/dev/null || { echo "Required command is missing: ${command}" >&2; exit 69; }
done

"$SCRIPT_ROOT/install-github-transport.sh"
export ZDT_GITHUB_PROXY_URL="http://127.0.0.1:${PROXY_PORT}"
for slot in 1 2; do
  ZDT_BUILD_SLOT="$slot" "$SCRIPT_ROOT/install-build-runner.sh"
done

# The first pass creates the shared network file; this pass attaches it to both new services.
"$SCRIPT_ROOT/install-github-transport.sh"
"$SCRIPT_ROOT/install-build-capacity-policy.sh"

printf '%s\n' \
  'Aliyun Runner environment restored.' \
  'GitHub route label: zdt-aliyun-build' \
  'Slots: aliyun-staging-zdt-build, aliyun-staging-zdt-build-2' \
  "Environment manifest: ${SCRIPT_ROOT}/aliyun-runner-environment.json"
