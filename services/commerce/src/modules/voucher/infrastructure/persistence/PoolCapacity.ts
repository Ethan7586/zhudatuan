/** New stock commitments consume physical supply minus every outstanding request.
 * Issued units already left physical supply, so subtract them from reservations
 * once, including partial successes of failed/retryable batches. */
export const POOL_CAPACITY = `select pool.id pool,pool.scope_id scope,pool.product_id product,pool.state,
  credentials.quantity::integer physical,reservations.quantity::integer reserved,
  greatest(credentials.quantity-reservations.quantity,0)::integer available
  from voucher.credentialpool pool
  join lateral (
    select count(*) quantity from voucher.credential credential
    where credential.scope_id=pool.scope_id and credential.pool_id=pool.id
      and credential.product_id=pool.product_id and credential.state='available'
  ) credentials on true
  join lateral (
    select coalesce(sum(greatest(request.quantity-issued.quantity,0)),0) quantity
    from voucher.stockrequest request
    join lateral (
      select coalesce(sum(batch.succeeded),0) quantity from voucher.issueorder issue
      join voucher.issuebatch batch on batch.order_id=issue.id and batch.scope_id=request.scope_id
      where issue.stock_request_id=request.id and issue.scope_id=request.scope_id and issue.product_id=request.product_id
    ) issued on true
    where request.scope_id=pool.scope_id and request.pool_id=pool.id and request.product_id=pool.product_id
      and request.state in('submitted','approved','fulfilled')
  ) reservations on true`;
