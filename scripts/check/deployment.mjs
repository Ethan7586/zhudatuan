import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const files = [
  'infrastructure/aliyun/runtime.template.yml',
  'infrastructure/aliyun/migration.template.yml',
  'infrastructure/aliyun/delivery.yml',
  'infrastructure/aliyun/backup.yml',
  'infrastructure/aliyun/deploy.sh',
  'infrastructure/aliyun/Dockerfile',
  'scripts/release/validate.mjs',
  'scripts/release/validatebundle.mjs',
  'scripts/release/candidate.mjs',
  'scripts/release/cutover.mjs',
  'scripts/release/stage.mjs',
  'scripts/release/promote.mjs',
  '.github/workflows/quality.yml',
];
const source = files.map((file) => `${file}\n${readFileSync(resolve(root, file), 'utf8')}`).join('\n');
const retired = ['storefront-web', 'admin-web', 'auth-web', 'commerce-api', 'core-read-cache', 'services/jobs', 'pm2', 'vite preview', '/api/ai', 'admin-voucher-test'];
for (const value of retired) if (source.toLowerCase().includes(value)) throw new Error(`RETIRED_DEPLOYMENT_REFERENCE:${value}`);
for (const value of ['ApiMain.js', 'JobsMain.js', 'MigrationMain.js', 'SmokeMain.js', '/health/live', '/health/ready', '/health/startup', 'replicas: 3', 'replicas: 2', 'sha256:', 'cosign verify-blob', 'providerSandboxAccepted', 'stagePassed', 'SHOP_CUTOVER_CONTROLLER', 'SHOP_CUTOVER_EVIDENCE', 'production-evidence', 'requirementsReleased', '5 25 50 100', 'automatic rollback']) {
  if (!source.includes(value)) throw new Error(`DEPLOYMENT_CONTRACT_MISSING:${value}`);
}
for (let stage = 1; stage <= 17; stage += 1) {
  if (!source.includes(`ci/${String(stage).padStart(2, '0')}_`)) throw new Error(`CI_STAGE_MISSING:${stage}`);
}
for (const client of ['console', 'store', 'supplier', 'storefront', 'auth', 'miniapp']) {
  if (!source.includes(client)) throw new Error(`CLIENT_ARTIFACT_MISSING:${client}`);
}
console.log('deployment contract: hard-cut, immutable, signed, highly available');
