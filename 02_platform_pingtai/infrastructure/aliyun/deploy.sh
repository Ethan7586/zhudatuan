#!/usr/bin/env bash
set -euo pipefail

release_root="${1:-}"
namespace="${SHOP_NAMESPACE:-shop-production}"
identity="${SHOP_RELEASE_IDENTITY:-https://github.com/example/shop/.github/workflows/quality.yml@refs/heads/main}"
issuer="${SHOP_RELEASE_ISSUER:-https://token.actions.githubusercontent.com}"
cutover="${SHOP_CUTOVER_CONTROLLER:-}"
cutover_evidence="${SHOP_CUTOVER_EVIDENCE:-}"

fail() { printf 'release refused: %s\n' "$*" >&2; exit 1; }
command -v cosign >/dev/null || fail 'cosign is required'
command -v jq >/dev/null || fail 'jq is required'
command -v kubectl >/dev/null || fail 'kubectl is required'
command -v ossutil >/dev/null || fail 'ossutil is required'
[[ "$cutover" == /* && -x "$cutover" ]] || fail 'SHOP_CUTOVER_CONTROLLER must be an absolute audited executable'
[[ "$cutover_evidence" == /* && "$cutover_evidence" != / && ! -e "$cutover_evidence" ]] || fail 'SHOP_CUTOVER_EVIDENCE must be a new absolute non-root file'
[[ "$release_root" == /* && "$release_root" != / ]] || fail 'signed release directory must be an absolute non-root path'
[[ -d "$release_root" ]] || fail 'signed release directory does not exist'

manifest="$release_root/release.json"
bundle="$release_root/release.sigstore.json"
checksums="$release_root/checksums.sha256"
[[ -s "$manifest" && -s "$bundle" && -s "$checksums" ]] || fail 'release manifest, signature bundle, or checksum inventory is missing'

cosign verify-blob --bundle "$bundle" --certificate-identity "$identity" --certificate-oidc-issuer "$issuer" "$manifest" >/dev/null
(cd "$release_root" && sha256sum --check --strict checksums.sha256)
node --import tsx "$(dirname "$0")/../../04_tools/scripts/release/validate.mjs" "$manifest"
node --import tsx "$(dirname "$0")/../../04_tools/scripts/release/validatebundle.mjs" "$release_root"

release_id="$(jq -r '.releaseId' "$manifest")"
commerce_image="$(jq -r '.commerce.image' "$manifest")"
bucket="$(jq -r '.static.bucket' "$manifest")"
snapshot="$(jq -r '.evidence.databaseSnapshot' "$manifest")"
approval="$(jq -r '.evidence.releaseApproval' "$manifest")"
previous_release="$(jq -r '.rollback.releaseId' "$manifest")"
previous_snapshot="$(jq -r '.rollback.databaseSnapshot' "$manifest")"
[[ "$snapshot" != null && "$approval" != null ]] || fail 'database snapshot and release approval evidence are mandatory'

render() {
  sed -e "s#SHOP_NAMESPACE#$namespace#g" -e "s#SHOP_RELEASE_ID#$release_id#g" -e "s#SHOP_COMMERCE_IMAGE#$commerce_image#g" "$1"
}

"$cutover" maintenance on --release "$release_id"
"$cutover" drain --release "$release_id"
"$cutover" snapshot verify --reference "$snapshot"
kubectl -n "$namespace" scale deployment/shop-api deployment/shop-jobs --replicas=0
kubectl -n "$namespace" wait --for=delete pod -l 'app.kubernetes.io/name in (shop-api,shop-jobs)' --timeout=180s

rollback() {
  trap - ERR
  "$cutover" maintenance on --release "$release_id" || true
  kubectl -n "$namespace" scale deployment/shop-api deployment/shop-jobs --replicas=0 || true
  "$cutover" rollback --release "$previous_release" --snapshot "$previous_snapshot" || true
  fail "automatic rollback invoked for $release_id"
}
trap rollback ERR

render "$(dirname "$0")/migration.template.yml" | kubectl apply --server-side --field-manager=shop-release -f -
kubectl -n "$namespace" wait --for=condition=complete "job/shop-migration-$release_id" --timeout=1800s

for client in console store supplier storefront auth miniapp; do
  client_path="$(jq -r --arg client "$client" '.clients[$client].path' "$manifest")"
  [[ "$client_path" == "clients/$client" && -d "$release_root/$client_path" ]] || fail "invalid client artifact: $client"
  source_path="$release_root/$client_path"
  ossutil cp -r -f "$source_path/" "oss://$bucket/releases/$release_id/$client/"
done
"$cutover" edge stage --release "$release_id" --artifact "$release_root/clients/storefront" --sha256 "$(jq -r '.clients.storefront.sha256' "$manifest")"

render "$(dirname "$0")/runtime.template.yml" | kubectl apply --server-side --field-manager=shop-release -f -
kubectl -n "$namespace" rollout status deployment/shop-api --timeout=300s
kubectl -n "$namespace" rollout status deployment/shop-jobs --timeout=300s
kubectl -n "$namespace" run "shop-smoke-$release_id" --restart=Never --image="$commerce_image" --env="SHOP_SMOKE_RELEASE=$release_id" --env="SHOP_SMOKE_BASE_URL=http://shop-api.$namespace.svc.cluster.local" -- 01_core_hexin/services/commerce/dist/SmokeMain.js
kubectl -n "$namespace" wait --for=jsonpath='{.status.phase}'=Succeeded "pod/shop-smoke-$release_id" --timeout=900s

ossutil cp -f "$release_root/current.json" "oss://$bucket/releases/current.json" --meta "Cache-Control:no-store"
for percentage in 5 25 50 100; do
  "$cutover" traffic set --release "$release_id" --percent "$percentage"
  "$cutover" verify --manifest "$manifest" --percent "$percentage"
done
"$cutover" maintenance off --release "$release_id"
"$cutover" evidence export --release "$release_id" --manifest "$manifest" --output "$cutover_evidence"
node --import tsx "$(dirname "$0")/../../04_tools/scripts/release/cutover.mjs" "$cutover_evidence" "$manifest"
trap - ERR
printf 'verified release %s reached 100%% traffic\n' "$release_id"
