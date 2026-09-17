begin;

-- The existing custom-profile operations run in identity-api, not shopapp.
-- Give that role the same mall-scoped access already used by shopapp.
grant usage on schema member to zhudatuanidentityapi;
grant select,insert,update,delete on
  member.storefrontcustomtag,
  member.storefrontcustomfield,
  member.storefrontmembertag,
  member.storefrontmemberfieldvalue
to zhudatuanidentityapi;

do $policies$
declare relation_name text;
begin
  foreach relation_name in array array[
    'storefrontcustomtag','storefrontcustomfield',
    'storefrontmembertag','storefrontmemberfieldvalue'
  ] loop
    execute format(
      'create policy identityapimall on member.%I for all to zhudatuanidentityapi
       using (organization_id=nullif(current_setting(''app.scope_id'',true),''''))
       with check (organization_id=nullif(current_setting(''app.scope_id'',true),''''))',
      relation_name
    );
  end loop;
end
$policies$;

insert into runtime.schemaversion(version,checksum)
values('20260917110000',encode(public.digest('storefront-custom-profile-identity-api-acl:v1','sha256'),'hex'));

commit;
