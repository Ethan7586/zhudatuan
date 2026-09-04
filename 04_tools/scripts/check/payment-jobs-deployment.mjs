import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const runtime = read('01_core_hexin/services/commerce/src/bootstrap/PaymentJobsRuntime.ts');
const main = read('01_core_hexin/services/commerce/src/entry/PaymentJobsOnlyMain.ts');
const ready = read('01_core_hexin/services/commerce/src/entry/PaymentJobsReadyMain.ts');
const environment = read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/payment-jobs.env.example');
const service = read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-jobs.service');
const delivery = read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/delivery.yml');
const build = read('04_tools/scripts/build-commerce.mjs');

const requiredRuntime = [
  "PAYMENT_JOB_KINDS = Object.freeze(['paymentquery', 'paymentrefund']",
  "new QueueJob('paymentquery'",
  "new QueueJob('paymentrefund'",
  "state.current_user !== 'shopjob'",
  "runtime.claim_job(text,text,integer,integer)",
];
const requiredService = [
  'Environment=JOB_RUNTIME_PROFILE=payment-only',
  'EnvironmentFile=/opt/zhudatuan/shared/payment-jobs.env',
  'ExecStartPre=/usr/bin/node 01_core_hexin/services/commerce/dist/PaymentJobsReadyMain.js',
  'ExecStart=/usr/bin/node 01_core_hexin/services/commerce/dist/PaymentJobsOnlyMain.js',
  'TimeoutStartSec=30',
  'WantedBy=multi-user.target',
  'InaccessiblePaths=-/opt/smart-wing -/opt/smart-wiston -/opt/shop-test',
];
const requiredDelivery = [
  'paymentJobsProfile: payment-only',
  'process: zhudatuan-payment-jobs',
  'databaseRole: shopjob',
  'databaseConnectionRef: zhudatuan/payment/database/jobs',
  '- paymentquery',
  '- paymentrefund',
];
const requiredEnvironment = [
  'DATABASE_JOB_CONNECTION_REF=zhudatuan/payment/database/jobs',
  'WECHAT_APPLICATION_CONFIG_REF=zhudatuan/purchase/wechat/applications',
  'WECHAT_PAYMENT_CONFIG_REF=zhudatuan/purchase/payment/wechat',
  'JOB_WORKER_ID=zhudatuan-payment-1',
];

for (const [source, tokens] of [[runtime, requiredRuntime], [service, requiredService], [delivery, requiredDelivery],
  [environment, requiredEnvironment]]) {
  for (const token of tokens) if (!source.includes(token)) throw new Error(`PAYMENT_JOBS_DEPLOYMENT_TOKEN_MISSING:${token}`);
}
if (!main.includes("!== 'payment-only'") || !ready.includes("!== 'payment-only'")) {
  throw new Error('PAYMENT_JOBS_PROFILE_GUARD_MISSING');
}
for (const artifact of ['PaymentJobsOnlyMain', 'PaymentJobsReadyMain']) {
  if (!build.includes(`${artifact}:`)) throw new Error(`PAYMENT_JOBS_BUILD_ARTIFACT_MISSING:${artifact}`);
}
const keys = environment.split('\n').filter((line) => line && !line.startsWith('#')).map((line) => line.split('=', 1)[0]).sort();
const expected = ['APP_ENV', 'DATABASE_JOB_CONNECTION_REF', 'JOB_WORKER_ID', 'NODE_EXTRA_CA_CERTS', 'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT', 'SERVICE_VERSION', 'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF'].sort();
if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error('PAYMENT_JOBS_ENVIRONMENT_ALLOWLIST_INVALID');

process.stdout.write('payment Jobs deployment contract passed\n');
