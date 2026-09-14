#!/usr/bin/env bash
# Canonical 1.4 Aliyun deployment entrypoint.
# Usage:
#   scripts/deploy-now.sh <target> <full-commit-sha> <node>

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/deploy-prepared.sh" "$@"
