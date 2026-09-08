import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { IssueTerms, type IssueTermsValue } from '../../domain/value/IssueTerms';

export async function freezeIssueTerms(
  database: SqlExecutor,
  input: Readonly<{
    order: string;
    scope: string;
    product: string;
    customer: string;
    stockRequest: string;
    quantity: number;
    startsAt: Date;
    expiresAt: Date;
    now: Date;
  }>
): Promise<IssueTerms> {
  const row = (
    await database.query<Omit<IssueTermsValue, 'startsAt' | 'expiresAt'> & { startsAt: Date; expiresAt: Date }>(
      `select product.id product,product.version::integer as "productVersion",
    pool.id pool,product.face_minor::integer as "faceMinor",product.currency,product.qualification_id qualification,product.activation,
    product.starts_at as "startsAt",product.expires_at as "expiresAt"
    from voucher.product product join voucher.credentialpool pool on pool.id=product.pool_id and pool.product_id=product.id and pool.scope_id=product.scope_id
    join voucher.stockrequest request on request.id=$4 and request.scope_id=product.scope_id and request.product_id=product.id
      and request.customer_id=product.customer_id and request.pool_id=pool.id and request.state='approved'
    where product.id=$1 and product.scope_id=$2 and product.customer_id=$3 and product.state='enabled' and pool.state='open'
    for share of product,pool`,
      [input.product, input.scope, input.customer, input.stockRequest]
    )
  ).rows[0];
  if (!row) throw new DomainError('VOUCHER_PRODUCT_INCOMPLETE');
  const terms = new IssueTerms({ ...row, startsAt: new Date(row.startsAt).toISOString(), expiresAt: new Date(row.expiresAt).toISOString() });
  terms.assertValidity(input.startsAt, input.expiresAt, input.now);
  terms.amount(input.quantity);
  // Preserve database timestamp precision rather than round-tripping PostgreSQL
  // microseconds through JavaScript Date's millisecond representation.
  const captured = await database.query(
    `insert into voucher.issueterms(order_id,scope_id,product_id,product_version,pool_id,face_minor,currency,qualification_id,activation,starts_at,expires_at)
    select $1,$2,id,version,pool_id,face_minor,currency,qualification_id,activation,starts_at,expires_at
    from voucher.product where id=$3 and scope_id=$2 and version=$4`,
    [input.order, input.scope, terms.value.product, terms.value.productVersion]
  );
  if (captured.rowCount !== 1) throw new DomainError('VERSION_CONFLICT');
  return terms;
}

// Every issued-voucher lifecycle consumer follows the same frozen terms relation.
// No live product fallback: an unmapped issuance must fail closed at cutover.
export const VOUCHER_TERMS = `join voucher.credential issuedcredential on issuedcredential.id=voucher.credential_id and issuedcredential.scope_id=voucher.scope_id
  join voucher.issuebatch issuedbatch on issuedbatch.id=issuedcredential.issue_batch_id and issuedbatch.scope_id=voucher.scope_id
  join voucher.issueterms terms on terms.order_id=issuedbatch.order_id and terms.scope_id=voucher.scope_id and terms.product_id=voucher.product_id`;
