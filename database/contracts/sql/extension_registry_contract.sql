begin;
insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
values('contractprovider','1.0.0','channel','2.0.0','{"id":"contractprovider","version":"1.0.0","contractVersion":"2.0.0","signature":"QUJDREVGR0g=","healthOperation":"health"}',
  repeat('a',64),'QUJDREVGR0g=',clock_timestamp());
insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,version,installed_at)
values('contract:installation','contractprovider','1.0.0','contract:scope','disabled','{}','https://contract.invalid','{}','secret/contract','health',0,clock_timestamp());
update extension.installation set status='testing',version=1 where id='contract:installation';
update extension.installation set status='enabled',version=2 where id='contract:installation';
do $contract$ begin
  if not exists(select 1 from extension.registry where extension_id='contractprovider' and scope_id='contract:scope'
    and installation_id='contract:installation' and state='enabled' and generation=1) then
    raise exception 'EXTENSION_REGISTRY_ACTIVATION_INVALID';
  end if;
end $contract$;
rollback;
