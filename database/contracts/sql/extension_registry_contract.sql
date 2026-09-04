begin;
insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
values('contractprovider','1.0.0','channel','contractprovider.v1','{"id":"contractprovider","name":"合同渠道","kind":"channel","version":"1.0.0","apiVersion":"2026-08-21","contractVersion":"contractprovider.v1","dependencies":[],"healthOperation":"health","capabilities":["Catalog"],"permissions":["channel.contractprovider.operate"],"configSchema":"provider.contractprovider.v1","eventSubscriptions":[],"secretRefs":["credential"],"sandbox":{"supported":true,"mode":"endpoint","endpointRef":"provider.contractprovider.sandboxurl"},"rateLimits":{"requestsPerSecond":1,"maxConcurrency":1},"timeout":{"connectionMs":1,"responseMs":1,"totalMs":1},"retryPolicy":{"maxAttempts":1},"circuitPolicy":{"failureThreshold":1,"recoveryMs":100},"webhookContract":null,"signature":"QUJDREVGR0g="}',
  repeat('a',64),'QUJDREVGR0g=',clock_timestamp());
insert into extension.installation(id,extension_id,extension_version,scope_id,status,manifest,base_url,endpoints,secret_ref,health_operation,version,installed_at)
select 'contract:installation','contractprovider','1.0.0','contract:scope','disabled',manifest,'https://contract.invalid','{"health":"/health"}','secret/contract','health',0,clock_timestamp()
from extension.manifest where id='contractprovider' and version='1.0.0';
do $guard$ begin
  begin
    update extension.installation set endpoints='{"token":"/secret"}',configuration_version=1,version=1 where id='contract:installation';
    raise exception 'EXTENSION_PLAINTEXT_CONFIGURATION_ACCEPTED';
  exception when others then
    if sqlerrm not like '%EXTENSION_ENDPOINT_CONFIGURATION_INVALID%' then raise; end if;
  end;
  begin
    update extension.installation set endpoints='{"health":"/v2/health"}',configuration_version=0,version=1 where id='contract:installation';
    raise exception 'EXTENSION_CONFIGURATION_WITHOUT_CAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%EXTENSION_CONFIGURATION_VERSION_INVALID%' then raise; end if;
  end;
end $guard$;
update extension.installation set endpoints='{"health":"/v2/health"}',configuration_version=1,version=1 where id='contract:installation';
update extension.installation set status='testing',version=2 where id='contract:installation';
update extension.installation set status='enabled',version=3 where id='contract:installation';
do $contract$ begin
  if not exists(select 1 from extension.registry where extension_id='contractprovider' and scope_id='contract:scope'
    and installation_id='contract:installation' and state='enabled' and installation_version=3 and generation=1) then
    raise exception 'EXTENSION_REGISTRY_ACTIVATION_INVALID';
  end if;
end $contract$;
rollback;
