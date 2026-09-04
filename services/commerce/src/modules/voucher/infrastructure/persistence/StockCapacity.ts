/** One projection for selectable stock and the write-side quota check. */
export const STOCK_CAPACITY = `select request.id request,request.number,request.product_id product,
  request.pool_id pool,request.customer_id customer,credentials.available::integer,
  greatest(request.quantity-reservations.quantity,0)::integer approved
  from voucher.stockrequest request
  join lateral (
    select count(*) available from voucher.credential credential
    where credential.pool_id=request.pool_id and credential.scope_id=request.scope_id
      and credential.product_id=request.product_id and credential.state='available'
  ) credentials on true
  join lateral (
    select coalesce(sum(issue.quantity),0) quantity from voucher.issueorder issue
    where issue.stock_request_id=request.id and issue.scope_id=request.scope_id
      and issue.state<>'cancelled' and issue.id is distinct from $2::text
  ) reservations on true`;
