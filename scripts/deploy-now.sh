#!/usr/bin/env bash
# Internal compatibility wrapper for Delivery Control 1.5. User entry: zdt-delivery deploy.
# Usage:
#   scripts/deploy-now.sh <target> <full-commit-sha> <node>

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/deploy-prepared.sh" "$@"
