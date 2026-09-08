import type { FinanceAction, FinanceEntries } from './FinanceOperation';
/** Invoice persistence actions. */
import { DomainError } from '../../../../platform/error/DomainError';
import { createHash, randomUUID } from 'node:crypto';

import { requireAccess } from '../../../../pipeline/OperationAccess';
import { rowResult } from '../../../../platform/database/DatabaseResult';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import type { FinanceWorkflowFactory } from './PgFinanceWorkflow';
import { Invoice as InvoiceAggregate } from '../../domain/model/Invoice';
import type { FinanceOrderPort } from '../../../order/public';
import type { FinancePaymentPort } from '../../../payment/public';

export function invoiceActions(repository: FinanceWorkflowFactory, orders: FinanceOrderPort, payments: FinancePaymentPort): FinanceEntries<'requestsCreate' | 'requestsCancel' | 'requestsDecide' | 'redInvoice'> {
  return {
    requestsCreate: (request, database) => requestInvoice(request, database, orders, payments),
    requestsCancel: cancelInvoice,
    requestsDecide: (request, database) => decideInvoice(request, database, repository),
    redInvoice,
  };
}

const requestInvoice = async (request: Parameters<FinanceAction>[0], database: Parameters<FinanceAction>[1], orders: FinanceOrderPort, payments: FinancePaymentPort) => {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const id = `invoice:${randomUUID()}`;
  const amount = integerField(body, 'amountMinor', 1);
  const settlement = textField(body, 'settlement');
  const profile = textField(body, 'profile');
  const lines = identifiers(body.lines, 'lines');
  const eligible = await database.query<InvoiceLine>(
    `select line.id,line.source_type,line.source_id,line.invoice_minor::float8 amount_minor,
    floor(line.tax_minor::numeric*line.invoice_minor/line.amount_minor)::float8 tax_minor
    from finance.settlement settlement join finance.settlementline line on line.settlement_id=settlement.id
    where settlement.id=$1 and settlement.scope_id=$2 and settlement.state in('payable','paid') and line.id=any($3::text[])
      and line.invoice_minor>0 and line.direction='increase' and line.source_type not in('refund','fee')
      and not exists(select 1 from invoice.requestline used join invoice.request request on request.id=used.request_id
        where used.settlement_line_id=line.id and used.kind='original' and request.state not in('rejected','cancelled','failed'))
    order by line.id for update of settlement,line`,
    [settlement, access.scope.id, lines]
  );
  const selected = eligible.rows;
  if (selected.length !== lines.length || selected.reduce((sum, line) => sum + line.amount_minor, 0) !== amount) {
    throw new Error('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
  }
  await assertInvoiceSources(request.transaction, selected, orders, payments);
  const sourceHash = createHash('sha256')
    .update(selected.map((line) => `${line.id}:${line.amount_minor}:${line.tax_minor}`).join(','))
    .digest('hex');
  const proposal = InvoiceAggregate.submit({
    id,
    profileId: profile,
    settlementId: settlement,
    amountMinor: amount,
    currency: 'CNY',
    kind: 'original',
    redOf: null,
    lines: selected.map((line) => ({ id: line.id, description: `${line.source_type}:${line.source_id}`, amountMinor: line.amount_minor, taxMinor: line.tax_minor })),
    requestedBy: access.actor.id,
  }).snapshot();
  const result = await database.query(
    `insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,reason,evidence,source_hash,kind) select $1,profile.id,$2,$3,settlement.currency,'submitted',clock_timestamp(),0,$4,$5,
    $6::jsonb,$7,'original' from invoice.profile profile join finance.settlement settlement on settlement.id=$2 where profile.id=$8
    and profile.owner_id=$9 and profile.status='active' and settlement.scope_id=$9 returning *`,
    [proposal.id, proposal.settlementId, proposal.amountMinor, proposal.requestedBy, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), sourceHash, proposal.profileId, access.scope.id]
  );
  if (!(result.rows[0] as { id?: string } | undefined)?.id) throw new Error('INVOICE_PROFILE_OR_SETTLEMENT_INVALID');
  await database.query(
    `insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
    taxid_key_version,address_ciphertext,address_key_version,profile_version) select $1,owner_id,title_ciphertext,title_key_version,
    taxid_ciphertext,taxid_token,taxid_key_version,address_ciphertext,address_key_version,version from invoice.profile where id=$2`,
    [id, proposal.profileId]
  );
  await database.query(
    `insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
    select 'invoiceline:'||$1||':'||line.id,$1,line.id,'original',line.amount,line.tax,
      encode(public.digest(line.id||':'||line.amount||':'||line.tax,'sha256'),'hex')
    from jsonb_to_recordset($2::jsonb) line(id text,amount bigint,tax bigint)`,
    [id, JSON.stringify(selected.map((line) => ({ id: line.id, amount: line.amount_minor, tax: line.tax_minor })))]
  );
  await database.query(
    `insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
    select $1,row_number() over(order by line.id),line.source_type||':'||line.source_id,line.amount,line.tax,line.id
    from jsonb_to_recordset($2::jsonb) line(id text,source_type text,source_id text,amount bigint,tax bigint)`,
    [id, JSON.stringify(selected.map((line) => ({ id: line.id, source_type: line.source_type, source_id: line.source_id, amount: line.amount_minor, tax: line.tax_minor })))]
  );
  await database.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at) values($1,1,'submitted',clock_timestamp())`, [id]);
  return rowResult(result, 201);
};

async function assertInvoiceSources(context: Parameters<FinanceOrderPort['verified']>[0], lines: readonly InvoiceLine[], orders: FinanceOrderPort, payments: FinancePaymentPort): Promise<void> {
  const paymentIds = distinct(lines.filter(({ source_type }) => source_type === 'payment').map(({ source_id }) => source_id));
  const paymentOrders = await payments.orders(context, paymentIds);
  if (new Set(paymentOrders.map(({ payment }) => payment)).size !== paymentIds.length) throw new Error('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
  const orderIds = distinct([...lines.filter(({ source_type }) => source_type === 'order').map(({ source_id }) => source_id), ...paymentOrders.map(({ order }) => order)]);
  const verified = await orders.verified(context, orderIds);
  if (new Set(verified).size !== orderIds.length) throw new Error('INVOICE_LINES_NOT_ELIGIBLE_OR_AMOUNT_MISMATCH');
}

function distinct(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

const cancelInvoice: FinanceAction = async (request, database) => {
  const access = requireAccess(request);
  const result = await database.query<{ id: string }>(
    `update invoice.request request set state='cancelled',version=version+1
    from invoice.profile profile where request.id=$1 and request.profile_id=profile.id and profile.owner_id=$2 and request.state='submitted'
    and ($3::bigint is null or request.version=$3) returning request.*`,
    [request.input.path.requestid!, access.scope.id, request.input.expectedVersion ?? null]
  );
  if (result.rows[0])
    await database.query(
      `insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    select $1,coalesce(max(sequence),0)+1,'cancelled',clock_timestamp() from invoice.statusevent where request_id=$1`,
      [result.rows[0].id]
    );
  return rowResult(result);
};

async function decideInvoice(request: OperationRequest, database: Parameters<FinanceWorkflowFactory>[0], repository: FinanceWorkflowFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('INVOICE_DECISION_INVALID');
  const result = await database.query(
    `update invoice.request request set state=$2,approved_by=case when $2='approved' then $3 else null end,
    reason=$4,evidence=evidence||$5::jsonb,version=version+1 from invoice.profile profile where request.id=$1
    and request.profile_id=profile.id and profile.owner_id=$6 and request.state in('submitted','failed') and request.requested_by<>$3 returning request.*`,
    [request.input.path.requestid!, decision, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), access.scope.id]
  );
  if (!result.rows[0]) throw new Error('INVOICE_DECISION_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('invoice', access.scope.id, { request: request.input.path.requestid! }, `job:invoice:${request.input.path.requestid!}`, true);
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

const redInvoice: FinanceAction = async (request, database) => {
  const access = requireAccess(request);
  const body = bodyRecord(request.input);
  const id = `invoice:red:${randomUUID()}`;
  const result = await database.query(
    `insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,reason,evidence,source_hash,kind,red_of_request_id) select $1,source.profile_id,source.settlement_id,source.amount_minor,
    source.currency,'submitted',clock_timestamp(),0,$2,$3,$4::jsonb,source.source_hash,'red',source.id from invoice.request source
    join invoice.profile profile on profile.id=source.profile_id where source.id=$5 and profile.owner_id=$6 and source.state='issued'
    and not exists(select 1 from invoice.request red where red.red_of_request_id=source.id and red.state not in('rejected','cancelled','failed')) returning *`,
    [id, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), request.input.path.requestid!, access.scope.id]
  );
  if (!result.rows[0]) throw new Error('INVOICE_RED_NOT_ELIGIBLE');
  await database.query(
    `insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
    taxid_key_version,address_ciphertext,address_key_version,profile_version) select $1,owner_id,title_ciphertext,title_key_version,
    taxid_ciphertext,taxid_token,taxid_key_version,address_ciphertext,address_key_version,profile_version
    from invoice.requestprofile where request_id=$2`,
    [id, request.input.path.requestid!]
  );
  await database.query(
    `insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
    select 'invoiceline:'||$1||':'||settlement_line_id,$1,settlement_line_id,'red',amount_minor,tax_minor,source_hash
    from invoice.requestline where request_id=$2 and kind='original'`,
    [id, request.input.path.requestid!]
  );
  await database.query(
    `insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
    select $1,sequence,'红冲：'||description,amount_minor,tax_minor,source_line_id from invoice.line where request_id=$2`,
    [id, request.input.path.requestid!]
  );
  await database.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at) values($1,1,'submitted',clock_timestamp())`, [id]);
  return rowResult(result, 201);
};

interface InvoiceLine {
  readonly id: string;
  readonly source_type: string;
  readonly source_id: string;
  readonly amount_minor: number;
  readonly tax_minor: number;
}
function identifiers(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: field });
  const values = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .sort();
  if (values.length === 0 || values.length > 1_000 || new Set(values).size !== values.length) throw new DomainError('VALIDATION_FAILED', { field: field });
  return values;
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
}
