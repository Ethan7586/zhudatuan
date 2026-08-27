begin;

alter table channel.externalobject add column scope_id text;
update channel.externalobject mapping set scope_id=listing.scope_id from catalog.sourcelisting listing
  where listing.provider=mapping.provider and listing.object_type=mapping.objecttype and listing.external_id=mapping.externalid;
do $assert$ begin
  if exists(select 1 from channel.externalobject where scope_id is null) then
    raise exception 'EXTERNAL_MAPPING_SCOPE_BACKFILL_REQUIRED';
  end if;
end $assert$;
alter table channel.externalobject alter column scope_id set not null;

alter table channel.externalobject drop constraint externalobject_provider_objecttype_externalid_key;
alter table channel.externalobject add constraint channel_externalobject_scope_key unique(provider,scope_id,objecttype,externalid);
alter table channel.sourcerecord drop constraint sourcerecord_provider_objecttype_externalid_sourceversion_key;
alter table channel.sourcerecord add constraint channel_sourcerecord_scope_key unique(provider,scope_id,objecttype,externalid,sourceversion);
alter table catalog.sourcelisting drop constraint sourcelisting_provider_object_type_external_id_key;
alter table catalog.sourcelisting add constraint catalog_sourcelisting_scope_key unique(provider,scope_id,object_type,external_id);

drop policy appscope on channel.externalobject;
create policy appscope on channel.externalobject for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create index channel_externalobject_internal on channel.externalobject(scope_id,internaltype,internalid);

insert into runtime.schemaversion(version,checksum) values('20260821045000','c6f3c51cd4bd498d1abdd43478144561860b798317b9026bc44f6a60258dc553');

do $assert$ begin
  if (select count(*) from runtime.operation)<>189 then raise exception 'OPERATION_REGISTRY_COUNT_MISMATCH'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821045000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
