import { array, boolean, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const profile = strictObject({ id: string(), owner_id: string(), status: literal(['active', 'deleted']), version });
const profileRead = strictObject({ id: string(), status: literal('active'), version });
const request = strictObject({
  id: string(),
  profile_id: string(),
  settlement_id: string(),
  amount_minor: unsigned,
  currency,
  state: string(),
  created_at: isoUtc,
  version,
  requested_by: nullableText,
  approved_by: nullableText,
  reason: nullableText,
  evidence: ContractJsonValueSchema,
  source_hash: nullableText,
  kind: literal(['original', 'red']),
  red_of_request_id: nullableText,
  issue_hash: nullableText,
  issue_count: union([unsigned, nullSchema()]),
  issue_watermark: nullableTime,
  provider: nullableText,
  provider_reference: nullableText,
  response_hash: nullableText,
});
const requestLine = strictObject({ settlementLine: string(), amountMinor: unsigned, taxMinor: unsigned, sourceHash: string() });
const requestRead = strictObject({ ...request.shape, object_ref: nullableText, sha256: nullableText, issued_at: nullableTime, lines: array(requestLine) });
const memberInvoice = strictObject({
  id: string(),
  amountMinor: unsigned,
  currency,
  state: string(),
  kind: literal(['original', 'red']),
  createdAt: isoUtc,
  issuedAt: nullableTime,
  sha256: nullableText,
  downloadable: boolean(),
  version,
});

export const INVOICE_QUERY_SCHEMAS = {
  InvoiceProfilesReadInput: strictObject(pageQuery),
  InvoiceRequestsReadInput: strictObject(pageQuery),
  FinanceInvoicesReadInput: strictObject(pageQuery),
  FinanceInvoicesDownloadInput: strictObject({}),
} as const;
export const INVOICE_BODY_SCHEMAS = {
  InvoiceProfilesManageInput: strictObject({ title: string(), taxid: string(), address: optional(string()) }),
  InvoiceRequestsCreateInput: strictObject({ profile: string(), settlement: string(), amountMinor: unsigned, lines: array(string()), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  InvoiceRequestsCancelInput: strictObject({}),
  InvoiceRequestsDecideInput: strictObject({ decision: literal(['approved', 'rejected']), reason: string(), evidence: optional(ContractJsonValueSchema) }),
  InvoiceRequestsRedInput: strictObject({ reason: string(), evidence: optional(ContractJsonValueSchema) }),
} as const;
export const INVOICE_OUTPUT_SCHEMAS = {
  InvoiceProfilesManageOutput: profile,
  InvoiceProfilesReadOutput: pageOutput(profileRead),
  InvoiceRequestsCreateOutput: request,
  InvoiceRequestsReadOutput: pageOutput(requestRead),
  InvoiceRequestsCancelOutput: request,
  InvoiceRequestsDecideOutput: request,
  InvoiceRequestsRedOutput: request,
  FinanceInvoicesReadOutput: pageOutput(memberInvoice),
  FinanceInvoicesDownloadOutput: strictObject({ url: string(), expiresAt: isoUtc, filename: string(), sha256: string() }),
} as const;
