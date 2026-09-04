begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028700') then raise exception 'VOUCHER_TERMS_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028800') then raise exception 'VOUCHER_TERMS_ALREADY_APPLIED'; end if;
  -- Historical approved terms cannot be reconstructed from a mutable product.
  -- Require verified issuance/approval evidence; never silently backfill today's price.
  if exists(select 1 from voucher.issueorder where state not in('draft','cancelled')) or exists(select 1 from voucher.issuebatch) then
    raise exception 'VOUCHER_ISSUE_TERMS_EVIDENCE_REQUIRED';
  end if;
end $precondition$;

alter table voucher.issueorder add constraint voucher_issue_identity unique(id,scope_id,product_id);
create table voucher.issueterms(
  order_id text primary key,
  scope_id text not null,
  product_id text not null,
  product_version bigint not null check(product_version>0),
  pool_id text not null references voucher.credentialpool(id),
  face_minor bigint not null check(face_minor>0),
  currency char(3) not null check(currency='CNY'),
  qualification_id text not null,
  activation text not null check(activation in('automatic','secret','numbersecret')),
  starts_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>starts_at),
  foreign key(order_id,scope_id,product_id) references voucher.issueorder(id,scope_id,product_id),
  foreign key(product_id,product_version) references voucher.productversion(product_id,version),
  foreign key(product_id,scope_id) references voucher.product(id,scope_id)
);
create function voucher.guard_issue_terms() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if not exists(select 1 from voucher.issueorder issue
    join voucher.product product on product.id=issue.product_id and product.scope_id=issue.scope_id
    join voucher.stockrequest stock on stock.id=issue.stock_request_id and stock.scope_id=issue.scope_id
    join voucher.credentialpool pool on pool.id=stock.pool_id and pool.scope_id=stock.scope_id
    where issue.id=new.order_id and issue.scope_id=new.scope_id and issue.state='draft'
      and product.id=new.product_id and product.version=new.product_version and product.state='enabled'
      and product.customer_id=issue.customer_id and stock.customer_id=issue.customer_id and stock.product_id=product.id and stock.state='approved'
      and pool.id=new.pool_id and pool.id=product.pool_id and pool.product_id=product.id and pool.state='open'
      and product.face_minor=new.face_minor and product.currency=new.currency and product.qualification_id=new.qualification_id
      and product.activation=new.activation and product.starts_at=new.starts_at and product.expires_at=new.expires_at
      and issue.starts_at>=new.starts_at and issue.expires_at<=new.expires_at and issue.expires_at>clock_timestamp()) then
    raise exception 'VOUCHER_ISSUE_TERMS_INVALID';
  end if;
  return new;
end
$function$;
create trigger voucherissueterms before insert on voucher.issueterms for each row execute function voucher.guard_issue_terms();
create trigger voucherissuetermsimmutable before update or delete on voucher.issueterms for each row execute function voucher.guard_snapshot_item();
create function voucher.require_issue_terms() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.state not in('draft','cancelled') and not exists(select 1 from voucher.issueterms terms where terms.order_id=new.id and terms.scope_id=new.scope_id and terms.product_id=new.product_id) then
    raise exception 'VOUCHER_ISSUE_TERMS_REQUIRED';
  end if;
  return new;
end
$function$;
create trigger voucherissuetermsrequired before insert or update on voucher.issueorder for each row execute function voucher.require_issue_terms();

create function voucher.guard_issue_frozen() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if old.state<>'draft' and row(new.customer_id,new.product_id,new.stock_request_id,new.quantity,new.purpose,new.delivery,new.starts_at,new.expires_at,new.recipient_snapshot,new.reason,new.requested_by)
    is distinct from row(old.customer_id,old.product_id,old.stock_request_id,old.quantity,old.purpose,old.delivery,old.starts_at,old.expires_at,old.recipient_snapshot,old.reason,old.requested_by) then
    raise exception 'VOUCHER_ISSUE_FROZEN';
  end if;
  return new;
end
$function$;
create trigger voucherissuefrozen before update on voucher.issueorder for each row execute function voucher.guard_issue_frozen();

alter table voucher.issueterms enable row level security;
alter table voucher.issueterms force row level security;
create policy voucherapp on voucher.issueterms for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.issueterms for select to shopjob using(true);
revoke all on voucher.issueterms from public;
grant select,insert on voucher.issueterms to shopapp;
grant select on voucher.issueterms to shopjob;

select runtime.record_migration_evidence('20260904028800',0,0,0,0,
  'select product_id,product_version,count(*) from voucher.issueterms group by product_id,product_version;',
  'select issue.id from voucher.issueorder issue left join voucher.issueterms terms on terms.order_id=issue.id and terms.scope_id=issue.scope_id where issue.state not in(''draft'',''cancelled'') and terms.order_id is null;');
insert into runtime.schemaversion(version,checksum)
values('20260904028800',encode(public.digest('20260904028800_prepare_voucher_terms','sha256'),'hex'));

do $assert$ begin
  if to_regclass('voucher.issueterms') is null or has_table_privilege('shopjob','voucher.issueterms','insert')
    or has_table_privilege('shopapp','voucher.issueterms','update') then raise exception 'VOUCHER_ISSUE_TERMS_BOUNDARY_INVALID'; end if;
end $assert$;

commit;
