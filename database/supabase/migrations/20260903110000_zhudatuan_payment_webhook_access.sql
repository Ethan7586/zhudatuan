begin;

do $role$
begin
  if to_regrole('zhudatuanpaymentwebhookapi') is null then
    if not coalesce((select rolsuper or rolcreaterole from pg_roles where rolname=current_user),false) then
      raise exception 'ZHUDATUAN_DATABASE_ROLE_PREPROVISION_REQUIRED:zhudatuanpaymentwebhookapi';
    end if;
    create role zhudatuanpaymentwebhookapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanpaymentwebhookapi'
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanpaymentwebhookapi')
        or membership.member=to_regrole('zhudatuanpaymentwebhookapi')) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_UNSAFE';
  end if;
end
$role$;

grant usage on schema runtime,payment,audit to zhudatuanpaymentwebhookapi;
grant select on runtime.schemaversion to zhudatuanpaymentwebhookapi;
grant insert on runtime.job to zhudatuanpaymentwebhookapi;
grant select on payment.intent,payment.intenttender,payment.attempt,payment.payment,payment.refund,payment.refundtender
  to zhudatuanpaymentwebhookapi;
grant select,insert on audit.record to zhudatuanpaymentwebhookapi;
grant select on audit.accessrecord,audit.archiveref to zhudatuanpaymentwebhookapi;
grant execute on function payment.webhook_scope(text,text,text),
  runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)
  to zhudatuanpaymentwebhookapi;

drop policy if exists zhudatuanpaymentwebhookapi on runtime.schemaversion;
create policy zhudatuanpaymentwebhookapi on runtime.schemaversion for select to zhudatuanpaymentwebhookapi
  using(version in('20260821032000','20260903110000'));

drop policy if exists zhudatuanpaymentwebhookapiinsert on runtime.job;
create policy zhudatuanpaymentwebhookapiinsert on runtime.job for insert to zhudatuanpaymentwebhookapi
  with check(id like 'job:webhook:%' and kind in('paymentquery','paymentrefund') and owner='payment'
    and scope_id=nullif(current_setting('app.scope_id',true),'') and state='queued' and priority=1);

drop policy if exists zhudatuanpaymentwebhookapiselect on payment.intent;
create policy zhudatuanpaymentwebhookapiselect on payment.intent for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiselect on payment.intenttender;
create policy zhudatuanpaymentwebhookapiselect on payment.intenttender for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiselect on payment.attempt;
create policy zhudatuanpaymentwebhookapiselect on payment.attempt for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiselect on payment.payment;
create policy zhudatuanpaymentwebhookapiselect on payment.payment for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiselect on payment.refund;
create policy zhudatuanpaymentwebhookapiselect on payment.refund for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiselect on payment.refundtender;
create policy zhudatuanpaymentwebhookapiselect on payment.refundtender for select to zhudatuanpaymentwebhookapi
  using(mall_id=nullif(current_setting('app.scope_id',true),''));

drop policy if exists zhudatuanpaymentwebhookapiselect on audit.record;
create policy zhudatuanpaymentwebhookapiselect on audit.record for select to zhudatuanpaymentwebhookapi
  using(scope_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapiinsert on audit.record;
create policy zhudatuanpaymentwebhookapiinsert on audit.record for insert to zhudatuanpaymentwebhookapi
  with check(scope_id=nullif(current_setting('app.scope_id',true),'') and actor_id='provider:wechat'
    and action='payment.webhooks.wechat' and resource_type='payment');
drop policy if exists zhudatuanpaymentwebhookapi on audit.accessrecord;
create policy zhudatuanpaymentwebhookapi on audit.accessrecord for select to zhudatuanpaymentwebhookapi
  using(scope_id=nullif(current_setting('app.scope_id',true),''));
drop policy if exists zhudatuanpaymentwebhookapi on audit.archiveref;
create policy zhudatuanpaymentwebhookapi on audit.archiveref for select to zhudatuanpaymentwebhookapi
  using(scope_id=nullif(current_setting('app.scope_id',true),''));

insert into runtime.schemaversion(version,checksum)
values('20260903110000','6e08b67bcf8d7c496c7675ff38cb301da6ed0677fa30ecca4adeb80f5d6de889');

do $assert$
begin
  if not exists(select 1 from pg_roles where rolname='zhudatuanpaymentwebhookapi'
      and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit
      and not rolreplication and not rolbypassrls)
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanpaymentwebhookapi')
        or membership.member=to_regrole('zhudatuanpaymentwebhookapi')) then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_ROLE_INVALID';
  end if;
  if not has_table_privilege('zhudatuanpaymentwebhookapi','runtime.schemaversion','SELECT')
    or not has_table_privilege('zhudatuanpaymentwebhookapi','runtime.job','INSERT')
    or has_table_privilege('zhudatuanpaymentwebhookapi','runtime.job','SELECT,UPDATE,DELETE')
    or not has_table_privilege('zhudatuanpaymentwebhookapi','audit.record','SELECT,INSERT')
    or has_table_privilege('zhudatuanpaymentwebhookapi','audit.record','UPDATE,DELETE')
    or not has_table_privilege('zhudatuanpaymentwebhookapi','payment.intent','SELECT')
    or not has_table_privilege('zhudatuanpaymentwebhookapi','payment.refund','SELECT')
    or has_table_privilege('zhudatuanpaymentwebhookapi','payment.intent','INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanpaymentwebhookapi','payment.refund','INSERT,UPDATE,DELETE') then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_TABLE_PRIVILEGES_INVALID';
  end if;
  if not has_function_privilege('zhudatuanpaymentwebhookapi','payment.webhook_scope(text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpaymentwebhookapi',
      'runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)','EXECUTE') then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_FUNCTION_PRIVILEGES_INVALID';
  end if;
  if has_schema_privilege('zhudatuanpaymentwebhookapi','identity','USAGE')
    or has_schema_privilege('zhudatuanpaymentwebhookapi','access','USAGE')
    or has_schema_privilege('zhudatuanpaymentwebhookapi','ordering','USAGE')
    or has_schema_privilege('zhudatuanpaymentwebhookapi','finance','USAGE')
    or has_table_privilege('zhudatuanpaymentwebhookapi','runtime.rawenvelope','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanpaymentwebhookapi','runtime.outbox','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_FORBIDDEN_PRIVILEGES_PRESENT';
  end if;
  if (select count(*) from pg_policy policy
      join pg_class relation on relation.oid=policy.polrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname like 'zhudatuanpaymentwebhookapi%')<>12 then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_POLICY_INCOMPLETE';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260903110000' and checksum='6e08b67bcf8d7c496c7675ff38cb301da6ed0677fa30ecca4adeb80f5d6de889') then
    raise exception 'ZHUDATUAN_PAYMENT_WEBHOOK_SCHEMA_MARKER_MISSING';
  end if;
end
$assert$;

commit;
