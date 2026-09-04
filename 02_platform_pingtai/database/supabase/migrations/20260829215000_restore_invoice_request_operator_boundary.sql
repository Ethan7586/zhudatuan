begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:invoice-request-operator-boundary:v1'));

do $boundary_guard$
declare current_checksum text;
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'INVOICE_REQUEST_OPERATOR_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829214000'
      and checksum='98d43cc45c7c4ca510e3f917191fd751672c4846279d48bc37bbd9688a090fb4') then
    raise exception 'INVOICE_REQUEST_OPERATOR_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829214000') then
    raise exception 'INVOICE_REQUEST_OPERATOR_FUTURE_HEAD_INVALID';
  end if;

  select checksum into current_checksum from runtime.schemaversion where version='20260821032000';
  if current_checksum is distinct from '7be24c44ea3397d9d1429dda127479bf84efbc5d9b94cc41322db148e4b83f66' then
    raise exception 'INVOICE_REQUEST_OPERATOR_CONTRACT_PREDECESSOR_INVALID:%',coalesce(current_checksum,'missing');
  end if;
end
$boundary_guard$;

-- Invoice requests consume organizational settlements and settlement lines.
-- Restore the original Operator audience that was accidentally included in the
-- broad member-audience alignment migration.
update capability.operation
set audience='operator'
where operation_id='invoice.requests.create' and audience='member';

do $rewrite_invoice_create_scope$
declare
  definition text;
  rewritten text;
  old_list text:=$old$      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read',
      'invoice.requests.create',
$old$;
  operator_list text:=$operator$      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read',
$operator$;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  if position(old_list in definition)>0 then
    rewritten:=replace(definition,old_list,operator_list);
    if position(old_list in rewritten)>0 or position(operator_list in rewritten)=0 then
      raise exception 'INVOICE_REQUEST_CREATE_SCOPE_REWRITE_FAILED';
    end if;
    execute rewritten;
  elsif position(operator_list in definition)=0 then
    raise exception 'INVOICE_REQUEST_CREATE_SCOPE_REWRITE_FAILED';
  end if;
end
$rewrite_invoice_create_scope$;

update runtime.schemaversion
set checksum='3d361b63c55c8500daf4a35aaa208f13a2739e485d772cd83d4129d09fe2c144'
where version='20260821032000'
  and checksum='7be24c44ea3397d9d1429dda127479bf84efbc5d9b94cc41322db148e4b83f66';

insert into runtime.schemaversion(version,checksum)
values('20260829215000','f47932300e00238c3aa4a2ef25b237d5a409aa72ece9e960297b8e5b33176a42');

do $assert$
declare
  membership_id text;
  organization_id text;
begin
  if not exists(select 1 from capability.operation
    where operation_id='invoice.requests.create'
      and permission_code='invoice.request.create' and audience='operator') then
    raise exception 'INVOICE_REQUEST_CREATE_AUDIENCE_INVALID';
  end if;

  select membership.id,membership.organization_id into membership_id,organization_id
  from access.membership membership where membership.status='active'
  order by (membership.client='operator') desc,membership.id limit 1;
  if membership_id is not null
    and access.resource_scope('invoice.requests.create',null,membership_id) is distinct from organization_id then
    raise exception 'INVOICE_REQUEST_CREATE_SCOPE_INVALID';
  end if;

  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000'
      and checksum='3d361b63c55c8500daf4a35aaa208f13a2739e485d772cd83d4129d09fe2c144') then
    raise exception 'INVOICE_REQUEST_OPERATOR_CONTRACT_CHECKSUM_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829215000'
      and checksum='f47932300e00238c3aa4a2ef25b237d5a409aa72ece9e960297b8e5b33176a42') then
    raise exception 'INVOICE_REQUEST_OPERATOR_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
