begin;

alter table experience.application drop constraint experience_application_public_slug_format;
alter table experience.application add constraint experience_application_public_slug_format
  check(public_slug~'^[a-z0-9][a-z0-9-]{2,47}$' or public_slug~'^h[0-9]+$');

insert into capability.entitlement as entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version
) values(
  'hbbtzn-l1:provisioning.malls.create',
  'mall:d1708f04df2dd8a61736852c4900fb43',
  'provisioning.malls.create',
  'enabled',null,'1970-01-01T00:00:00Z',null,0
)
on conflict(scope_id,capability_id,effective_at) do update
set state='enabled',expires_at=null,version=entitlement.version+1;

insert into runtime.schemaversion(version,checksum)
values('20260913022500','f9aa7b213fe52325459dfa0c5b5b14d119a0293da71ade7f417cc838f8687a6b');

commit;
