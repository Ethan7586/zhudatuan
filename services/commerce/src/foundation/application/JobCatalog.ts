export interface JobCatalogEntry {
  readonly id: string;
  readonly owner: string;
  readonly queue: string;
  readonly concurrency: number;
  readonly timeout: number;
  readonly retry: Readonly<{ attempts: number; minimum: number; maximum: number; jitter: true }>;
  readonly lease: number;
  readonly idempotency: 'jobid';
  readonly deadLetter: 'runtime.deadletters';
  readonly runbook: string;
  readonly worker: string;
}

function registerJob<const T extends JobCatalogEntry>(definition: T): Readonly<T> {
  return Object.freeze(definition);
}

const worker = 'services/commerce/src/modules/runtime/public/JobProcess.ts';
const deadLetter = 'runtime.deadletters' as const;
const retry = Object.freeze({ attempts: 8, minimum: 250, maximum: 60_000, jitter: true as const });
const retry5 = Object.freeze({ attempts: 5, minimum: 250, maximum: 60_000, jitter: true as const });
const retry3 = Object.freeze({ attempts: 3, minimum: 250, maximum: 30_000, jitter: true as const });

export const JOB_CATALOG = Object.freeze([
  registerJob({
    id: 'sessionrevocation',
    owner: 'identity',
    queue: 'identity',
    concurrency: 16,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/sessionrevocation.md',
    worker,
  }),
  registerJob({
    id: 'ownershipexpiry',
    owner: 'access',
    queue: 'governance',
    concurrency: 4,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/ownershipexpiry.md',
    worker,
  }),
  registerJob({
    id: 'qualificationexpiry',
    owner: 'qualification',
    queue: 'governance',
    concurrency: 8,
    timeout: 30_000,
    retry,
    lease: 60,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/qualificationexpiry.md',
    worker,
  }),
  registerJob({ id: 'approvalescalation', owner: 'approval', queue: 'governance', concurrency: 4, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/approval.md', worker }),
  registerJob({ id: 'catalogsync', owner: 'catalog', queue: 'channel', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/catalogsync.md', worker }),
  registerJob({ id: 'pricesync', owner: 'pricing', queue: 'channel', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/pricesync.md', worker }),
  registerJob({ id: 'inventorysync', owner: 'inventory', queue: 'channel', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/inventorysync.md', worker }),
  registerJob({
    id: 'experiencepublish',
    owner: 'experience',
    queue: 'experience',
    concurrency: 8,
    timeout: 30_000,
    retry,
    lease: 60,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/experiencepublish.md',
    worker,
  }),
  registerJob({
    id: 'experienceprovision',
    owner: 'experience',
    queue: 'experience',
    concurrency: 8,
    timeout: 30_000,
    retry,
    lease: 60,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/experienceprovision.md',
    worker,
  }),
  registerJob({ id: 'navigation', owner: 'navigation', queue: 'navigation', concurrency: 16, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/navigation.md', worker }),
  registerJob({ id: 'statementsync', owner: 'finance', queue: 'channel', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/statementsync.md', worker }),
  registerJob({ id: 'channelwebhook', owner: 'channel', queue: 'channel', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/channelwebhook.md', worker }),
  registerJob({ id: 'orderexpiry', owner: 'checkout', queue: 'transaction', concurrency: 16, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/orderexpiry.md', worker }),
  registerJob({
    id: 'reservationexpiry',
    owner: 'inventory',
    queue: 'transaction',
    concurrency: 16,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/reservationexpiry.md',
    worker,
  }),
  registerJob({
    id: 'marketingbudgetexpiry',
    owner: 'marketing',
    queue: 'transaction',
    concurrency: 16,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/marketingbudgetexpiry.md',
    worker,
  }),
  registerJob({ id: 'paymentquery', owner: 'payment', queue: 'payment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/paymentquery.md', worker }),
  registerJob({ id: 'paymentrefund', owner: 'payment', queue: 'payment', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/paymentrefund.md', worker }),
  registerJob({ id: 'paymentcancel', owner: 'payment', queue: 'payment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/paymentcancel.md', worker }),
  registerJob({ id: 'fulfillmentevent', owner: 'fulfillment', queue: 'fulfillment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/fulfillmentevent.md', worker }),
  registerJob({ id: 'fulfillment', owner: 'fulfillment', queue: 'fulfillment', concurrency: 16, timeout: 45_000, retry, lease: 90, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/fulfillment.md', worker }),
  registerJob({ id: 'tracking', owner: 'fulfillment', queue: 'fulfillment', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/tracking.md', worker }),
  registerJob({ id: 'benefitgrant', owner: 'benefit', queue: 'benefit', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/benefitgrant.md', worker }),
  registerJob({ id: 'benefitexpiry', owner: 'benefit', queue: 'benefit', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/benefitexpiry.md', worker }),
  registerJob({ id: 'credentialgenerate', owner: 'voucher', queue: 'batch', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/credentialgenerate.md', worker }),
  registerJob({ id: 'voucherissue', owner: 'voucher', queue: 'batch', concurrency: 8, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/voucherissue.md', worker }),
  registerJob({ id: 'voucheraction', owner: 'voucher', queue: 'batch', concurrency: 8, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/voucheraction.md', worker }),
  registerJob({ id: 'voucherexport', owner: 'voucher', queue: 'export', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/voucherexport.md', worker }),
  registerJob({ id: 'referralevent', owner: 'referral', queue: 'referral', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/referralevent.md', worker }),
  registerJob({
    id: 'referralsettlement',
    owner: 'referral',
    queue: 'referral',
    concurrency: 8,
    timeout: 120_000,
    retry,
    lease: 180,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/referralsettlement.md',
    worker,
  }),
  registerJob({ id: 'reconciliation', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/reconciliation.md', worker }),
  registerJob({ id: 'settlement', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/settlement.md', worker }),
  registerJob({ id: 'invoice', owner: 'finance', queue: 'finance', concurrency: 4, timeout: 60_000, retry, lease: 90, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/invoice.md', worker }),
  registerJob({
    id: 'identitynotification',
    owner: 'notification',
    queue: 'identity',
    concurrency: 16,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/notification.md',
    worker,
  }),
  registerJob({
    id: 'notification',
    owner: 'notification',
    queue: 'notification',
    concurrency: 32,
    timeout: 15_000,
    retry,
    lease: 30,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/notification.md',
    worker,
  }),
  registerJob({ id: 'projection', owner: 'reporting', queue: 'projection', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/projection.md', worker }),
  registerJob({ id: 'export', owner: 'reporting', queue: 'export', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/export.md', worker }),
  registerJob({ id: 'riskscan', owner: 'risk', queue: 'risk', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/riskscan.md', worker }),
  registerJob({ id: 'cleanup', owner: 'runtime', queue: 'maintenance', concurrency: 2, timeout: 60_000, retry, lease: 90, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/cleanup.md', worker }),
  registerJob({ id: 'memberimport', owner: 'member', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/memberimport.md', worker }),
  registerJob({ id: 'financeimport', owner: 'finance', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/financeimport.md', worker }),
  registerJob({ id: 'catalogimport', owner: 'catalog', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/catalogimport.md', worker }),
  registerJob({ id: 'orderimport', owner: 'order', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/orderimport.md', worker }),
  registerJob({ id: 'orderevent', owner: 'order', queue: 'transaction', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/orderevent.md', worker }),
  registerJob({
    id: 'inventoryimport',
    owner: 'inventory',
    queue: 'import',
    concurrency: 4,
    timeout: 120_000,
    retry,
    lease: 180,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/inventoryimport.md',
    worker,
  }),
  registerJob({ id: 'credentialimport', owner: 'voucher', queue: 'import', concurrency: 4, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/credentialimport.md', worker }),
  registerJob({ id: 'supportsla', owner: 'support', queue: 'support', concurrency: 8, timeout: 15_000, retry, lease: 30, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/supportsla.md', worker }),
  registerJob({ id: 'supportscan', owner: 'support', queue: 'support', concurrency: 8, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/supportscan.md', worker }),
  registerJob({ id: 'supportrelay', owner: 'support', queue: 'support', concurrency: 16, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/supportrelay.md', worker }),
  registerJob({ id: 'supportreassign', owner: 'support', queue: 'support', concurrency: 4, timeout: 30_000, retry, lease: 60, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/supportreassign.md', worker }),
  registerJob({ id: 'auditarchive', owner: 'audit', queue: 'maintenance', concurrency: 2, timeout: 120_000, retry, lease: 180, idempotency: 'jobid', deadLetter, runbook: 'docs/operations/auditarchive.md', worker }),
  registerJob({
    id: 'extensionhealth',
    owner: 'extension',
    queue: 'maintenance',
    concurrency: 8,
    timeout: 30_000,
    retry,
    lease: 60,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/extensionhealth.md',
    worker,
  }),
  registerJob({
    id: 'directorysync',
    owner: 'organization',
    queue: 'identity',
    concurrency: 8,
    timeout: 120_000,
    retry,
    lease: 180,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/directorysync.md',
    worker,
  }),
  registerJob({
    id: 'directoryreconcile',
    owner: 'organization',
    queue: 'maintenance',
    concurrency: 2,
    timeout: 300_000,
    retry: retry5,
    lease: 360,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/directoryreconcile.md',
    worker,
  }),
  registerJob({
    id: 'federationcleanup',
    owner: 'identity',
    queue: 'maintenance',
    concurrency: 2,
    timeout: 60_000,
    retry,
    lease: 90,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/federationcleanup.md',
    worker,
  }),
  registerJob({
    id: 'providerhealth',
    owner: 'identity',
    queue: 'identity',
    concurrency: 8,
    timeout: 30_000,
    retry: retry3,
    lease: 60,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/providerhealth.md',
    worker,
  }),
  registerJob({
    id: 'invitationcleanup',
    owner: 'identity',
    queue: 'maintenance',
    concurrency: 2,
    timeout: 60_000,
    retry,
    lease: 90,
    idempotency: 'jobid',
    deadLetter,
    runbook: 'docs/operations/invitationcleanup.md',
    worker,
  }),
] satisfies readonly JobCatalogEntry[]);

export type JobKind = (typeof JOB_CATALOG)[number]['id'];

export const PROVIDER_JOB_IDS = Object.freeze(['catalogsync', 'pricesync', 'inventorysync', 'statementsync', 'channelwebhook', 'fulfillment', 'tracking', 'extensionhealth'] as const satisfies readonly JobKind[]);
export type ProviderJobKind = (typeof PROVIDER_JOB_IDS)[number];
const providerJobs = new Set<JobKind>(PROVIDER_JOB_IDS);
export const PROVIDER_JOB_CATALOG = Object.freeze(JOB_CATALOG.filter(({ id }) => providerJobs.has(id))) as readonly (JobCatalogEntry & { readonly id: ProviderJobKind })[];
export const ORDINARY_JOB_CATALOG = Object.freeze(JOB_CATALOG.filter(({ id }) => !providerJobs.has(id)));

export function jobDefinition(id: JobKind): JobCatalogEntry {
  const definition = JOB_CATALOG.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`JOB_CONFIGURATION_MISSING:${id}`);
  return definition;
}

if (new Set(JOB_CATALOG.map(({ id }) => id)).size !== JOB_CATALOG.length) throw new Error('JOB_CATALOG_DUPLICATE');
if (PROVIDER_JOB_CATALOG.length !== PROVIDER_JOB_IDS.length || ORDINARY_JOB_CATALOG.length + PROVIDER_JOB_CATALOG.length !== JOB_CATALOG.length) throw new Error('JOB_WORKLOAD_CATALOG_INVALID');
