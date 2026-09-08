#!/usr/bin/env bash
set -euo pipefail

release_root="${1:-}"
namespace="${SHOP_NAMESPACE:-}"
identity="${SHOP_RELEASE_IDENTITY:-}"
issuer="${SHOP_RELEASE_ISSUER:-}"
controller="${SHOP_CUTOVER_CONTROLLER:-}"
cutover_evidence="${SHOP_CUTOVER_EVIDENCE:-}"
delivery="$(cd "$(dirname "$0")" && pwd)/Delivery.yml"

fail() { printf 'release refused: %s\n' "$*" >&2; exit 1; }
for command in cosign node; do command -v "$command" >/dev/null || fail "$command is required"; done
[[ "$release_root" == /* && "$release_root" != / && -d "$release_root" ]] || fail 'signed release directory must be an existing absolute non-root path'
[[ "$namespace" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'SHOP_NAMESPACE must be explicit and valid'
[[ "$identity" == https://* && "$issuer" == https://* ]] || fail 'release identity and issuer must be explicit HTTPS values'
[[ "$controller" == /* && "$controller" != / && -x "$controller" ]] || fail 'SHOP_CUTOVER_CONTROLLER must be an absolute audited executable'
[[ "$cutover_evidence" == /* && "$cutover_evidence" != / && ! -e "$cutover_evidence" ]] || fail 'SHOP_CUTOVER_EVIDENCE must be a new absolute non-root file'

manifest="$release_root/release.json"
bundle="$release_root/release.sigstore.json"
checksums="$release_root/checksums.sha256"
[[ -s "$manifest" && -s "$bundle" && -s "$checksums" ]] || fail 'release manifest, signature bundle, or checksum inventory is missing'

cosign verify-blob --bundle "$bundle" --certificate-identity "$identity" --certificate-oidc-issuer "$issuer" "$manifest" >/dev/null
(cd "$release_root" && sha256sum --check --strict checksums.sha256)
node --import tsx "$(dirname "$0")/../../scripts/release/validate.mjs" "$manifest"
node --import tsx "$(dirname "$0")/../../scripts/release/validatebundle.mjs" "$release_root"

"$controller" apply --delivery "$delivery" --release "$release_root" --namespace "$namespace" --evidence "$cutover_evidence"
node --import tsx "$(dirname "$0")/../../scripts/release/cutover.mjs" "$cutover_evidence" "$manifest"
printf 'verified release completed with immutable evidence: %s\n' "$cutover_evidence"
