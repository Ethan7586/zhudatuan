begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830150000') then raise exception 'CHECKOUT_CONTEXT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830151000') then raise exception 'CHECKOUT_CONTEXT_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('checkout.context.read','checkout','GET','/api/v1/checkouts/context','3.0.0');
insert into capability.capability(id,kind,name,version,status)
values('checkout.context.read','operation','checkout.context.read',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('checkout.context.read','checkout.context.read','checkout.create','storefront');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:checkout.context.read','organization-platform-root','checkout.context.read','enabled',null,'1970-01-01T00:00:00Z',null,0);
insert into access.rolepermission(role_id,permission_id,effect)
select 'role:self',permission.id,'allow' from access.permission permission where permission.code='checkout.create' on conflict do nothing;

update runtime.contractcatalog set checksum=encode(public.digest('commerce:3.0.0:checkoutcontext','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';
insert into runtime.schemaversion(version,checksum)
values('20260830151000',encode(public.digest('20260830151000_publish_checkout_context','sha256'),'hex'));

commit;
