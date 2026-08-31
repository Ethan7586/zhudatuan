<<<<<<< HEAD
<<<<<<< HEAD
import { randomUUID } from 'node:crypto';
=======
import { createHash, randomUUID } from 'node:crypto';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { randomUUID } from 'node:crypto';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { FinanceRepositoryFactory } from '../port/FinanceRepository';

export function requestInvoiceOperations(repository: FinanceRepositoryFactory): OperationActions {
  return {
    'invoice.requests.create': requestInvoice,
    'invoice.requests.cancel': cancelInvoice,
    'invoice.requests.decide': (request, database) => decideInvoice(request, database, repository),
    'invoice.requests.red': redInvoice,
  };
}

const requestInvoice: NonNullable<OperationActions['invoice.requests.create']> = async (request, database) => {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  requireAccess(request);
  const body = bodyRecord(request);
  const id = `invoice:${randomUUID()}`;
  const amount = integerField(body, 'amountMinor', 1);
  const settlement = textField(body, 'settlement');
<<<<<<< HEAD
  const lines = identifiers(body.lines, 'lines');
  const result = await database.query(`select * from invoice.create_request($1,$2,$3,$4,$5::text[],$6,$7::jsonb,$8)`, [
    id,
    textField(body, 'profile'),
    settlement,
    amount,
    lines,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!(result.rows[0] as { id?: string } | undefined)?.id) throw new Error('INVOICE_PROFILE_OR_SETTLEMENT_INVALID');
=======
  const access = requireAccess(request); const body = bodyRecord(request); const id = `invoice:${randomUUID()}`;
  const amount = integerField(body, 'amountMinor', 1); const settlement = textField(body, 'settlement');
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const lines = identifiers(body.lines, 'lines');
  const result = await database.query(`select * from invoice.create_request($1,$2,$3,$4,$5::text[],$6,$7::jsonb,$8)`, [
    id,
    textField(body, 'profile'),
    settlement,
    amount,
    lines,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!(result.rows[0] as { id?: string } | undefined)?.id) throw new Error('INVOICE_PROFILE_OR_SETTLEMENT_INVALID');
<<<<<<< HEAD
  await database.query(`insert into invoice.requestprofile(request_id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,
    taxid_key_version,address_ciphertext,address_key_version,profile_version) select $1,owner_id,title_ciphertext,title_key_version,
    taxid_ciphertext,taxid_token,taxid_key_version,address_ciphertext,address_key_version,version from invoice.profile where id=$2`, [id, body.profile]);
  await database.query(`insert into invoice.requestline(id,request_id,settlement_line_id,kind,amount_minor,tax_minor,source_hash)
    select 'invoiceline:'||$1||':'||line.id,$1,line.id,'original',line.amount,line.tax,
      encode(public.digest(line.id||':'||line.amount||':'||line.tax,'sha256'),'hex')
    from jsonb_to_recordset($2::jsonb) line(id text,amount bigint,tax bigint)`,
  [id, JSON.stringify(selected.map((line) => ({ id: line.id, amount: line.amount_minor, tax: line.tax_minor })))]);
  await database.query(`insert into invoice.line(request_id,sequence,description,amount_minor,tax_minor,source_line_id)
    select $1,row_number() over(order by line.id),line.source_type||':'||line.source_id,line.amount,line.tax,line.id
    from jsonb_to_recordset($2::jsonb) line(id text,source_type text,source_id text,amount bigint,tax bigint)`,
  [id, JSON.stringify(selected.map((line) => ({ id: line.id,source_type: line.source_type,source_id: line.source_id,
    amount: line.amount_minor,tax: line.tax_minor })))]);
  await database.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at) values($1,1,'submitted',clock_timestamp())`, [id]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return rowResult(result, 201);
};

const cancelInvoice: NonNullable<OperationActions['invoice.requests.cancel']> = async (request, database) => {
<<<<<<< HEAD
<<<<<<< HEAD
  requireAccess(request);
  const result = await database.query<{ id: string }>(`select * from invoice.cancel_request($1,$2)`, [request.input.path.requestid!, request.input.expectedVersion!]);
  return rowResult(result);
};

async function decideInvoice(request: OperationRequest, database: Parameters<FinanceRepositoryFactory>[0], repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('INVOICE_DECISION_INVALID');
  const result = await database.query(`select * from invoice.decide_request($1,$2,$3,$4::jsonb,$5)`, [
    request.input.path.requestid!,
    decision,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!result.rows[0]) throw new Error('INVOICE_DECISION_CONFLICT_OR_SEPARATION');
  if (decision === 'approved') await repository(database).enqueue('invoice', access.scope.id, { request: request.input.path.requestid! }, `job:invoice:${request.input.path.requestid!}`, true);
=======
  const access = requireAccess(request);
  const result = await database.query<{ id: string }>(`update invoice.request request set state='cancelled',version=version+1
    from invoice.profile profile where request.id=$1 and request.profile_id=profile.id and profile.owner_id=$2 and request.state='submitted'
    and ($3::bigint is null or request.version=$3) returning request.*`,
  [request.input.path.requestid!, access.scope.id, request.input.expectedVersion ?? null]);
  if (result.rows[0]) await database.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at)
    select $1,coalesce(max(sequence),0)+1,'cancelled',clock_timestamp() from invoice.statusevent where request_id=$1`, [result.rows[0].id]);
=======
  requireAccess(request);
  const result = await database.query<{ id: string }>(`select * from invoice.cancel_request($1,$2)`, [request.input.path.requestid!, request.input.expectedVersion!]);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return rowResult(result);
};

async function decideInvoice(request: OperationRequest, database: Parameters<FinanceRepositoryFactory>[0], repository: FinanceRepositoryFactory) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
  if (!decision) throw new Error('INVOICE_DECISION_INVALID');
  const result = await database.query(`select * from invoice.decide_request($1,$2,$3,$4::jsonb,$5)`, [
    request.input.path.requestid!,
    decision,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
  if (!result.rows[0]) throw new Error('INVOICE_DECISION_CONFLICT_OR_SEPARATION');
<<<<<<< HEAD
  if (decision === 'approved') await repository(database).enqueue('invoice', access.scope.id,
    { request: request.input.path.requestid! }, `job:invoice:${request.input.path.requestid!}`, true);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  if (decision === 'approved') await repository(database).enqueue('invoice', access.scope.id, { request: request.input.path.requestid! }, `job:invoice:${request.input.path.requestid!}`, true);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return rowResult(result, decision === 'approved' ? 202 : 200);
}

const redInvoice: NonNullable<OperationActions['invoice.requests.red']> = async (request, database) => {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  requireAccess(request);
  const body = bodyRecord(request);
  const id = `invoice:red:${randomUUID()}`;
  const result = await database.query(`select * from invoice.create_red_request($1,$2,$3,$4::jsonb,$5)`, [
    id,
    request.input.path.requestid!,
    textField(body, 'reason', 1000),
    JSON.stringify(record(body.evidence)),
    request.input.expectedVersion!,
  ]);
<<<<<<< HEAD
  if (!result.rows[0]) throw new Error('INVOICE_RED_NOT_ELIGIBLE');
  return rowResult(result, 201);
};
function identifiers(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  const values = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .sort();
=======
  const access = requireAccess(request); const body = bodyRecord(request); const id = `invoice:red:${randomUUID()}`;
  const result = await database.query(`insert into invoice.request(id,profile_id,settlement_id,amount_minor,currency,state,created_at,version,
    requested_by,reason,evidence,source_hash,kind,red_of_request_id) select $1,source.profile_id,source.settlement_id,source.amount_minor,
    source.currency,'submitted',clock_timestamp(),0,$2,$3,$4::jsonb,source.source_hash,'red',source.id from invoice.request source
    join invoice.profile profile on profile.id=source.profile_id where source.id=$5 and profile.owner_id=$6 and source.state='issued'
    and not exists(select 1 from invoice.request red where red.red_of_request_id=source.id and red.state not in('rejected','cancelled','failed')) returning *`,
  [id, access.actor.id, textField(body, 'reason', 1000), JSON.stringify(record(body.evidence)), request.input.path.requestid!, access.scope.id]);
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (!result.rows[0]) throw new Error('INVOICE_RED_NOT_ELIGIBLE');
  return rowResult(result, 201);
};
function identifiers(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`VALIDATION_FAILED:${field}`);
<<<<<<< HEAD
  const values = value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean).sort();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const values = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .sort();
>>>>>>> 018b2a71 (chore(release): capture current production source)
  if (values.length === 0 || values.length > 1_000 || new Set(values).size !== values.length) throw new Error(`VALIDATION_FAILED:${field}`);
  return values;
}
function record(value: unknown): Readonly<Record<string, unknown>> {
<<<<<<< HEAD
<<<<<<< HEAD
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
=======
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
>>>>>>> 018b2a71 (chore(release): capture current production source)
}
