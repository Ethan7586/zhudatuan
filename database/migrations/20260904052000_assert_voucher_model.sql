begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904051000') then raise exception 'IDEAL_VOUCHER_ASSERT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904052000') then raise exception 'IDEAL_VOUCHER_ASSERT_ALREADY_APPLIED'; end if;
end
$precondition$;

do $assert$
begin
  if (select count(*) from voucher.legacyvoucher)<>(select count(*) from voucher.voucher)
    then raise exception 'IDEAL_VOUCHER_COUNT_MISMATCH'; end if;
  if (select coalesce(sum(initial_minor),0) from voucher.legacyvoucher)<>(select coalesce(sum(initial_minor),0) from voucher.voucher)
    or (select coalesce(sum(remaining_minor),0) from voucher.legacyvoucher)<>(select coalesce(sum(remaining_minor),0) from voucher.voucher)
    then raise exception 'IDEAL_VOUCHER_BALANCE_MISMATCH'; end if;
  if exists(select number_fingerprint from voucher.credential group by number_fingerprint having count(*)>1)
    or exists(select secret_fingerprint from voucher.credential group by secret_fingerprint having count(*)>1)
    then raise exception 'IDEAL_VOUCHER_FINGERPRINT_DUPLICATE'; end if;
  if exists(select 1 from voucher.credential where number_ciphertext='' or secret_ciphertext='' or key_version='')
    then raise exception 'IDEAL_VOUCHER_SECRET_PROBE_FAILED'; end if;
  if exists(select 1 from voucher.holder holder left join voucher.voucher target on target.id=holder.voucher_id where target.id is null)
    or exists(select 1 from voucher.timeline event left join voucher.voucher target on target.id=event.voucher_id where target.id is null)
    or exists(select 1 from voucher.redemption redemption left join voucher.voucher target on target.id=redemption.voucher_id where target.id is null)
    then raise exception 'IDEAL_VOUCHER_ORPHAN_FOUND'; end if;
  if exists(select refund.redemption_id from voucher.refund refund group by refund.redemption_id
    having sum(refund.amount_minor)>(select redemption.amount_minor from voucher.redemption redemption where redemption.id=refund.redemption_id))
    then raise exception 'IDEAL_VOUCHER_REFUND_EXCEEDS_REDEMPTION'; end if;
end
$assert$;

select runtime.record_migration_evidence('20260904052000',
  (select count(*) from voucher.legacyvoucher),(select count(*) from voucher.voucher),
  (select coalesce(sum(remaining_minor),0) from voucher.legacyvoucher),(select coalesce(sum(remaining_minor),0) from voucher.voucher),
  'select state,count(*),sum(remaining_minor) from voucher.voucher group by state order by state;',
  'select source_table,count(*),min(source_hash),max(source_hash) from voucher.migrationsource group by source_table order by source_table;');
insert into runtime.schemaversion(version,checksum)
values('20260904052000',encode(public.digest('20260904052000_assert_voucher_model','sha256'),'hex'));

commit;
