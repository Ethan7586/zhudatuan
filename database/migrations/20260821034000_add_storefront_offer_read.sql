begin;

insert into runtime.operation(id,owner,method,path,contract_version)
values('pricing.offers.read','pricing','GET','/api/v1/pricing/offers','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into access.permission(id,code,risk,status)
values('permission:pricingofferread','pricing.offer.read','low','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

insert into capability.capability(id,kind,name,version,status)
values('pricing.offers.read','operation','pricing.offers.read',1,'active')
on conflict(id) do update set status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('pricing.offers.read','pricing.offers.read','pricing.offer.read','operator')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:pricing.offers.read','organization-platform-root','pricing.offers.read','enabled',null,'1970-01-01T00:00:00Z',null,0)
on conflict(scope_id,capability_id,effective_at) do update set state='enabled',expires_at=null,version=capability.entitlement.version+1;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission
where permission.code in('catalog.listing.read','pricing.offer.read','inventory.read')
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821034000','9bca72ee2f6a6a734286c073e7671229d9867b13f061a34dcd22f4a8f0a4e334');

do $assert$
begin
  if (select count(*) from runtime.operation)<>154 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from capability.operation where operation_id='pricing.offers.read' and permission_code='pricing.offer.read') then
    raise exception 'STOREFRONT_OFFER_CAPABILITY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821034000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
