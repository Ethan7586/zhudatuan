#!/usr/bin/env bash
# Compatibility entry for the second Aliyun build slot.
set -euo pipefail

readonly SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZDT_BUILD_SLOT=2 exec "$SCRIPT_ROOT/install-build-runner.sh"
