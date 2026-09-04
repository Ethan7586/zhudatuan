begin;

do $contract$
declare violation text;
begin
  select voucher.id into violation
  from voucher.voucher voucher
  left join voucher.holder holder on holder.id=voucher.holder_id and holder.voucher_id=voucher.id
  where voucher.remaining_minor<0 or voucher.remaining_minor>voucher.initial_minor
    or voucher.expires_at<=voucher.starts_at or voucher.version<=0
    or (voucher.state='redeemed' and voucher.remaining_minor<>0)
    or (voucher.holder_id is not null and holder.id is null)
  order by voucher.id limit 1;
  if violation is not null then raise exception 'IDEAL_VOUCHER_STATE_INVALID:%',violation; end if;

  select redemption.id into violation
  from voucher.redemption redemption
  left join voucher.voucher voucher on voucher.id=redemption.voucher_id
  left join lateral(
    select coalesce(sum(refund.amount_minor),0) refunded_minor
    from voucher.refund refund where refund.redemption_id=redemption.id and refund.state='succeeded'
  ) refund on true
  where voucher.id is null or redemption.amount_minor<=0
    or redemption.refunded_minor<>refund.refunded_minor
    or redemption.refunded_minor>redemption.amount_minor
    or (redemption.state='refunded')<>(redemption.refunded_minor=redemption.amount_minor)
  order by redemption.id limit 1;
  if violation is not null then raise exception 'IDEAL_VOUCHER_REDEMPTION_INVALID:%',violation; end if;

  select hold.id into violation
  from voucher.tenderhold hold
  left join voucher.voucher voucher on voucher.id=hold.voucher_id
  where voucher.id is null or hold.amount_minor>voucher.remaining_minor and hold.state='active'
  order by hold.id limit 1;
  if violation is not null then raise exception 'IDEAL_VOUCHER_HOLD_INVALID:%',violation; end if;
end
$contract$;

rollback;
