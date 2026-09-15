#!/usr/bin/env bash
# Internal 1.4.3 compatibility wrapper. User entry: zdt-delivery deploy.
# Usage:
#   scripts/deploy-now.sh <target> <full-commit-sha> <node>

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/deploy-prepared.sh" "$@"
