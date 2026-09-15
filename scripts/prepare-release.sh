#!/usr/bin/env bash
# Internal compatibility wrapper. User entry: zdt-delivery prepare.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$script_dir/delivery-dispatch.sh" prepare "$@"
