import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const files = [
  '02_platform_pingtai/infrastructure/aliyun/runtime.template.yml',
  '02_platform_pingtai/infrastructure/aliyun/migration.template.yml',
  '02_platform_pingtai/infrastructure/aliyun/delivery.yml',
  '02_platform_pingtai/infrastructure/aliyun/backup.yml',
  '02_platform_pingtai/infrastructure/aliyun/deploy.sh',
  '02_platform_pingtai/infrastructure/aliyun/Dockerfile',
  '04_tools/scripts/release/validate.mjs',
  '04_tools/scripts/release/validatebundle.mjs',
  '04_tools/scripts/release/candidate.mjs',
  '04_tools/scripts/release/cutover.mjs',
  '04_tools/scripts/release/stage.mjs',
  '04_tools/scripts/release/promote.mjs',
  '.github/workflows/quality.yml',
];
const source = files.map((file) => `${file}\n${readFileSync(resolve(root, file), 'utf8')}`).join('\n');
const retired = ['admin-web', 'commerce-api', 'core-read-cache', '01_core_hexin/services/jobs', 'pm2', 'vite preview', '/api/ai', 'admin-voucher-test'];
for (const value of retired) if (source.toLowerCase().includes(value)) throw new Error(`RETIRED_DEPLOYMENT_REFERENCE:${value}`);
for (const value of ['ApiMain.js', 'JobsMain.js', 'MigrationMain.js', 'SmokeMain.js', '/health/live', '/health/ready', '/health/startup', 'replicas: 3', 'replicas: 2', 'sha256:', 'cosign verify-blob', 'providerSandboxAccepted', 'stagePassed', 'SHOP_CUTOVER_CONTROLLER', 'SHOP_CUTOVER_EVIDENCE', 'shop.cutover.v1', 'requirementsReleased', '5 25 50 100', 'automatic rollback']) {
  if (!source.includes(value)) throw new Error(`DEPLOYMENT_CONTRACT_MISSING:${value}`);
}
for (const command of ['npm ci', 'npm run check:cleaninstall', 'npm run check:artifacts', 'npm run check:migrations', 'npm run test:sql', 'npm run test:mvp', 'npm run typecheck', 'npm run test:unit', 'npm run test:contract', 'npm run test:component', 'npm run test:journey', 'npm run test:security', 'npm run test:performance', 'npm run replay:postgres', 'npm run test:integration', 'npm run test:adapters', 'npm run build']) {
  if (!source.includes(command)) throw new Error(`CI_COMMAND_MISSING:${command}`);
}
for (const client of ['console', 'storefront', 'auth', 'miniapp']) {
  if (!source.includes(client)) throw new Error(`CLIENT_ARTIFACT_MISSING:${client}`);
}
console.log('deployment contract: hard-cut, immutable, signed, highly available');
