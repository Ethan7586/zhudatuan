#!/usr/bin/env bash
set -euo pipefail

manifest_source="${1:-}"
[ "$(id -u)" -eq 0 ] || { echo 'GCP_L0_BOOTSTRAP_ROOT_REQUIRED' >&2; exit 1; }
[ -s "$manifest_source" ] || { echo 'GCP_L0_MANIFEST_REQUIRED' >&2; exit 1; }
command -v node >/dev/null || { echo 'GCP_L0_NODE_REQUIRED' >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openssl postgresql postgresql-contrib >/dev/null

if ! id zhudatuan >/dev/null 2>&1; then
  useradd --system --home-dir /opt/zhudatuan --shell /usr/sbin/nologin zhudatuan
fi
install -d -o root -g zhudatuan -m 0750 /opt/zhudatuan/shared /opt/zhudatuan/shared/tls
install -d -o zhudatuan -g zhudatuan -m 0750 /opt/zhudatuan/releases
install -d -o root -g zhudatuan -m 0750 /opt/sfl/nodes/zhudatuan-l0
install -o root -g zhudatuan -m 0640 "$manifest_source" /opt/sfl/nodes/zhudatuan-l0/manifest.json

read -r postgres_version postgres_cluster < <(pg_lsclusters --no-header | awk 'NR == 1 { print $1, $2 }')
[ -n "${postgres_version:-}" ] && [ -n "${postgres_cluster:-}" ] || { echo 'GCP_L0_POSTGRES_CLUSTER_MISSING' >&2; exit 1; }
pg_conftool "$postgres_version" "$postgres_cluster" set port 55432
postgres_configuration="/etc/postgresql/${postgres_version}/${postgres_cluster}/postgresql.conf"
sed -ri "s/^[#[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '127.0.0.1'/" "$postgres_configuration"
systemctl restart "postgresql@${postgres_version}-${postgres_cluster}.service"

random_hex() { openssl rand -hex 32; }
postgres_environment=/opt/zhudatuan/shared/postgres.env
if [ ! -s "$postgres_environment" ]; then
  temporary="$(mktemp /opt/zhudatuan/shared/.postgres.env.XXXXXX)"
  chmod 0600 "$temporary"
  {
    printf 'POSTGRES_DB=zhudatuan_registration\n'
    printf 'POSTGRES_USER=zhudatuanroot\n'
    printf 'POSTGRES_PASSWORD=%s\n' "$(random_hex)"
    printf 'SHOPAPP_PASSWORD=%s\n' "$(random_hex)"
    printf 'SHOPJOB_PASSWORD=%s\n' "$(random_hex)"
    printf 'SHOPMIGRATION_PASSWORD=%s\n' "$(random_hex)"
    printf 'SHOPREAD_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_IDENTITY_API_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_IDENTITY_JOB_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_BOOTSTRAP_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_WEB_API_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_PURCHASE_API_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_PROVISIONING_API_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD=%s\n' "$(random_hex)"
    printf 'ZHUDATUAN_DATABASE_SENTINEL=%s\n' "$(random_hex)"
  } > "$temporary"
  install -o root -g root -m 0600 "$temporary" "$postgres_environment"
  unlink "$temporary"
fi

set -a
# The file is generated above from fixed names and hexadecimal values only.
. "$postgres_environment"
set +a
runuser -u postgres -- psql --set ON_ERROR_STOP=1 --set owner_password="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE zhudatuanroot LOGIN PASSWORD %L', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zhudatuanroot')\gexec
ALTER ROLE zhudatuanroot WITH LOGIN PASSWORD :'owner_password';
SELECT 'CREATE DATABASE zhudatuan_registration OWNER zhudatuanroot'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'zhudatuan_registration')\gexec
SQL

tls_root=/opt/zhudatuan/shared/tls
if [ ! -s "$tls_root/internal-ca.crt" ] || [ ! -s "$tls_root/internal.key" ] || [ ! -s "$tls_root/internal.crt" ]; then
  temporary="$(mktemp -d /opt/zhudatuan/shared/.tls.XXXXXX)"
  openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj '/CN=zdt-internal-ca' \
    -keyout "$temporary/ca.key" -out "$temporary/ca.crt" >/dev/null 2>&1
  openssl req -newkey rsa:3072 -nodes -subj '/CN=localhost' \
    -keyout "$temporary/internal.key" -out "$temporary/internal.csr" >/dev/null 2>&1
  printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > "$temporary/extensions"
  openssl x509 -req -days 825 -in "$temporary/internal.csr" -CA "$temporary/ca.crt" -CAkey "$temporary/ca.key" \
    -CAcreateserial -extfile "$temporary/extensions" -out "$temporary/internal.crt" >/dev/null 2>&1
  install -o root -g zhudatuan -m 0640 "$temporary/ca.crt" "$tls_root/internal-ca.crt"
  install -o root -g zhudatuan -m 0640 "$temporary/internal.crt" "$tls_root/internal.crt"
  install -o root -g zhudatuan -m 0640 "$temporary/internal.key" "$tls_root/internal.key"
  find "$temporary" -type f -delete
  rmdir "$temporary"
fi

runtime_environment=/opt/zhudatuan/shared/runtime.env
if [ ! -s "$runtime_environment" ]; then
  temporary="$(mktemp /opt/zhudatuan/shared/.runtime.env.XXXXXX)"
  chmod 0640 "$temporary"
  {
    printf 'APP_ENV=production\n'
    printf 'LOCAL_TLS_KEY_FILE=/opt/zhudatuan/shared/tls/internal.key\n'
    printf 'LOCAL_TLS_CERT_FILE=/opt/zhudatuan/shared/tls/internal.crt\n'
    printf 'LOCAL_SECRETS_FILE=/opt/zhudatuan/shared/secrets.json\n'
    printf 'LOCAL_SECRETS_PORT=8543\n'
    printf 'LOCAL_KMS_PORT=8544\n'
    printf 'LOCAL_KMS_MASTER_KEY=%s\n' "$(random_hex)"
    printf 'LOCAL_KMS_BEARER_TOKEN=%s\n' "$(random_hex)"
    printf 'LOCAL_SECRET_STORE_BEARER_TOKEN=%s\n' "$(random_hex)"
    printf 'LOCAL_OBJECTS_PORT=8555\n'
    printf 'LOCAL_OBJECTS_DIRECTORY=/var/lib/sfl-zhudatuan-l0-objects\n'
    printf 'LOCAL_OBJECTS_TOKEN=%s\n' "$(random_hex)"
    printf 'NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt\n'
  } > "$temporary"
  install -o root -g zhudatuan -m 0640 "$temporary" "$runtime_environment"
  unlink "$temporary"
fi

set -a
. "$runtime_environment"
set +a
secrets_file=/opt/zhudatuan/shared/secrets.json
if [ ! -s "$secrets_file" ]; then
  temporary="$(mktemp /opt/zhudatuan/shared/.secrets.json.XXXXXX)"
  /usr/bin/node > "$temporary" <<'NODE'
import { randomBytes } from 'node:crypto';
const encode = (value) => encodeURIComponent(value);
const dsn = (role, password) => `postgresql://${role}:${encode(password)}@127.0.0.1:55432/zhudatuan_registration?sslmode=disable`;
const secret = () => randomBytes(32).toString('base64url');
const values = {
  'zhudatuan/registration/database/migration': dsn('shopmigration', process.env.SHOPMIGRATION_PASSWORD),
  'zhudatuan/nodes/l0/database/catalog-api': dsn('zhudatuanidentityapi', process.env.ZHUDATUAN_IDENTITY_API_PASSWORD),
  'zhudatuan/nodes/l0/database/catalog-jobs': dsn('shopjob', process.env.SHOPJOB_PASSWORD),
  'zhudatuan/nodes/l0/database/identity-api': dsn('zhudatuanidentityapi', process.env.ZHUDATUAN_IDENTITY_API_PASSWORD),
  'zhudatuan/nodes/l0/database/identity-notification-jobs': dsn('zhudatuanidentityjob', process.env.ZHUDATUAN_IDENTITY_JOB_PASSWORD),
  'zhudatuan/nodes/l0/database/mall-provisioning-api': dsn('zhudatuanprovisioningapi', process.env.ZHUDATUAN_PROVISIONING_API_PASSWORD),
  'zhudatuan/nodes/l0/database/payment-jobs': dsn('shopjob', process.env.SHOPJOB_PASSWORD),
  'zhudatuan/nodes/l0/database/payment-webhook-api': dsn('shopapp', process.env.SHOPAPP_PASSWORD),
  'zhudatuan/nodes/l0/database/purchase-api': dsn('zhudatuanpurchaseapi', process.env.ZHUDATUAN_PURCHASE_API_PASSWORD),
  'zhudatuan/nodes/l0/database/web-api': dsn('zhudatuanwebapi', process.env.ZHUDATUAN_WEB_API_PASSWORD),
  'zhudatuan/nodes/l0/checkout/quote': secret(),
  'zhudatuan/nodes/l0/extensions/manifest': secret(),
  'zhudatuan/nodes/l0/identity/index': secret(),
  'zhudatuan/nodes/l0/identity/session': secret(),
  'zhudatuan/nodes/l0/objects/api': process.env.LOCAL_OBJECTS_TOKEN,
  'zhudatuan/nodes/l0/objects/jobs': process.env.LOCAL_OBJECTS_TOKEN,
  'zhudatuan/nodes/l0/pii': secret(),
};
process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
NODE
  install -o root -g zhudatuan -m 0640 "$temporary" "$secrets_file"
  unlink "$temporary"
fi

migration_environment=/opt/zhudatuan/shared/migration.env
if [ ! -s "$migration_environment" ]; then
  temporary="$(mktemp /opt/zhudatuan/shared/.migration.env.XXXXXX)"
  chmod 0640 "$temporary"
  {
    printf 'APP_ENV=production\n'
    printf 'REGISTRATION_MIGRATION_PROFILE=registration-only\n'
    printf 'MIGRATION_APPROVAL=hard-cut-20260821054000\n'
    printf 'MIGRATION_DATABASE_CONNECTION_REF=zhudatuan/registration/database/migration\n'
    printf 'MIGRATION_DISTRIBUTOR_KEY_REF=zhudatuan/migration/distributor\n'
    printf 'MIGRATION_IDENTITY_KEY_REF=zhudatuan/migration/identity\n'
    printf 'MIGRATION_PARTNER_KEY_REF=zhudatuan/migration/partner\n'
    printf 'MIGRATION_VOUCHER_KEY_REF=zhudatuan/migration/voucher\n'
    printf 'MIGRATION_SOURCE_SNAPSHOT_REF=zhudatuan/registration/empty-database-v1\n'
    printf 'KMS_ENDPOINT=https://127.0.0.1:8544\n'
    printf 'KMS_BEARER_TOKEN=%s\n' "$LOCAL_KMS_BEARER_TOKEN"
    printf 'SECRET_STORE_ENDPOINT=https://127.0.0.1:8543\n'
    printf 'SECRET_STORE_BEARER_TOKEN=%s\n' "$LOCAL_SECRET_STORE_BEARER_TOKEN"
    printf 'NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt\n'
  } > "$temporary"
  install -o root -g zhudatuan -m 0640 "$temporary" "$migration_environment"
  unlink "$temporary"
fi

install -d -o zhudatuan -g zhudatuan -m 0750 /var/lib/sfl-zhudatuan-l0-objects
pg_isready -h 127.0.0.1 -p 55432 -d zhudatuan_registration >/dev/null
printf 'GCP_L0_HOST_BOOTSTRAP_READY database=empty host=127.0.0.1 port=55432 node=zhudatuan-l0\n'
