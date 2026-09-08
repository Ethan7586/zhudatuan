begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909010000') then
    raise exception 'INVOICE_CONSOLE_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909011000') then
    raise exception 'INVOICE_CONSOLE_SCOPE_ALREADY_APPLIED';
  end if;
end
$precondition$;

do $scope$
declare
  source text;
  patched text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into source;
  patched=replace(
    source,
    '''order.orders.create'',''order.aftersales.apply'',''payment.intents.create'',''benefit.accounts.read'',''invoice.profiles.manage'',
      ''invoice.requests.create'',''invoice.requests.read'',''invoice.requests.cancel'',
      ''notification.notifications.read''',
    '''order.orders.create'',''order.aftersales.apply'',''payment.intents.create'',''benefit.accounts.read'',
      ''notification.notifications.read'''
  );
  if patched=source then raise exception 'INVOICE_CONSOLE_SCOPE_RULE_NOT_FOUND'; end if;
  execute patched;
end
$scope$;

revoke all on function access.resource_scope(text,text,text) from public;
grant execute on function access.resource_scope(text,text,text) to shopapp;

select runtime.record_migration_evidence(
  '20260909011000',
  (select count(*) from access.membership where status='active' and client='operator'),
  (select count(*) from access.membership membership where membership.status='active' and membership.client='operator'
    and access.resource_scope('invoice.requests.read',membership.organization_id,membership.id)=membership.organization_id),
  0,0,
  'select id,organization_id,access.resource_scope(''invoice.requests.read'',organization_id,id) resolved from access.membership where status=''active'' and client=''operator'' order by id;',
  'select pg_get_functiondef(''access.resource_scope(text,text,text)''::regprocedure);'
);

insert into runtime.schemaversion(version,checksum)
values('20260909011000',encode(public.digest('20260909011000_resolve_invoice_console_scope','sha256'),'hex'));
update runtime.schemahead set migration_head='20260909011000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:access',published_at=clock_timestamp() where artifact='commerce';

do $assert$
declare definition text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  if definition like '%''invoice.profiles.manage''%'
    or definition like '%''invoice.requests.create''%'
    or definition like '%''invoice.requests.read''%'
    or definition like '%''invoice.requests.cancel''%' then
    raise exception 'INVOICE_SCOPE_DUPLICATE_RULE_REMAINS';
  end if;
  if exists(
    select 1 from access.membership membership
    where membership.status='active' and membership.client='operator'
      and access.resource_scope('invoice.requests.read',membership.organization_id,membership.id) is distinct from membership.organization_id
  ) then
    raise exception 'INVOICE_CONSOLE_READ_SCOPE_INVALID';
  end if;
  if not has_function_privilege('shopapp','access.resource_scope(text,text,text)','EXECUTE') then
    raise exception 'INVOICE_SCOPE_PRIVILEGE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909011000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'INVOICE_CONSOLE_SCOPE_HEAD_INVALID';
  end if;
end
$assert$;

commit;
