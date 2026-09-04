import { array, boolean, int, literal, maxLength, minLength, null as nullSchema, optional, positive, regex, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';
import { voucherCredential } from '../VoucherCredential';
import { importCreated } from './ImportSchema';

const text = string().check(minLength(1), maxLength(255));
const download = string().check(minLength(1), maxLength(2048));
const reason = string().check(minLength(2), maxLength(1000));
const secret = string().check(minLength(voucherCredential.secret.minimum), maxLength(voucherCredential.secret.maximum), regex(voucherCredential.secret.pattern));
const number = string().check(minLength(voucherCredential.number.minimum), maxLength(voucherCredential.number.maximum), regex(voucherCredential.number.pattern));
const hash = string().check(regex(/^[0-9a-f]{64}$/));
const amount = int().check(positive());
const quantity = int().check(positive());
const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const stateChange = strictObject({ reason });
const validity = strictObject({ startsAt: isoUtc, expiresAt: isoUtc });
const productWrite = strictObject({
  customer: text,
  name: text,
  faceMinor: amount,
  currency,
  qualification: text,
  pool: optional(union([text, nullSchema()])),
  validity,
  activation: literal(['automatic', 'secret', 'numbersecret']),
  approvalRequired: boolean(),
});
const product = strictObject({
  id: text,
  number: text,
  scopeId: text,
  customer: text,
  name: text,
  faceMinor: unsigned,
  currency,
  qualification: text,
  pool: nullableText,
  validity,
  activation: literal(['automatic', 'secret', 'numbersecret']),
  approvalRequired: boolean(),
  state: literal(['draft', 'enabled', 'disabled', 'retired']),
  version,
  createdAt: isoUtc,
  updatedAt: isoUtc,
});
const productVersion = strictObject({ version, snapshot: ContractJsonValueSchema, changedBy: text, changedAt: isoUtc });
const productDetail = strictObject({ ...product.shape, versions: array(productVersion), supply: strictObject({ available: unsigned, allocated: unsigned }) });
const option = strictObject({ id: text, number: text, name: text, faceMinor: unsigned, currency, available: unsigned });

const poolWrite = strictObject({ product: text, name: text, mode: literal(['generated', 'imported']), prefix: text, capacity: quantity });
const pool = strictObject({ id: text, number: text, scopeId: text, product: text, name: text, mode: literal(['generated', 'imported']), prefix: text,
  capacity: unsigned, generated: unsigned, available: unsigned, allocated: unsigned, state: literal(['open', 'closed']), version, createdAt: isoUtc, updatedAt: isoUtc });
const credential = strictObject({ id: text, pool: text, product: text, numberMasked: text, fingerprint: hash, keyVersion: text,
  state: literal(['generated', 'available', 'allocated', 'void']), issueBatch: nullableText, version, createdAt: isoUtc });

const job = strictObject({ id: text, kind: text, state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']),
  processed: unsigned, total: unsigned, succeeded: unsigned, failed: unsigned, retryable: unsigned, updatedAt: isoUtc });
const exportJob = strictObject({ id: text, kind: text, state: literal(['pendingapproval', 'queued', 'running', 'completed', 'failed', 'expired']),
  expiresAt: isoUtc, downloadToken: optional(download), fileName: optional(text), createdAt: isoUtc, updatedAt: isoUtc });

const stockWrite = strictObject({ customer: text, product: text, pool: text, quantity, reason });
const stockRequest = strictObject({ id: text, number: text, scopeId: text, customer: text, product: text, pool: text, quantity: unsigned,
  reason: string(), state: literal(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'fulfilled']), approval: nullableText,
  requestedBy: text, version, createdAt: isoUtc, updatedAt: isoUtc });
const stockOption = strictObject({ request: text, number: text, product: text, pool: text, customer: text, available: unsigned, approved: unsigned });

const issueWrite = strictObject({ customer: text, product: text, stockRequest: text, quantity, purpose: literal(['benefit', 'order', 'campaign', 'manual']),
  delivery: literal(['account', 'claim']), validity, recipientSnapshot: text, reason });
const issueOrder = strictObject({ id: text, number: text, scopeId: text, customer: text, product: text, stockRequest: text, quantity: unsigned,
  purpose: literal(['benefit', 'order', 'campaign', 'manual']), delivery: literal(['account', 'claim']), validity, recipientSnapshot: text,
  reason: string(), state: literal(['draft', 'submitted', 'approved', 'issuing', 'completed', 'failed', 'cancelled']), approval: nullableText,
  issueBatch: nullableText, issued: unsigned, failed: unsigned, requestedBy: text, version, createdAt: isoUtc, updatedAt: isoUtc });
const issueBatch = strictObject({ id: text, order: text, scopeId: text, state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']),
  requested: unsigned, processed: unsigned, succeeded: unsigned, failed: unsigned, retryable: unsigned, version, createdAt: isoUtc, updatedAt: isoUtc });

const voucher = strictObject({ id: text, numberMasked: text, scopeId: text, product: text, productName: text, credential: text, holder: nullableText,
  initialMinor: unsigned, remainingMinor: unsigned, currency, state: literal(['generated', 'available', 'allocated', 'bound', 'active', 'held', 'redeemed', 'disabled', 'void', 'reversed', 'expired']),
  validity, version, createdAt: isoUtc, updatedAt: isoUtc });
const redemptionSummary = strictObject({ id: text, order: nullableText, amountMinor: unsigned, refundedMinor: unsigned, currency,
  state: literal(['succeeded', 'partiallyrefunded', 'refunded']), redeemedAt: isoUtc });
const timeline = strictObject({ sequence: unsigned, previous: nullableText, next: text, reason: string(), actor: text, occurredAt: isoUtc,
  redemption: union([redemptionSummary, nullSchema()]) });
const filter = strictObject({ query: optional(string().check(maxLength(128))), product: optional(text), pool: optional(text), customer: optional(text),
  holder: optional(text), state: optional(voucher.shape.state), expiresBefore: optional(isoUtc), expiresAfter: optional(isoUtc) });
const facet = strictObject({ value: text, count: unsigned });
const facets = strictObject({ states: array(facet), products: array(facet), pools: array(facet), watermark: isoUtc });
const snapshot = strictObject({ id: text, filterHash: hash, watermark: isoUtc, count: unsigned, expiresAt: isoUtc, createdAt: isoUtc });

const hold = strictObject({ id: text, voucher: text, owner: text, amountMinor: unsigned, state: literal(['active', 'consumed', 'released', 'expired']),
  expiresAt: isoUtc, idempotency: text, version, createdAt: isoUtc, updatedAt: isoUtc });
const redemption = strictObject({ id: text, voucher: text, hold: nullableText, verification: text, order: nullableText, amountMinor: unsigned,
  refundedMinor: unsigned, currency, state: literal(['succeeded', 'partiallyrefunded', 'refunded']), version, redeemedAt: isoUtc, updatedAt: isoUtc });
const refund = strictObject({ id: text, redemption: text, amountMinor: unsigned, currency, reason: string(), state: literal(['succeeded']),
  ruleVersion: version, createdAt: isoUtc });

const actionWrite = strictObject({ snapshot: text, action: literal(['activate', 'disable', 'enable', 'void', 'extend']), reason, expiresAt: optional(isoUtc) });
const actionBatch = strictObject({ id: text, scopeId: text, snapshot: text, action: literal(['activate', 'disable', 'enable', 'void', 'extend']),
  reason: string(), expiresAt: nullableTime, state: literal(['queued', 'running', 'completed', 'failed']), requested: unsigned, processed: unsigned,
  succeeded: unsigned, failed: unsigned, retryable: unsigned, version, createdAt: isoUtc, updatedAt: isoUtc });

export const VOUCHER_BODY_SCHEMAS = {
  VoucherProductsCreateInput: productWrite,
  VoucherProductsReviseInput: productWrite,
  VoucherProductsEnableInput: stateChange,
  VoucherProductsDisableInput: stateChange,
  VoucherCredentialpoolsCreateInput: poolWrite,
  VoucherCredentialsGenerateInput: strictObject({ count: quantity }),
  VoucherCredentialsImportInput: strictObject({ upload: text, fileHash: hash, fileName: text, mediaType: literal(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']), size: quantity }),
  VoucherCredentialpoolsCloseInput: stateChange,
  VoucherCredentialexportsCreateInput: strictObject({ pool: text, reason, watermark: isoUtc }),
  VoucherStockrequestsCreateInput: stockWrite,
  VoucherStockrequestsUpdateInput: stockWrite,
  VoucherStockrequestsSubmitInput: stateChange,
  VoucherStockrequestsCancelInput: stateChange,
  VoucherIssueordersCreateInput: issueWrite,
  VoucherIssueordersUpdateInput: issueWrite,
  VoucherIssueordersSubmitInput: stateChange,
  VoucherIssueordersCancelInput: stateChange,
  VoucherIssuebatchesRetryInput: stateChange,
  VoucherIssueorderexportsCreateInput: strictObject({ order: text, reason }),
  VoucherActionbatchesCreateInput: actionWrite,
  VoucherActionbatchesRetryInput: stateChange,
  VoucherActionexportsCreateInput: strictObject({ batch: text, reason }),
  VoucherActivationsSecretInput: strictObject({ secret }),
  VoucherActivationsNumbersecretInput: strictObject({ number, secret }),
  VoucherVouchersBindInput: strictObject({ member: text, reason }),
  VoucherVouchersUnbindInput: stateChange,
  VoucherRedemptionsQuoteInput: strictObject({ voucher: text, amountMinor: amount, order: optional(text) }),
  VoucherTenderholdsCreateInput: strictObject({ voucher: text, owner: text, amountMinor: amount, ttlSeconds: int().check(positive()) }),
  VoucherTenderholdsConsumeInput: strictObject({ verification: text, order: optional(text) }),
  VoucherTenderholdsReleaseInput: stateChange,
  VoucherRedemptionsCreateInput: strictObject({ voucher: text, hold: text, verification: text, amountMinor: amount, order: optional(text) }),
  VoucherRefundsCreateInput: strictObject({ amountMinor: amount, reason }),
  VoucherSearchsnapshotsCreateInput: strictObject({ filter }),
  VoucherSearchexportsCreateInput: strictObject({ snapshot: text, reason }),
} as const;

export const VOUCHER_QUERY_SCHEMAS = {
  VoucherProductsGetInput: strictObject({}),
  VoucherProductsListInput: strictObject({ ...pageQuery, state: optional(string()), customer: optional(string()) }),
  VoucherProductoptionsListInput: strictObject(pageQuery),
  VoucherCredentialpoolsGetInput: strictObject({}),
  VoucherCredentialpoolsListInput: strictObject({ ...pageQuery, product: optional(string()), state: optional(string()) }),
  VoucherCredentialsListInput: strictObject({ ...pageQuery, pool: optional(string()), state: optional(string()) }),
  VoucherCredentialsGetInput: strictObject({}),
  VoucherJobsGetInput: strictObject({}),
  VoucherStockrequestsGetInput: strictObject({}),
  VoucherStockrequestsListInput: strictObject({ ...pageQuery, state: optional(string()), customer: optional(string()) }),
  VoucherStockrequestoptionsListInput: strictObject(pageQuery),
  VoucherIssueordersGetInput: strictObject({}),
  VoucherIssueordersListInput: strictObject({ ...pageQuery, state: optional(string()), customer: optional(string()) }),
  VoucherIssuebatchesGetInput: strictObject({}),
  VoucherActionbatchesGetInput: strictObject({}),
  VoucherActionbatchesListInput: strictObject({ ...pageQuery, state: optional(string()), action: optional(string()) }),
  VoucherSearchReadInput: strictObject({ ...pageQuery, ...filter.shape }),
  VoucherVouchersGetInput: strictObject({}),
  VoucherVouchersGetbynumberInput: strictObject({}),
  VoucherVouchersTimelineInput: strictObject(pageQuery),
  VoucherRedemptionsGetInput: strictObject({}),
  VoucherSearchfacetsReadInput: filter,
  VoucherExportsGetInput: strictObject({}),
} as const;

export const VOUCHER_OUTPUT_SCHEMAS = {
  VoucherProductsCreateOutput: product,
  VoucherProductsReviseOutput: product,
  VoucherProductsEnableOutput: product,
  VoucherProductsDisableOutput: product,
  VoucherProductsGetOutput: productDetail,
  VoucherProductsListOutput: pageOutput(product),
  VoucherProductoptionsListOutput: pageOutput(option),
  VoucherCredentialpoolsCreateOutput: pool,
  VoucherCredentialsGenerateOutput: job,
  VoucherCredentialsImportOutput: importCreated,
  VoucherCredentialpoolsCloseOutput: pool,
  VoucherCredentialpoolsGetOutput: pool,
  VoucherCredentialpoolsListOutput: pageOutput(pool),
  VoucherCredentialsListOutput: pageOutput(credential),
  VoucherCredentialsGetOutput: credential,
  VoucherCredentialexportsCreateOutput: exportJob,
  VoucherJobsGetOutput: job,
  VoucherStockrequestsCreateOutput: stockRequest,
  VoucherStockrequestsUpdateOutput: stockRequest,
  VoucherStockrequestsSubmitOutput: stockRequest,
  VoucherStockrequestsCancelOutput: stockRequest,
  VoucherStockrequestsGetOutput: stockRequest,
  VoucherStockrequestsListOutput: pageOutput(stockRequest),
  VoucherStockrequestoptionsListOutput: pageOutput(stockOption),
  VoucherIssueordersCreateOutput: issueOrder,
  VoucherIssueordersUpdateOutput: issueOrder,
  VoucherIssueordersSubmitOutput: issueOrder,
  VoucherIssueordersCancelOutput: issueOrder,
  VoucherIssueordersGetOutput: issueOrder,
  VoucherIssueordersListOutput: pageOutput(issueOrder),
  VoucherIssuebatchesRetryOutput: issueBatch,
  VoucherIssuebatchesGetOutput: issueBatch,
  VoucherIssueorderexportsCreateOutput: exportJob,
  VoucherActionbatchesCreateOutput: actionBatch,
  VoucherActionbatchesGetOutput: actionBatch,
  VoucherActionbatchesListOutput: pageOutput(actionBatch),
  VoucherActionbatchesRetryOutput: actionBatch,
  VoucherActionexportsCreateOutput: exportJob,
  VoucherSearchReadOutput: pageOutput(voucher),
  VoucherActivationsSecretOutput: voucher,
  VoucherActivationsNumbersecretOutput: voucher,
  VoucherVouchersBindOutput: voucher,
  VoucherVouchersUnbindOutput: voucher,
  VoucherVouchersGetOutput: voucher,
  VoucherVouchersGetbynumberOutput: voucher,
  VoucherVouchersTimelineOutput: pageOutput(timeline),
  VoucherRedemptionsQuoteOutput: strictObject({ voucher, amountMinor: unsigned, remainingMinor: unsigned, expiresAt: isoUtc }),
  VoucherTenderholdsCreateOutput: hold,
  VoucherTenderholdsConsumeOutput: redemption,
  VoucherTenderholdsReleaseOutput: hold,
  VoucherRedemptionsCreateOutput: redemption,
  VoucherRefundsCreateOutput: refund,
  VoucherRedemptionsGetOutput: redemption,
  VoucherSearchfacetsReadOutput: facets,
  VoucherSearchsnapshotsCreateOutput: snapshot,
  VoucherSearchexportsCreateOutput: exportJob,
  VoucherExportsGetOutput: exportJob,
} as const;
