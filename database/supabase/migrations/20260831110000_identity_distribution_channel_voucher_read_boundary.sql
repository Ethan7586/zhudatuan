begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-distribution-channel-voucher-read-boundary:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_DISTRIBUTION_READ_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831100000'
      and checksum='c8e4d4025f5ccd56065db538fb5a64623a1b487e327c3831fa1fc2267b142ff0') then
    raise exception 'IDENTITY_DISTRIBUTION_READ_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260831100000') then
    raise exception 'IDENTITY_DISTRIBUTION_READ_FUTURE_HEAD_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or array_position(array[
      to_regclass('referral.setting'),to_regclass('referral.product'),to_regclass('catalog.listing'),
      to_regclass('catalog.sku'),to_regclass('catalog.product'),to_regclass('referral.member'),
      to_regclass('member.profile'),to_regclass('referral.binding'),to_regclass('referral.commission'),
      to_regclass('referral.withdrawalclaim'),to_regclass('referral.recoverymovement'),
      to_regclass('channel.connection'),to_regclass('channel.syncrun'),to_regclass('channel.provideroperation'),
      to_regclass('extension.installation'),to_regclass('extension.health'),to_regclass('voucher.cardpool'),
      to_regclass('voucher.importjob'),to_regclass('voucher.allocation'),to_regclass('voucher.importerror'),
      to_regclass('voucher.program'),to_regclass('voucher.programversion'),to_regclass('voucher.reserverequest'),
      to_regclass('voucher.approval'),to_regclass('voucher.issuebatch')
    ],null) is not null then
    raise exception 'IDENTITY_DISTRIBUTION_READ_RELATION_MISSING';
  end if;
end
$precondition$;

grant usage on schema referral,catalog,member,channel,extension,voucher to zhudatuanidentityapi;
grant select on table
  referral.setting,referral.product,catalog.listing,catalog.sku,catalog.product,referral.member,member.profile,
  referral.binding,referral.commission,referral.withdrawalclaim,referral.recoverymovement,
  channel.connection,channel.syncrun,channel.provideroperation,extension.installation,extension.health,
  voucher.cardpool,voucher.importjob,voucher.allocation,voucher.importerror,voucher.program,voucher.programversion,
  voucher.reserverequest,voucher.approval,voucher.issuebatch
to zhudatuanidentityapi;

revoke insert,update,delete,truncate,references,trigger on table
  referral.setting,referral.product,catalog.listing,catalog.sku,catalog.product,referral.member,member.profile,
  referral.binding,referral.commission,referral.withdrawalclaim,referral.recoverymovement,
  channel.connection,channel.syncrun,channel.provideroperation,extension.installation,extension.health,
  voucher.cardpool,voucher.importjob,voucher.allocation,voucher.importerror,voucher.program,voucher.programversion,
  voucher.reserverequest,voucher.approval,voucher.issuebatch
from zhudatuanidentityapi;

do $policies$
declare relation_name text;
begin
  foreach relation_name in array array[
    'referral.setting','referral.product','catalog.listing','catalog.sku','catalog.product','referral.member',
    'referral.binding','referral.commission','referral.withdrawalclaim','referral.recoverymovement',
    'channel.connection','channel.syncrun','channel.provideroperation','extension.installation','extension.health',
    'voucher.cardpool','voucher.importjob','voucher.allocation','voucher.importerror','voucher.program',
    'voucher.programversion','voucher.reserverequest','voucher.approval','voucher.issuebatch'
  ] loop
    execute format('create policy identityapiread on %I.%I for select to zhudatuanidentityapi using (true)',
      split_part(relation_name,'.',1),split_part(relation_name,'.',2));
  end loop;
end
$policies$;

insert into runtime.schemaversion(version,checksum)
values('20260831110000','3db3f787f77ba8e416d9056d611c40d76a1d46a65da5ae0767ee63e085ac7841');

do $assert$
declare schema_name text;
declare relation_name text;
begin
  foreach schema_name in array array['referral','catalog','member','channel','extension','voucher'] loop
    if not has_schema_privilege('zhudatuanidentityapi',schema_name,'USAGE') then
      raise exception 'IDENTITY_DISTRIBUTION_READ_SCHEMA_USAGE_INVALID:%',schema_name;
    end if;
  end loop;
  foreach relation_name in array array[
    'referral.setting','referral.product','catalog.listing','catalog.sku','catalog.product','referral.member','member.profile',
    'referral.binding','referral.commission','referral.withdrawalclaim','referral.recoverymovement',
    'channel.connection','channel.syncrun','channel.provideroperation','extension.installation','extension.health',
    'voucher.cardpool','voucher.importjob','voucher.allocation','voucher.importerror','voucher.program','voucher.programversion',
    'voucher.reserverequest','voucher.approval','voucher.issuebatch'
  ] loop
    if not has_table_privilege('zhudatuanidentityapi',relation_name,'SELECT')
      or has_table_privilege('zhudatuanidentityapi',relation_name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'IDENTITY_DISTRIBUTION_READ_TABLE_ACL_INVALID:%',relation_name;
    end if;
  end loop;
  if (select count(*) from pg_policies where policyname='identityapiread' and cmd='SELECT'
      and 'zhudatuanidentityapi'=any(roles::text[]))<>24 then
    raise exception 'IDENTITY_DISTRIBUTION_READ_POLICY_INVALID';
  end if;
end
$assert$;

commit;
