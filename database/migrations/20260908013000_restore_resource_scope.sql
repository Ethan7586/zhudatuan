begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260908012000') then
    raise exception 'RESOURCE_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260908013000') then
    raise exception 'RESOURCE_SCOPE_ALREADY_APPLIED';
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
    'begin
  if p_operation=''organization.stores.manage'' then',
    'begin
  if p_operation like ''access.ownership.transfers.%'' and p_resource like ''ownershiptransfer:%'' then
    select scope_id into resolved from access.ownershiptransfer where id=p_resource;
  elsif p_operation=''organization.stores.manage'' then'
  );
  if patched=source then raise exception 'OWNERSHIP_TRANSFER_SCOPE_INSERTION_MISSING'; end if;
  source=patched;

  patched=replace(
    source,
    'elsif p_operation=''identity.invitations.create'' then',
    'elsif p_operation in(''identity.invitations.create'',''identity.invitations.read'') then'
  );
  if patched=source then raise exception 'INVITATION_READ_SCOPE_INSERTION_MISSING'; end if;
  source=patched;

  patched=replace(
    source,
    '''order.orders.create'',''order.aftersales.apply'',''benefit.accounts.read''',
    '''order.orders.create'',''order.aftersales.apply'',''payment.intents.create'',''benefit.accounts.read'''
  );
  if patched=source then raise exception 'PAYMENT_INTENT_SCOPE_INSERTION_MISSING'; end if;
  source=patched;

  patched=replace(
    source,
    'if resolved is null then select scope_id into resolved from catalog.listing where id=p_resource; end if;',
    'if resolved is null then select scope_id into resolved from catalog.listing where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.product where id=p_resource; end if;'
  );
  if patched=source then raise exception 'CATALOG_PRODUCT_SCOPE_INSERTION_MISSING'; end if;
  source=patched;

  patched=replace(
    source,
    'if resolved is null then select scope_id into resolved from experience.application where id=p_resource; end if;',
    'if resolved is null then select mall_id into resolved from experience.application where id=p_resource; end if;
    if resolved is null then select application.mall_id into resolved from experience.version versionrecord join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource; end if;'
  );
  if patched=source then raise exception 'EXPERIENCE_SCOPE_REPAIR_MISSING'; end if;
  execute patched;
end
$scope$;

revoke all on function access.resource_scope(text,text,text) from public;
grant execute on function access.resource_scope(text,text,text) to shopapp;

select runtime.record_migration_evidence(
  '20260908013000',
  (select count(*) from access.membership where status='active' and client='operator')+
    (select count(*) from catalog.product)+(select count(*) from experience.application)+(select count(*) from experience.version),
  (select count(*) from access.membership where status='active' and client='operator'
    and access.resource_scope('identity.invitations.read',null,id)=organization_id)+
    (select count(*) from catalog.product where access.resource_scope('catalog.products.read',id,null)=scope_id)+
    (select count(*) from experience.application where access.resource_scope('experience.applications.detail.read',id,null)=mall_id)+
    (select count(*) from experience.version versionrecord join experience.application application on application.id=versionrecord.application_id
      where access.resource_scope('experience.versions.validate',versionrecord.id,null)=application.mall_id),
  0,0,
  'select id,organization_id,access.resource_scope(''identity.invitations.read'',null,id) resolved from access.membership where status=''active'' and client=''operator'' order by id;',
  'select id,mall_id,access.resource_scope(''experience.applications.detail.read'',id,null) resolved from experience.application order by id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260908013000',encode(public.digest('20260908013000_restore_resource_scope','sha256'),'hex'));
update runtime.schemahead set migration_head='20260908013000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:access',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if exists(select 1 from access.membership where status='active' and client='operator'
    and access.resource_scope('identity.invitations.read',null,id) is distinct from organization_id) then
    raise exception 'INVITATION_READ_SCOPE_INVALID';
  end if;
  if exists(select 1 from access.ownershiptransfer
    where access.resource_scope('access.ownership.transfers.accept',id,null) is distinct from scope_id) then
    raise exception 'OWNERSHIP_TRANSFER_SCOPE_INVALID';
  end if;
  if exists(select 1 from catalog.product
    where access.resource_scope('catalog.products.read',id,null) is distinct from scope_id) then
    raise exception 'CATALOG_PRODUCT_SCOPE_INVALID';
  end if;
  if exists(select 1 from experience.application
    where access.resource_scope('experience.applications.detail.read',id,null) is distinct from mall_id) then
    raise exception 'EXPERIENCE_APPLICATION_SCOPE_INVALID';
  end if;
  if exists(select 1 from experience.version versionrecord join experience.application application on application.id=versionrecord.application_id
    where access.resource_scope('experience.versions.validate',versionrecord.id,null) is distinct from application.mall_id) then
    raise exception 'EXPERIENCE_VERSION_SCOPE_INVALID';
  end if;
  if pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) not like '%identity.invitations.create%identity.invitations.read%'
      or pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) not like '%access.ownership.transfers.%'
      or pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) not like '%catalog.product where id=p_resource%'
      or pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) not like '%application.mall_id%experience.version%' then
    raise exception 'RESOURCE_SCOPE_BRANCH_MISSING';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260908013000'
    and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'RESOURCE_SCOPE_HEAD_INVALID';
  end if;
end
$assert$;

commit;
