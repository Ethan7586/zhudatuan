begin;

-- Purchase traffic has a dedicated direct-login role. Credentials remain an
-- infrastructure concern; fresh in-memory replay may create a NOLOGIN stand-in.
do $database_role$
begin
  if not exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi') then
    if not coalesce((select rolcreaterole or rolsuper from pg_roles where rolname=current_user),false) then
      raise exception 'ZHUDATUAN_DATABASE_ROLE_PREPROVISION_REQUIRED:zhudatuanpurchaseapi';
    end if;
    create role zhudatuanpurchaseapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi'
    and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_PURCHASE_ROLE_UNSAFE';
  end if;
end
$database_role$;

-- Every SECURITY DEFINER purchase function revalidates the direct database
-- session and the canonical storefront identity. AAL2 is evaluated from live
-- phone assurance, not merely from the cached session column.
create or replace function access.purchase_session_context(
  p_membership text,p_session text,p_require_aal2 boolean
) returns table(principal_id text,member_id text,mall_id text)
language plpgsql stable security definer
set search_path=identity,access,member,organization,pg_temp
set row_security=off as $function$
declare v_principal text; v_member text; v_mall text; v_assurance smallint;
begin
  if session_user<>'zhudatuanpurchaseapi' then
    raise exception 'PURCHASE_SESSION_INVALID';
  end if;
  select principal.id,profile.id,membership.organization_id,
    case when session.assurance_level>=2 and exists(
      select 1 from identity.assurance evidence where evidence.principal_id=principal.id
        and evidence.method='phone_otp' and evidence.level=2 and evidence.verified_at<=clock_timestamp()
        and evidence.expires_at>clock_timestamp()
    ) then 2::smallint else 1::smallint end
  into v_principal,v_member,v_mall,v_assurance
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id and principal.status='active'
  join access.membership membership on membership.id=session.membership_id
    and membership.client='storefront' and membership.status='active' and membership.access_version=session.access_version
  join member.profile profile on profile.id=membership.member_id and profile.principal_id=principal.id and profile.status='active'
  join organization.organization organization on organization.id=membership.organization_id
    and organization.kind='mall' and organization.status='active'
  where session.id=p_session and session.membership_id=p_membership and session.client='storefront'
    and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version;
  if v_principal is null or v_member is null or v_mall is null or (p_require_aal2 and v_assurance<2) then
    raise exception 'PURCHASE_SESSION_INVALID';
  end if;
  return query select v_principal,v_member,v_mall;
end
$function$;

create or replace function access.purchase_member_scope(p_membership text,p_session text)
returns jsonb language plpgsql stable security definer
set search_path=access,pg_temp set row_security=off as $function$
declare context record; resolved jsonb;
begin
  select * into context from access.purchase_session_context(p_membership,p_session,false);
  resolved:=access.scope_object(context.member_id);
  if resolved is null or resolved->>'kind'<>'owner' then raise exception 'PURCHASE_MEMBER_SCOPE_NOT_FOUND'; end if;
  return resolved;
end
$function$;

create or replace function access.purchase_member_mall_allowed(p_member text,p_mall text)
returns boolean language sql stable security definer
set search_path=access,member,organization,pg_temp as $function$
  select p_member is not null and p_mall is not null and exists(
    select 1 from access.membership membership
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join organization.organization organization on organization.id=membership.organization_id
      and organization.kind='mall' and organization.status='active'
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and profile.principal_id=nullif(current_setting('app.actor_id',true),'')
      and membership.client='storefront' and membership.status='active'
      and membership.member_id=p_member and membership.organization_id=p_mall
  )
$function$;

create or replace function access.purchase_member_allowed(p_member text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and access.purchase_member_mall_allowed(p_member,membership.organization_id))
$function$;

create or replace function access.purchase_mall_allowed(p_mall text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and access.purchase_member_mall_allowed(membership.member_id,p_mall))
$function$;

create or replace function access.purchase_order_allowed(p_order text)
returns boolean language sql stable security definer
set search_path=access,ordering,pg_temp as $function$
  select p_order is not null and exists(select 1 from ordering.orderrecord orders
    where orders.id=p_order and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$function$;

create or replace function access.purchase_checkout_allowed(p_checkout text)
returns boolean language sql stable security definer
set search_path=access,checkout,pg_temp as $function$
  select p_checkout is not null and exists(select 1 from checkout.session session
    where session.id=p_checkout and access.purchase_member_mall_allowed(session.member_id,session.mall_id))
$function$;

create or replace function access.purchase_quote_allowed(p_quote text)
returns boolean language sql stable security definer
set search_path=access,pricing,pg_temp as $function$
  select p_quote is not null and exists(select 1 from pricing.quote quote
    where quote.id=p_quote and access.purchase_member_mall_allowed(quote.member_id,quote.mall_id))
$function$;

create or replace function access.purchase_intent_allowed(p_intent text)
returns boolean language sql stable security definer
set search_path=access,payment,ordering,pg_temp as $function$
  select p_intent is not null and exists(select 1 from payment.intent intent
    join ordering.orderrecord orders on orders.id=intent.order_id
    where intent.id=p_intent and intent.member_id=orders.member_id
      and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$function$;

create or replace function access.purchase_fulfillment_allowed(p_fulfillment text)
returns boolean language sql stable security definer
set search_path=access,fulfillment,ordering,pg_temp as $function$
  select p_fulfillment is not null and exists(select 1 from fulfillment.fulfillmentorder fulfillment
    join ordering.orderrecord orders on orders.id=fulfillment.order_id
    where fulfillment.id=p_fulfillment and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$function$;

create or replace function access.purchase_application_allowed(p_application text)
returns boolean language sql stable security definer
set search_path=access,experience,pg_temp as $function$
  select p_application is not null and exists(select 1 from experience.application application
    where application.id=p_application and application.status='active' and access.purchase_mall_allowed(application.scope_id))
$function$;

create or replace function access.purchase_benefit_account_allowed(p_account text)
returns boolean language sql stable security definer
set search_path=access,benefit,pg_temp as $function$
  select p_account is not null and exists(select 1 from benefit.account account
    where account.id=p_account and account.status='active' and account.currency='CNY'
      and access.purchase_member_mall_allowed(account.member_id,account.scope_id))
$function$;

create or replace function access.purchase_risk_scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,organization,pg_temp as $function$
  select p_scope is not null and exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.client='storefront'
      and membership.status='active' and (p_scope=membership.member_id or exists(
        select 1 from organization.unitclosure closure where closure.descendant_id=membership.organization_id
          and closure.ancestor_id=p_scope
      )))
$function$;

create or replace function access.purchase_audit_scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select p_scope is not null and exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.member_id=p_scope and membership.client='storefront' and membership.status='active')
$function$;

-- Read-only finance projections stay behind session-bound benefit functions;
-- neither web role receives finance schema usage.
create or replace function benefit.web_ledger(p_membership text,p_session text)
returns table(id text,account_id text,kind text,currency text,amount_minor bigint,
  reference_type text,reference_id text,description text,occurred_at timestamptz)
language plpgsql stable security definer
set search_path=identity,access,member,benefit,finance,pg_temp set row_security=off as $function$
declare owned_member text; owned_scope text;
begin
  if session_user<>'zhudatuanwebapi' then raise exception 'WEB_BENEFIT_MEMBERSHIP_INVALID'; end if;
  select membership.member_id,membership.organization_id into owned_member,owned_scope
  from identity.session session
  join access.membership membership on membership.id=session.membership_id and session.client=membership.client
  join member.profile profile on profile.id=membership.member_id and profile.principal_id=session.principal_id
  join identity.principal principal on principal.id=session.principal_id
  where session.id=p_session and session.membership_id=p_membership
    and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version
    and session.access_version=membership.access_version
    and principal.status='active' and profile.status='active' and membership.status='active';
  if owned_member is null or owned_scope is null then raise exception 'WEB_BENEFIT_MEMBERSHIP_INVALID'; end if;
  return query select entry.id,account.id,account.kind,account.currency::text,
    case entry.side when 'credit' then entry.amount_minor else -entry.amount_minor end::bigint,
    journal.reference_type,journal.reference_id,journal.description,journal.posted_at
  from benefit.account account join finance.entry entry on entry.account_id=account.finance_account_id
  join finance.journal journal on journal.id=entry.journal_id and journal.state='posted'
  where account.member_id=owned_member and account.scope_id=owned_scope
  order by journal.posted_at desc,entry.id desc;
end
$function$;

create or replace function benefit.purchase_available(p_membership text,p_session text,p_accounts text[])
returns table(id text,available_minor bigint,version bigint,kind text)
language plpgsql stable security definer
set search_path=identity,access,member,benefit,finance,pg_temp set row_security=off as $function$
declare context record; owned_count integer;
begin
  select * into context from access.purchase_session_context(p_membership,p_session,false);
  if p_accounts is null or cardinality(p_accounts)=0 or cardinality(p_accounts)>16
    or exists(select 1 from unnest(p_accounts) account where account is null or account='')
    or (select count(distinct account) from unnest(p_accounts) account)<>cardinality(p_accounts) then
    raise exception 'PURCHASE_BENEFIT_ACCOUNTS_INVALID';
  end if;
  select count(*)::integer into owned_count from benefit.account account
  where account.id=any(p_accounts) and account.member_id=context.member_id and account.scope_id=context.mall_id
    and account.currency='CNY' and account.status='active';
  if owned_count<>cardinality(p_accounts) then raise exception 'PURCHASE_BENEFIT_ACCOUNT_NOT_USABLE'; end if;
  return query
  with owned as(
    select account.id,account.finance_account_id,account.version,account.kind
    from benefit.account account where account.id=any(p_accounts) and account.member_id=context.member_id
      and account.scope_id=context.mall_id and account.currency='CNY' and account.status='active'
  ), ledger as(
    select owned.id,coalesce(sum(case when entry.side='credit' then entry.amount_minor else -entry.amount_minor end)
      filter(where journal.state='posted'),0)::bigint amount from owned
    left join finance.entry entry on entry.account_id=owned.finance_account_id
    left join finance.journal journal on journal.id=entry.journal_id group by owned.id
  ), reserved as(
    select owned.id,coalesce(sum(reservation.amount_minor) filter(where reservation.state='active'
      and reservation.expires_at>clock_timestamp()),0)::bigint amount from owned
    left join benefit.reservation reservation on reservation.account_id=owned.id group by owned.id
  ), spendable as(
    select owned.id,coalesce(sum(lot.remaining_minor) filter(where lot.state='active'
      and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0)::bigint amount
    from owned left join benefit.lot lot on lot.account_id=owned.id group by owned.id
  ) select owned.id,greatest(0,least(ledger.amount,spendable.amount)-reserved.amount)::bigint,owned.version,owned.kind
    from owned join ledger using(id) join reserved using(id) join spendable using(id) order by owned.id;
end
$function$;

create or replace function benefit.purchase_reserve(
  p_membership text,p_session text,p_order text,p_member text,p_accounts text[],p_amounts bigint[]
) returns void language plpgsql volatile security definer
set search_path=identity,access,member,benefit,finance,ordering,public,pg_temp set row_security=off as $function$
declare context record; requested record; selected record; available bigint;
begin
  select * into context from access.purchase_session_context(p_membership,p_session,true);
  if p_member is distinct from context.member_id or p_order is null or length(p_order)>255 or p_order!~'^order:'
    or p_accounts is null or p_amounts is null or cardinality(p_accounts)=0 or cardinality(p_accounts)>16
    or cardinality(p_accounts)<>cardinality(p_amounts)
    or (select count(distinct account) from unnest(p_accounts) account)<>cardinality(p_accounts)
    or exists(select 1 from unnest(p_accounts,p_amounts) item(account,amount)
      where item.account is null or item.account='' or item.amount is null or item.amount<=0) then
    raise exception 'PURCHASE_BENEFIT_RESERVATION_INVALID';
  end if;
  if exists(select 1 from ordering.orderrecord where id=p_order) then raise exception 'PURCHASE_ORDER_ALREADY_EXISTS'; end if;
  for requested in select item.account,item.amount from unnest(p_accounts,p_amounts) item(account,amount) order by item.account loop
    select account.id,account.finance_account_id into selected from benefit.account account
    where account.id=requested.account and account.member_id=context.member_id and account.scope_id=context.mall_id
      and account.currency='CNY' and account.status='active' for update;
    if selected.id is null then raise exception 'PURCHASE_BENEFIT_ACCOUNT_NOT_USABLE'; end if;
    select greatest(0,least(
      coalesce((select sum(case when entry.side='credit' then entry.amount_minor else -entry.amount_minor end)
        from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
        where entry.account_id=selected.finance_account_id and journal.state='posted'),0),
      coalesce((select sum(lot.remaining_minor) from benefit.lot lot where lot.account_id=selected.id and lot.state='active'
        and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0)
    )-coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation
      where reservation.account_id=selected.id and reservation.state='active' and reservation.expires_at>clock_timestamp()),0))
    into available;
    if available<requested.amount then raise exception 'PURCHASE_BENEFIT_BALANCE_INSUFFICIENT'; end if;
    insert into benefit.reservation(id,account_id,owner_id,amount_minor,state,expires_at)
    values('benefitreserve:'||substr(encode(public.digest(p_order||':'||selected.id,'sha256'),'hex'),1,40),selected.id,p_order,
      requested.amount,'active',clock_timestamp()+interval '30 minutes');
  end loop;
end
$function$;

create or replace function benefit.purchase_consume(
  p_membership text,p_session text,p_order text,p_intent text,p_account text,p_amount bigint
) returns void language plpgsql volatile security definer
set search_path=identity,access,member,benefit,finance,ordering,payment,public,pg_temp set row_security=off as $function$
declare context record; selected record; held text; lot record; remaining bigint:=p_amount; consume_amount bigint;
begin
  select * into context from access.purchase_session_context(p_membership,p_session,true);
  if p_amount is null or p_amount<=0 then raise exception 'PURCHASE_BENEFIT_CONSUMPTION_INVALID'; end if;
  if not exists(
    select 1 from ordering.orderrecord orders join payment.intent intent on intent.order_id=orders.id
    where orders.id=p_order and orders.member_id=context.member_id and orders.mall_id=context.mall_id
      and orders.scope_id=context.mall_id and orders.currency='CNY' and orders.lifecycle_state='created'
      and orders.payment_state in('unpaid','authorizing') and intent.id=p_intent and intent.member_id=context.member_id
      and intent.currency='CNY' and intent.state in('created','authorizing','authorized') and intent.amount_minor=orders.total_minor
      and not exists(select 1 from payment.intenttender tender where tender.intent_id=intent.id and tender.kind<>'benefit')
      and (select coalesce(sum(tender.amount_minor),0) from payment.intenttender tender where tender.intent_id=intent.id)=intent.amount_minor
      and exists(select 1 from payment.intenttender tender where tender.intent_id=intent.id and tender.kind='benefit'
        and tender.reference_id=p_account and tender.amount_minor=p_amount and tender.state='held')
  ) then raise exception 'PURCHASE_INTERNAL_PAYMENT_INVALID'; end if;
  select account.id,account.scope_id,account.currency,account.finance_account_id into selected
  from benefit.account account where account.id=p_account and account.member_id=context.member_id
    and account.scope_id=context.mall_id and account.status='active' and account.currency='CNY' for update;
  if selected.id is null then raise exception 'PURCHASE_BENEFIT_ACCOUNT_NOT_USABLE'; end if;
  select reservation.id into held from benefit.reservation reservation
  where reservation.account_id=p_account and reservation.owner_id=p_order and reservation.state='active'
    and reservation.expires_at>clock_timestamp() and reservation.amount_minor=p_amount for update;
  if held is null then raise exception 'PURCHASE_BENEFIT_HOLD_MISSING'; end if;
  for lot in select candidate.id,candidate.remaining_minor from benefit.lot candidate
    where candidate.account_id=p_account and candidate.state='active' and candidate.effective_at<=clock_timestamp()
      and (candidate.expires_at is null or candidate.expires_at>clock_timestamp())
    order by candidate.expires_at nulls last,candidate.effective_at,candidate.id for update
  loop
    consume_amount:=least(remaining,lot.remaining_minor);
    if consume_amount<=0 then continue; end if;
    update benefit.lot set remaining_minor=remaining_minor-consume_amount,
      state=case when remaining_minor=consume_amount then 'consumed' else 'active' end,version=version+1 where id=lot.id;
    insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
    values('movement:'||gen_random_uuid()::text,lot.id,'consume',consume_amount,'order',p_order,clock_timestamp());
    remaining:=remaining-consume_amount;
    exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'PURCHASE_BENEFIT_BALANCE_INSUFFICIENT'; end if;
  perform finance.post(context.mall_id,'benefit.consume',selected.id||':'||p_order,'CNY','Benefit order consumption',
    'benefit.'||selected.id,'liability','commerce.benefit','income',p_amount,clock_timestamp());
  update benefit.reservation set state='consumed' where id=held;
end
$function$;

-- The catalog bootstrap remains insert-only, while a separate boundary
-- function can qualify one already-registered sandbox member. It never creates
-- benefit accounts, lots or amounts.
create or replace function deployment.sandbox_member_qualification_bootstrap(p_sentinel text,p_membership text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,deployment,identity,access,member,organization,qualification,audit,public
set row_security=off as $function$
declare selected record; v_audit_id text; v_previous_hash text; v_after_hash text; v_occurred timestamptz:=clock_timestamp();
begin
  if session_user<>'zhudatuansandboxbootstrap'
    or not deployment.sandbox_catalog_bootstrap_boundary(p_sentinel)
    or p_membership is null or p_membership='' or length(p_membership)>255 then
    raise exception 'SANDBOX_QUALIFICATION_BOUNDARY_INVALID';
  end if;
  select membership.member_id,membership.organization_id,profile.principal_id into selected
  from access.membership membership
  join access.membershiprole membershiprole on membershiprole.membership_id=membership.id
    and membershiprole.role_id='role-zhudatuan-storefront-member'
    and membershiprole.effective_at<=clock_timestamp()
    and (membershiprole.expires_at is null or membershiprole.expires_at>clock_timestamp())
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join organization.organization organization on organization.id=membership.organization_id
    and organization.id='mall-zhudatuan' and organization.kind='mall' and organization.status='active'
  where membership.id=p_membership and membership.client='storefront' and membership.status='active';
  if selected.member_id is null then raise exception 'SANDBOX_QUALIFICATION_MEMBERSHIP_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0));
  insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
  values(selected.member_id,'mall-zhudatuan',null,null,
    jsonb_build_object('sandbox',true,'bootstrap','zhudatuan-sandbox-member-qualification-v1'),'active',1,v_occurred)
  on conflict(member_id) do nothing;
  if not exists(select 1 from qualification.profile profile where profile.member_id=selected.member_id
    and profile.scope_id='mall-zhudatuan' and profile.city_code is null and profile.city_name is null
    and profile.attributes=jsonb_build_object('sandbox',true,'bootstrap','zhudatuan-sandbox-member-qualification-v1')
    and profile.status='active' and profile.version=1) then
    raise exception 'SANDBOX_QUALIFICATION_PROFILE_CONFLICT';
  end if;
  v_audit_id:='audit:zhudatuan:sandbox-qualification:'||substr(encode(public.digest(p_membership,'sha256'),'hex'),1,32);
  v_after_hash:=encode(public.digest(selected.member_id||':mall-zhudatuan:active:1','sha256'),'hex');
  select chain.record_hash into v_previous_hash from(
    select record.record_hash,record.recorded_at occurred_at from audit.record record where record.scope_id='mall-zhudatuan'
    union all select accessrecord.record_hash,accessrecord.accessed_at from audit.accessrecord accessrecord where accessrecord.scope_id='mall-zhudatuan'
    union all select archive.last_record_hash,archive.through_at from audit.archiveref archive where archive.scope_id='mall-zhudatuan'
  ) chain order by chain.occurred_at desc limit 1;
  insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
    previous_hash,record_hash,recorded_at)
  values(v_audit_id,'mall-zhudatuan','sandbox-bootstrap','migration','qualification.sandbox.activated','member.profile',selected.member_id,
    null,v_after_hash,jsonb_build_object('bootstrap','zhudatuan-sandbox-member-qualification-v1','sandboxOnly',true,
      'productionData',false,'membership',p_membership,'member',selected.member_id,'qualificationStatus','active',
      'benefitAccountCreated',false,'benefitAmountGranted',false),
    'bootstrap:zhudatuan-sandbox-member-qualification-v1',v_previous_hash,
    encode(public.digest(v_audit_id||':'||coalesce(v_previous_hash,'')||':'||v_after_hash||':'||v_occurred::text,'sha256'),'hex'),v_occurred)
  on conflict do nothing;
  if not exists(select 1 from audit.record record where record.id=v_audit_id and record.scope_id='mall-zhudatuan'
    and record.action='qualification.sandbox.activated' and record.resource_id=selected.member_id
    and record.after_hash=v_after_hash and record.evidence->>'membership'=p_membership
    and record.evidence->>'benefitAccountCreated'='false' and record.evidence->>'benefitAmountGranted'='false'
    and record.record_hash=encode(public.digest(record.id||':'||coalesce(record.previous_hash,'')||':'||record.after_hash
      ||':'||record.recorded_at::text,'sha256'),'hex')) then
    raise exception 'SANDBOX_QUALIFICATION_AUDIT_CONFLICT';
  end if;
  return jsonb_build_object('membership',p_membership,'member',selected.member_id,'scope','mall-zhudatuan',
    'status','active','version',1,'benefitAmountGranted',false);
end
$function$;

-- Explicit test-only welfare is a separate Owner-operated one-shot. It is
-- never coupled to registration or qualification, accepts no default amount,
-- and leaves the sandbox role without benefit/finance schema access.
create or replace function deployment.sandbox_member_welfare_bootstrap(
  p_sentinel text,p_membership text,p_amount bigint,p_currency text,p_confirmation text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,deployment,identity,access,member,organization,qualification,benefit,finance,runtime,audit,public
set row_security=off as $function$
declare selected record; v_suffix text; v_plan_id text; v_budget_id text; v_batch_id text; v_account_id text; v_finance_id text;
  v_lot_id text; v_audit_id text; v_previous_hash text; v_after_hash text; v_occurred timestamptz:=clock_timestamp();
begin
  if session_user<>'zhudatuansandboxbootstrap'
    or not deployment.sandbox_catalog_bootstrap_boundary(p_sentinel)
    or p_confirmation<>'OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT'
    or p_membership is null or p_membership='' or length(p_membership)>255
    or p_amount is null or p_amount<1 or p_amount>1000000 or p_currency is distinct from 'CNY' then
    raise exception 'SANDBOX_WELFARE_BOUNDARY_INVALID';
  end if;
  select membership.member_id,membership.organization_id,profile.principal_id into selected
  from access.membership membership
  join access.membershiprole membershiprole on membershiprole.membership_id=membership.id
    and membershiprole.role_id='role-zhudatuan-storefront-member'
    and membershiprole.effective_at<=clock_timestamp()
    and (membershiprole.expires_at is null or membershiprole.expires_at>clock_timestamp())
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join organization.organization organization on organization.id=membership.organization_id
    and organization.id='mall-zhudatuan' and organization.kind='mall' and organization.status='active'
  join qualification.profile qualification on qualification.member_id=membership.member_id
    and qualification.scope_id='mall-zhudatuan' and qualification.status='active'
    and qualification.attributes->>'bootstrap'='zhudatuan-sandbox-member-qualification-v1'
  where membership.id=p_membership and membership.client='storefront' and membership.status='active';
  if selected.member_id is null then raise exception 'SANDBOX_WELFARE_MEMBERSHIP_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sandbox-welfare:'||p_membership,0));
  perform pg_advisory_xact_lock(hashtextextended('audit:mall-zhudatuan',0));
  v_suffix:=substr(encode(public.digest(p_membership,'sha256'),'hex'),1,40);
  v_plan_id:='plan:sandbox-welfare:'||v_suffix;
  v_budget_id:='budget:sandbox-welfare:'||v_suffix;
  v_batch_id:='grantbatch:sandbox-welfare:'||v_suffix;
  v_account_id:='benefit:'||encode(public.digest(selected.member_id||':mall-zhudatuan:welfare:CNY','sha256'),'hex');
  v_lot_id:='lot:'||encode(public.digest(v_account_id||':'||v_batch_id,'sha256'),'hex');
  v_audit_id:='audit:zhudatuan:sandbox-welfare:'||v_suffix;
  if exists(select 1 from benefit.grantbatch batch where batch.id=v_batch_id and batch.amount_minor<>p_amount)
    or exists(select 1 from benefit.lot lot where lot.id=v_lot_id and lot.total_minor<>p_amount)
    or exists(select 1 from audit.record record where record.id=v_audit_id
      and (record.evidence->>'amountMinor')::bigint is distinct from p_amount) then
    raise exception 'SANDBOX_WELFARE_AMOUNT_CONFLICT';
  end if;
  v_finance_id:=finance.ensure_account('mall-zhudatuan','benefit.'||v_account_id,'CNY','liability');

  insert into benefit.plan(id,scope_id,name,kind,currency,state,version)
  values(v_plan_id,'mall-zhudatuan','Sandbox Welfare '||v_suffix,'welfare','CNY','active',1) on conflict do nothing;
  insert into benefit.planversion(plan_id,version,name,kind,currency,state,changed_by,changed_at)
  values(v_plan_id,1,'Sandbox Welfare '||v_suffix,'welfare','CNY','active','sandbox-owner-manual',v_occurred)
  on conflict do nothing;
  insert into benefit.budget(id,plan_id,period,total_minor,granted_minor,reserved_minor,version)
  values(v_budget_id,v_plan_id,to_char(v_occurred at time zone 'UTC','YYYY-MM'),p_amount,p_amount,0,1) on conflict do nothing;
  insert into benefit.grantbatch(id,plan_id,budget_id,state,requested_by,approved_by,requested_count,amount_minor,reason,
    created_at,updated_at,plan_version,effective_at,expires_at,timezone,snapshot_hash)
  values(v_batch_id,v_plan_id,v_budget_id,'completed','sandbox-owner-manual','sandbox-bootstrap-boundary',1,p_amount,
    'Explicit Owner-approved sandbox purchase E2E welfare',v_occurred,v_occurred,1,v_occurred,v_occurred+interval '30 days',
    'Asia/Shanghai',encode(public.digest(selected.member_id||':'||p_amount::text,'sha256'),'hex')) on conflict do nothing;
  insert into benefit.grantitem(batch_id,member_id,amount_minor,state,error_code)
  values(v_batch_id,selected.member_id,p_amount,'granted',null) on conflict do nothing;
  insert into benefit.account(id,member_id,scope_id,kind,currency,status,version,finance_account_id)
  values(v_account_id,selected.member_id,'mall-zhudatuan','welfare','CNY','active',0,v_finance_id) on conflict do nothing;
  insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,origin,version)
  values(v_lot_id,v_account_id,v_batch_id,selected.member_id,p_amount,p_amount,'active',v_occurred,v_occurred+interval '30 days','grant',0)
  on conflict do nothing;
  perform finance.post('mall-zhudatuan','benefit.sandbox.grant',v_batch_id||':'||selected.member_id,'CNY',
    'Explicit sandbox welfare grant','benefit.expense','expense','benefit.'||v_account_id,'liability',p_amount,v_occurred);
  insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
  values('movement:'||encode(public.digest(v_lot_id||':grant','sha256'),'hex'),v_lot_id,'grant',p_amount,'grantbatch',v_batch_id,v_occurred)
  on conflict do nothing;
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:'||encode(public.digest('benefit:sandbox:grant:'||v_batch_id||':'||selected.member_id,'sha256'),'hex'),
    'benefit.granted',1,'account',v_account_id,'mall-zhudatuan',jsonb_build_object('batch',v_batch_id,'account',v_account_id,
      'member',selected.member_id,'amountMinor',p_amount,'currency','CNY','kind','welfare','sandboxOnly',true),
    'bootstrap:zhudatuan-sandbox-welfare-v1',v_occurred,v_occurred) on conflict do nothing;

  if not exists(select 1 from benefit.plan plan where plan.id=v_plan_id and plan.scope_id='mall-zhudatuan' and plan.kind='welfare'
      and plan.currency='CNY' and plan.state='active' and plan.version=1)
    or not exists(select 1 from benefit.budget budget where budget.id=v_budget_id and budget.plan_id=v_plan_id
      and budget.total_minor=p_amount and budget.granted_minor=p_amount and budget.reserved_minor=0 and budget.version=1)
    or not exists(select 1 from benefit.grantbatch batch where batch.id=v_batch_id and batch.plan_id=v_plan_id
      and batch.budget_id=v_budget_id and batch.state='completed' and batch.requested_count=1
      and batch.amount_minor=p_amount and batch.plan_version=1)
    or not exists(select 1 from benefit.grantitem item where item.batch_id=v_batch_id and item.member_id=selected.member_id
      and item.amount_minor=p_amount and item.state='granted')
    or not exists(select 1 from benefit.account account where account.id=v_account_id and account.member_id=selected.member_id
      and account.scope_id='mall-zhudatuan' and account.kind='welfare' and account.currency='CNY'
      and account.status='active' and account.finance_account_id=v_finance_id)
    or not exists(select 1 from benefit.lot lot where lot.id=v_lot_id and lot.account_id=v_account_id and lot.batch_id=v_batch_id
      and lot.member_id=selected.member_id and lot.total_minor=p_amount and lot.remaining_minor between 0 and p_amount
      and lot.state in('active','consumed','expired') and lot.origin='grant')
    or not exists(select 1 from benefit.lotmovement movement where movement.lot_id=v_lot_id and movement.kind='grant'
      and movement.amount_minor=p_amount and movement.reference_type='grantbatch' and movement.reference_id=v_batch_id) then
    raise exception 'SANDBOX_WELFARE_DATA_CONFLICT';
  end if;

  v_after_hash:=encode(public.digest(selected.member_id||':'||v_account_id||':'||p_amount::text||':CNY','sha256'),'hex');
  select chain.record_hash into v_previous_hash from(
    select record.record_hash,record.recorded_at occurred_at from audit.record record where record.scope_id='mall-zhudatuan'
    union all select accessrecord.record_hash,accessrecord.accessed_at from audit.accessrecord accessrecord where accessrecord.scope_id='mall-zhudatuan'
    union all select archive.last_record_hash,archive.through_at from audit.archiveref archive where archive.scope_id='mall-zhudatuan'
  ) chain order by chain.occurred_at desc limit 1;
  insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,trace_id,
    previous_hash,record_hash,recorded_at)
  values(v_audit_id,'mall-zhudatuan','sandbox-owner-manual','operator','benefit.sandbox.granted','benefit.account',v_account_id,
    null,v_after_hash,jsonb_build_object('bootstrap','zhudatuan-sandbox-welfare-v1','sandboxOnly',true,'productionData',false,
      'ownerApproved',true,'membership',p_membership,'member',selected.member_id,'account',v_account_id,'batch',v_batch_id,
      'amountMinor',p_amount,'currency','CNY','expiresInDays',30,'automaticRegistrationGrant',false),
    'bootstrap:zhudatuan-sandbox-welfare-v1',v_previous_hash,
    encode(public.digest(v_audit_id||':'||coalesce(v_previous_hash,'')||':'||v_after_hash||':'||v_occurred::text,'sha256'),'hex'),v_occurred)
  on conflict do nothing;
  if not exists(select 1 from audit.record record where record.id=v_audit_id and record.scope_id='mall-zhudatuan'
    and record.action='benefit.sandbox.granted' and record.resource_id=v_account_id and record.after_hash=v_after_hash
    and record.evidence->>'membership'=p_membership and record.evidence->>'amountMinor'=p_amount::text
    and record.evidence->>'currency'='CNY' and record.evidence->>'automaticRegistrationGrant'='false'
    and record.record_hash=encode(public.digest(record.id||':'||coalesce(record.previous_hash,'')||':'||record.after_hash
      ||':'||record.recorded_at::text,'sha256'),'hex')) then
    raise exception 'SANDBOX_WELFARE_AUDIT_CONFLICT';
  end if;
  return jsonb_build_object('membership',p_membership,'member',selected.member_id,'scope','mall-zhudatuan','account',v_account_id,
    'batch',v_batch_id,'amountMinor',p_amount,'currency','CNY','expiresInDays',30,'sandboxOnly',true);
end
$function$;

revoke all on function access.purchase_session_context(text,text,boolean),access.purchase_member_scope(text,text),
  access.purchase_member_mall_allowed(text,text),access.purchase_member_allowed(text),access.purchase_mall_allowed(text),
  access.purchase_order_allowed(text),access.purchase_checkout_allowed(text),access.purchase_quote_allowed(text),
  access.purchase_intent_allowed(text),access.purchase_fulfillment_allowed(text),access.purchase_application_allowed(text),
  access.purchase_benefit_account_allowed(text),access.purchase_risk_scope_allowed(text),access.purchase_audit_scope_allowed(text),
  benefit.purchase_available(text,text,text[]),benefit.purchase_reserve(text,text,text,text,text[],bigint[]),
  benefit.purchase_consume(text,text,text,text,text,bigint),benefit.web_ledger(text,text),
  deployment.sandbox_member_qualification_bootstrap(text,text),
  deployment.sandbox_member_welfare_bootstrap(text,text,bigint,text,text)
  from public,anon,authenticated,service_role,shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,
    zhudatuanbootstrap,zhudatuanwebapi,zhudatuansandboxbootstrap,zhudatuanpurchaseapi;

grant execute on function benefit.web_ledger(text,text) to zhudatuanwebapi;
grant execute on function access.purchase_member_scope(text,text),access.purchase_member_mall_allowed(text,text),
  access.purchase_member_allowed(text),access.purchase_mall_allowed(text),access.purchase_order_allowed(text),
  access.purchase_checkout_allowed(text),access.purchase_quote_allowed(text),access.purchase_intent_allowed(text),
  access.purchase_fulfillment_allowed(text),access.purchase_application_allowed(text),access.purchase_benefit_account_allowed(text),
  access.purchase_risk_scope_allowed(text),access.purchase_audit_scope_allowed(text),
  benefit.purchase_available(text,text,text[]),benefit.purchase_reserve(text,text,text,text,text[],bigint[]),
  benefit.purchase_consume(text,text,text,text,text,bigint) to zhudatuanpurchaseapi;
grant execute on function deployment.sandbox_member_qualification_bootstrap(text,text) to zhudatuansandboxbootstrap;
grant execute on function deployment.sandbox_member_welfare_bootstrap(text,text,bigint,text,text) to zhudatuansandboxbootstrap;

-- Canonical transitions receive only the columns they actually mutate. Revoke
-- table-wide UPDATE first so a pre-provisioning mistake cannot survive this
-- least-privilege boundary; pricing.quote is an immutable inserted snapshot.
revoke update on runtime.idempotency,cart.cart,checkout.session,pricing.quote,inventory.stockitem,
  inventory.reservation,marketing.campaign,marketing.redemption,ordering.orderrecord,payment.intent,payment.intenttender
  from zhudatuanpurchaseapi;
grant usage on schema public,identity,access,capability,member,organization,runtime,risk,audit,catalog,pricing,
  cart,checkout,qualification,invoice,experience,inventory,marketing,ordering,payment,fulfillment,benefit
  to zhudatuanpurchaseapi;
grant select on runtime.schemaversion,runtime.idempotency,runtime.outbox to zhudatuanpurchaseapi;
grant insert on runtime.idempotency to zhudatuanpurchaseapi;
grant update(state,response) on runtime.idempotency to zhudatuanpurchaseapi;
grant insert on runtime.outbox,runtime.job to zhudatuanpurchaseapi;
grant select on access.membership to zhudatuanpurchaseapi;
grant select,insert on access.decisionaudit to zhudatuanpurchaseapi;
grant select on member.profile,organization.organization,organization.unitclosure to zhudatuanpurchaseapi;
grant select on risk.policy,risk.policyversion,risk.signal,risk.listentry to zhudatuanpurchaseapi;
grant select,insert on audit.record,audit.accessrecord to zhudatuanpurchaseapi;
grant select on audit.archiveref to zhudatuanpurchaseapi;
grant select on cart.cart,cart.item,checkout.address to zhudatuanpurchaseapi;
grant update(state,updated_at,version) on cart.cart to zhudatuanpurchaseapi;
grant select,insert on checkout.session to zhudatuanpurchaseapi;
grant update(state,version) on checkout.session to zhudatuanpurchaseapi;
grant select,insert on checkout.evidence to zhudatuanpurchaseapi;
grant select on qualification.profile,qualification.tag,qualification.policy,qualification.policyversion,
  qualification.subject,qualification.resource,qualification.purchaselimit to zhudatuanpurchaseapi;
grant select on invoice.profile to zhudatuanpurchaseapi;
grant select on experience.publication to zhudatuanpurchaseapi;
grant select on catalog.product,catalog.sku,catalog.listing,catalog.sourcelisting to zhudatuanpurchaseapi;
grant select on pricing.pricebook,pricing.price,pricing.rule to zhudatuanpurchaseapi;
grant select,insert on pricing.quote to zhudatuanpurchaseapi;
grant select on inventory.stockitem to zhudatuanpurchaseapi;
grant update(onhand,version,updated_at) on inventory.stockitem to zhudatuanpurchaseapi;
grant select,insert on inventory.reservation to zhudatuanpurchaseapi;
grant update(state,version) on inventory.reservation to zhudatuanpurchaseapi;
grant insert on inventory.movement to zhudatuanpurchaseapi;
grant select on marketing.campaign to zhudatuanpurchaseapi;
grant update(spent_minor,version,updated_at) on marketing.campaign to zhudatuanpurchaseapi;
grant select,insert on marketing.redemption to zhudatuanpurchaseapi;
grant update(state,updated_at) on marketing.redemption to zhudatuanpurchaseapi;
grant select,insert on ordering.orderrecord to zhudatuanpurchaseapi;
grant update(payment_state,fulfillment_state,lifecycle_state,updated_at,version) on ordering.orderrecord to zhudatuanpurchaseapi;
grant select,insert on ordering.line,ordering.suborder to zhudatuanpurchaseapi;
grant usage on sequence ordering.order_number_seq to zhudatuanpurchaseapi;
grant select,insert on payment.intent,payment.intenttender to zhudatuanpurchaseapi;
grant update(state,version) on payment.intent to zhudatuanpurchaseapi;
grant update(state) on payment.intenttender to zhudatuanpurchaseapi;
grant select,insert on payment.payment,payment.capture,payment.allocation to zhudatuanpurchaseapi;
grant select,insert on fulfillment.fulfillmentorder,fulfillment.line to zhudatuanpurchaseapi;
grant execute on function identity.resolve_session(text),access.resolve_membership(text),access.membership_version(text),
  access.resolve_scope(text,text,text),capability.membership_operations(text),public.digest(text,text) to zhudatuanpurchaseapi;

-- Make the new schema marker visible to both existing runtime/seed profiles.
alter policy zhudatuanwebapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260828170000','20260828173000','20260828180000'));
alter policy zhudatuansandboxbootstrap on runtime.schemaversion
  using(version in('20260828170000','20260828173000','20260828180000'));

-- Runtime control and authorization.
create policy zhudatuanpurchaseapi on runtime.schemaversion for select to zhudatuanpurchaseapi
  using(version in('20260821032000','20260821054000','20260828170000','20260828173000','20260828180000'));
create policy zhudatuanpurchaseapiselect on runtime.idempotency for select to zhudatuanpurchaseapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope));
create policy zhudatuanpurchaseapiinsert on runtime.idempotency for insert to zhudatuanpurchaseapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope)
    and state='started' and response is null);
create policy zhudatuanpurchaseapiupdate on runtime.idempotency for update to zhudatuanpurchaseapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope))
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope)
    and state in('completed','failed'));
create policy zhudatuanpurchaseapi on access.membership for select to zhudatuanpurchaseapi
  using(id=nullif(current_setting('app.membership_id',true),'') and member_id is not null
    and access.purchase_member_mall_allowed(member_id,organization_id));
create policy zhudatuanpurchaseapiselect on access.decisionaudit for select to zhudatuanpurchaseapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_risk_scope_allowed(scope_id));
create policy zhudatuanpurchaseapiinsert on access.decisionaudit for insert to zhudatuanpurchaseapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'')
    and (scope_id is null or access.purchase_audit_scope_allowed(scope_id)));

create policy zhudatuanpurchaseapi on member.profile for select to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(id));
create policy zhudatuanpurchaseapi on organization.organization for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(id));
create policy zhudatuanpurchaseapi on organization.unitclosure for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(descendant_id));
create policy zhudatuanpurchaseapi on risk.policy for select to zhudatuanpurchaseapi
  using(access.purchase_risk_scope_allowed(scope_id));
create policy zhudatuanpurchaseapi on risk.policyversion for select to zhudatuanpurchaseapi
  using(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy zhudatuanpurchaseapi on risk.signal for select to zhudatuanpurchaseapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_risk_scope_allowed(scope_id));
create policy zhudatuanpurchaseapi on risk.listentry for select to zhudatuanpurchaseapi
  using(access.purchase_risk_scope_allowed(scope_id)
    and token=encode(public.digest(nullif(current_setting('app.actor_id',true),''),'sha256'),'hex'));

create policy zhudatuanpurchaseapiselect on audit.record for select to zhudatuanpurchaseapi
  using(access.purchase_audit_scope_allowed(scope_id));
create policy zhudatuanpurchaseapiinsert on audit.record for insert to zhudatuanpurchaseapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope_id));
create policy zhudatuanpurchaseapiselect on audit.accessrecord for select to zhudatuanpurchaseapi
  using(access.purchase_audit_scope_allowed(scope_id));
create policy zhudatuanpurchaseapiinsert on audit.accessrecord for insert to zhudatuanpurchaseapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope_id));
create policy zhudatuanpurchaseapi on audit.archiveref for select to zhudatuanpurchaseapi
  using(access.purchase_audit_scope_allowed(scope_id));

-- Quote inputs are read-only snapshots of a 4322-owned cart. Purchase may
-- convert that cart but cannot create, delete or edit its items.
create policy zhudatuanpurchaseapiselect on cart.cart for select to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id) and access.purchase_application_allowed(application_id));
create policy zhudatuanpurchaseapiupdate on cart.cart for update to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id) and state='active')
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and state='converted');
create policy zhudatuanpurchaseapi on cart.item for select to zhudatuanpurchaseapi
  using(exists(select 1 from cart.cart cart where cart.id=cart_id
    and access.purchase_member_mall_allowed(cart.member_id,cart.mall_id)));
create policy zhudatuanpurchaseapi on checkout.address for select to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(member_id) and status='active');

create policy zhudatuanpurchaseapiselect on checkout.session for select to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id));
create policy zhudatuanpurchaseapiinsert on checkout.session for insert to zhudatuanpurchaseapi
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and state='quoted'
    and access.purchase_application_allowed(application_id) and access.purchase_quote_allowed(quote_id)
    and jsonb_typeof(input->'vouchers')='array' and jsonb_array_length(input->'vouchers')=0
    and jsonb_typeof(input->'benefits')='array' and jsonb_array_length(input->'benefits')>0);
create policy zhudatuanpurchaseapiupdate on checkout.session for update to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id) and state='quoted')
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and state='confirmed');
create policy zhudatuanpurchaseapiselect on checkout.evidence for select to zhudatuanpurchaseapi
  using(access.purchase_checkout_allowed(checkout_id));
create policy zhudatuanpurchaseapiinsert on checkout.evidence for insert to zhudatuanpurchaseapi
  with check(access.purchase_checkout_allowed(checkout_id));

create policy zhudatuanpurchaseapi on qualification.profile for select to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,scope_id) and status='active');
create policy zhudatuanpurchaseapi on qualification.tag for select to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(member_id));
create policy zhudatuanpurchaseapi on qualification.policy for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and status='published');
create policy zhudatuanpurchaseapi on qualification.policyversion for select to zhudatuanpurchaseapi
  using(exists(select 1 from qualification.policy policy where policy.id=policy_id));
create policy zhudatuanpurchaseapi on qualification.subject for select to zhudatuanpurchaseapi
  using(exists(select 1 from qualification.policy policy where policy.id=policy_id));
create policy zhudatuanpurchaseapi on qualification.resource for select to zhudatuanpurchaseapi
  using(exists(select 1 from qualification.policy policy where policy.id=policy_id));
create policy zhudatuanpurchaseapi on qualification.purchaselimit for select to zhudatuanpurchaseapi
  using(exists(select 1 from qualification.policy policy where policy.id=policy_id));
create policy zhudatuanpurchaseapi on invoice.profile for select to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(owner_id) and status='active');
create policy zhudatuanpurchaseapi on experience.publication for select to zhudatuanpurchaseapi
  using(state='active' and access.purchase_application_allowed(application_id));

create policy zhudatuanpurchaseapi on catalog.listing for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and status='published');
create policy zhudatuanpurchaseapi on catalog.sourcelisting for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id));
create policy zhudatuanpurchaseapi on catalog.sku for select to zhudatuanpurchaseapi using(exists(
  select 1 from catalog.listing listing where listing.sku_id=catalog.sku.id and access.purchase_mall_allowed(listing.scope_id)
));
create policy zhudatuanpurchaseapi on catalog.product for select to zhudatuanpurchaseapi using(exists(
  select 1 from catalog.sku sku join catalog.listing listing on listing.sku_id=sku.id
  where sku.product_id=catalog.product.id and access.purchase_mall_allowed(listing.scope_id)
));
create policy zhudatuanpurchaseapi on pricing.pricebook for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and status='active');
create policy zhudatuanpurchaseapi on pricing.price for select to zhudatuanpurchaseapi using(exists(
  select 1 from pricing.pricebook book where book.id=book_id and access.purchase_mall_allowed(book.scope_id)
));
create policy zhudatuanpurchaseapi on pricing.rule for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and status='published');

create policy zhudatuanpurchaseapiselect on pricing.quote for select to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id));
create policy zhudatuanpurchaseapiinsert on pricing.quote for insert to zhudatuanpurchaseapi
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and currency='CNY'
    and signed_payload#>>'{cart,member}'=member_id and signed_payload#>>'{cart,mall}'=mall_id
    and signed_payload->>'currency'='CNY' and signed_payload->>'personalMinor'='0'
    and jsonb_typeof(signed_payload->'tenders')='array' and jsonb_array_length(signed_payload->'tenders')>0
    and not exists(select 1 from jsonb_array_elements(signed_payload->'tenders') tender
      where tender->>'kind' is distinct from 'benefit' or tender->>'reference' is null
        or jsonb_typeof(tender->'amountMinor') is distinct from 'number' or (tender->>'amountMinor')::numeric<=0)
    and expires_at>clock_timestamp() and expires_at<=clock_timestamp()+interval '20 minutes');
create policy zhudatuanpurchaseapiupdate on pricing.quote for update to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id))
  with check(access.purchase_member_mall_allowed(member_id,mall_id));

create or replace function pricing.purchase_quote_immutable()
returns trigger language plpgsql set search_path=pg_catalog,pricing as $function$
begin
  if session_user='zhudatuanpurchaseapi' and new is distinct from old then
    raise exception 'PURCHASE_QUOTE_IMMUTABLE';
  end if;
  return new;
end
$function$;
revoke all on function pricing.purchase_quote_immutable() from public,anon,authenticated,service_role,
  shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,
  zhudatuansandboxbootstrap,zhudatuanpurchaseapi;
create trigger pricing_purchase_quote_immutable before update on pricing.quote
  for each row execute function pricing.purchase_quote_immutable();

create policy zhudatuanpurchaseapiselect on inventory.stockitem for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id));
create policy zhudatuanpurchaseapiupdate on inventory.stockitem for update to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and status='active')
  with check(access.purchase_mall_allowed(scope_id) and status='active' and onhand>=0 and safety>=0);
create policy zhudatuanpurchaseapiselect on inventory.reservation for select to zhudatuanpurchaseapi
  using(exists(select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.purchase_mall_allowed(stock.scope_id))
    and owner_type='order' and access.purchase_order_allowed(owner_id));
create policy zhudatuanpurchaseapiinsert on inventory.reservation for insert to zhudatuanpurchaseapi
  with check(exists(select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.purchase_mall_allowed(stock.scope_id))
    and owner_type='order' and owner_id~'^order:' and state='active'
    and expires_at>clock_timestamp() and expires_at<=clock_timestamp()+interval '31 minutes');
create policy zhudatuanpurchaseapiupdate on inventory.reservation for update to zhudatuanpurchaseapi
  using(exists(select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.purchase_mall_allowed(stock.scope_id))
    and owner_type='order' and state='active' and access.purchase_order_allowed(owner_id))
  with check(exists(select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.purchase_mall_allowed(stock.scope_id))
    and owner_type='order' and state='committed' and access.purchase_order_allowed(owner_id));
create policy zhudatuanpurchaseapi on inventory.movement for insert to zhudatuanpurchaseapi
  with check(exists(select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.purchase_mall_allowed(stock.scope_id))
    and kind in('reserve','commit') and reference_type='order' and reference_id~'^order:'
    and quantity_delta<0 and (kind='reserve' or (kind='commit' and access.purchase_order_allowed(reference_id))));

create policy zhudatuanpurchaseapiselect on marketing.campaign for select to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id));
create policy zhudatuanpurchaseapiupdate on marketing.campaign for update to zhudatuanpurchaseapi
  using(access.purchase_mall_allowed(scope_id) and state='active')
  with check(access.purchase_mall_allowed(scope_id) and state='active' and spent_minor<=budget_minor);
create policy zhudatuanpurchaseapiselect on marketing.redemption for select to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(member_id) and exists(select 1 from marketing.campaign campaign
    where campaign.id=campaign_id and access.purchase_mall_allowed(campaign.scope_id)));
create policy zhudatuanpurchaseapiinsert on marketing.redemption for insert to zhudatuanpurchaseapi
  with check(access.purchase_member_allowed(member_id) and order_id~'^order:' and state='reserved'
    and exists(select 1 from marketing.campaign campaign where campaign.id=campaign_id
      and access.purchase_mall_allowed(campaign.scope_id)));
create policy zhudatuanpurchaseapiupdate on marketing.redemption for update to zhudatuanpurchaseapi
  using(access.purchase_member_allowed(member_id) and state='reserved')
  with check(access.purchase_member_allowed(member_id) and state='committed');

create policy zhudatuanpurchaseapiselect on ordering.orderrecord for select to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id));
create policy zhudatuanpurchaseapiinsert on ordering.orderrecord for insert to zhudatuanpurchaseapi
  with check(scope_id=mall_id and access.purchase_member_mall_allowed(member_id,mall_id)
    and access.purchase_checkout_allowed(checkout_id) and currency='CNY' and total_minor>0
    and payment_state='unpaid' and fulfillment_state='unallocated' and aftersale_state='none' and lifecycle_state='created'
    and jsonb_typeof(evidence->'tenders')='array' and jsonb_array_length(evidence->'tenders')>0
    and not exists(select 1 from jsonb_array_elements(evidence->'tenders') tender
      where tender->>'kind' is distinct from 'benefit' or tender->>'reference' is null)
    and jsonb_typeof(evidence#>'{selection,vouchers}')='array'
    and jsonb_array_length(evidence#>'{selection,vouchers}')=0);
create policy zhudatuanpurchaseapiupdate on ordering.orderrecord for update to zhudatuanpurchaseapi
  using(access.purchase_member_mall_allowed(member_id,mall_id) and payment_state in('unpaid','authorizing'))
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and payment_state='paid'
    and lifecycle_state='active' and fulfillment_state='allocated' and aftersale_state='none');
create policy zhudatuanpurchaseapiselect on ordering.line for select to zhudatuanpurchaseapi
  using(access.purchase_order_allowed(order_id));
create policy zhudatuanpurchaseapiinsert on ordering.line for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id) and provider is null and partner_id is null);
create policy zhudatuanpurchaseapiselect on ordering.suborder for select to zhudatuanpurchaseapi
  using(access.purchase_order_allowed(order_id));
create policy zhudatuanpurchaseapiinsert on ordering.suborder for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id) and provider is null and partner_id is null and state='pending');

create policy zhudatuanpurchaseapiselect on payment.intent for select to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(id));
create policy zhudatuanpurchaseapiinsert on payment.intent for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id) and access.purchase_member_allowed(member_id)
    and currency='CNY' and amount_minor>0 and state='created');
create policy zhudatuanpurchaseapiupdate on payment.intent for update to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(id) and state in('created','authorizing','authorized'))
  with check(access.purchase_intent_allowed(id) and state='captured');
create policy zhudatuanpurchaseapiselect on payment.intenttender for select to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id) and kind='benefit'
    and access.purchase_benefit_account_allowed(reference_id));
create policy zhudatuanpurchaseapiinsert on payment.intenttender for insert to zhudatuanpurchaseapi
  with check(access.purchase_intent_allowed(intent_id) and kind='benefit' and state='held'
    and access.purchase_benefit_account_allowed(reference_id));
create policy zhudatuanpurchaseapiupdate on payment.intenttender for update to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id) and kind='benefit' and state='held'
    and access.purchase_benefit_account_allowed(reference_id))
  with check(access.purchase_intent_allowed(intent_id) and kind='benefit' and state='captured'
    and access.purchase_benefit_account_allowed(reference_id));
create policy zhudatuanpurchaseapiselect on payment.payment for select to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id));
create policy zhudatuanpurchaseapiinsert on payment.payment for insert to zhudatuanpurchaseapi
  with check(access.purchase_intent_allowed(intent_id) and amount_minor>0 and currency='CNY'
    and captured_minor=amount_minor and refunded_minor=0 and state='captured');
create policy zhudatuanpurchaseapiselect on payment.capture for select to zhudatuanpurchaseapi
  using(source='internal' and access.purchase_order_allowed(order_id));
create policy zhudatuanpurchaseapiinsert on payment.capture for insert to zhudatuanpurchaseapi
  with check(source='internal' and scope_id=mall_id and access.purchase_member_mall_allowed(member_id,mall_id)
    and access.purchase_order_allowed(order_id) and currency='CNY' and amount_minor>0 and state='succeeded');
create policy zhudatuanpurchaseapiselect on payment.allocation for select to zhudatuanpurchaseapi
  using(target_type='order' and access.purchase_order_allowed(target_id)
    and exists(select 1 from payment.payment payment where payment.id=payment_id and access.purchase_intent_allowed(payment.intent_id)));
create policy zhudatuanpurchaseapiinsert on payment.allocation for insert to zhudatuanpurchaseapi
  with check(target_type='order' and access.purchase_order_allowed(target_id) and amount_minor>0 and currency='CNY'
    and exists(select 1 from payment.payment payment where payment.id=payment_id and access.purchase_intent_allowed(payment.intent_id)));

create policy zhudatuanpurchaseapiselect on fulfillment.fulfillmentorder for select to zhudatuanpurchaseapi
  using(access.purchase_order_allowed(order_id) and provider is null and partner_id is null and store_id is null);
create policy zhudatuanpurchaseapiinsert on fulfillment.fulfillmentorder for insert to zhudatuanpurchaseapi
  with check(access.purchase_order_allowed(order_id) and provider is null and partner_id is null and store_id is null
    and state='pending' and payment_id is not null and source_effect_id='payment:'||payment_id);
create policy zhudatuanpurchaseapiselect on fulfillment.line for select to zhudatuanpurchaseapi
  using(access.purchase_fulfillment_allowed(fulfillment_id));
create policy zhudatuanpurchaseapiinsert on fulfillment.line for insert to zhudatuanpurchaseapi
  with check(access.purchase_fulfillment_allowed(fulfillment_id)
    and exists(select 1 from ordering.line line where line.id=order_line_id and access.purchase_order_allowed(line.order_id)));

-- Only the canonical purchase lifecycle may enqueue work or append events.
create policy zhudatuanpurchaseapiselect on runtime.outbox for select to zhudatuanpurchaseapi
  using(event_type='order.placed' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id));
create policy zhudatuanpurchaseapiinsert on runtime.outbox for insert to zhudatuanpurchaseapi
  with check(scope_id is not null and access.purchase_mall_allowed(scope_id) and (
    (event_type='checkout.quote.created' and aggregate_type='checkout' and access.purchase_checkout_allowed(aggregate_id))
    or (event_type='checkout.quote.confirmed' and aggregate_type='checkout' and access.purchase_checkout_allowed(aggregate_id))
    or (event_type='inventory.stock.reserved' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
    or (event_type='order.placed' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
    or (event_type='payment.succeeded' and aggregate_type='payment' and exists(select 1 from payment.payment payment
      where payment.id=aggregate_id and access.purchase_intent_allowed(payment.intent_id)))
    or (event_type='order.paid' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
  ));
create policy zhudatuanpurchaseapi on runtime.job for insert to zhudatuanpurchaseapi
  with check(state='queued' and scope_id is not null and access.purchase_mall_allowed(scope_id) and (
    (kind='orderexpiry' and owner='order' and access.purchase_order_allowed(payload->>'order'))
    or (kind='fulfillment' and owner='fulfillment' and access.purchase_fulfillment_allowed(payload->>'fulfillment'))
  ));

-- Extend the fixed sandbox fixture with a real active publication. The seed
-- remains outside migrations and can insert only these exact identifiers.
grant select,insert on experience.release,experience.publication to zhudatuansandboxbootstrap;
create policy zhudatuansandboxbootstrap on experience.release for select to zhudatuansandboxbootstrap
  using(id='release:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1'
    and version_id='version:zhudatuan:sandbox:v1');
create policy zhudatuansandboxbootstrapinsert on experience.release for insert to zhudatuansandboxbootstrap
  with check(id='release:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1'
    and version_id='version:zhudatuan:sandbox:v1' and state='active' and published_by='sandbox-bootstrap');
create policy zhudatuansandboxbootstrap on experience.publication for select to zhudatuansandboxbootstrap
  using(id='publication:zhudatuan:sandbox:v1' and release_id='release:zhudatuan:sandbox:v1'
    and application_id='application:zhudatuan:sandbox:v1' and version_id='version:zhudatuan:sandbox:v1');
create policy zhudatuansandboxbootstrapinsert on experience.publication for insert to zhudatuansandboxbootstrap
  with check(id='publication:zhudatuan:sandbox:v1' and release_id='release:zhudatuan:sandbox:v1'
    and application_id='application:zhudatuan:sandbox:v1' and version_id='version:zhudatuan:sandbox:v1'
    and state='active' and failure_code is null and object_ref like 'sandbox://%');
create policy zhudatuansandboxpublicationinsert on audit.record for insert to zhudatuansandboxbootstrap
  with check(id='audit:zhudatuan:sandbox-publication:v1' and scope_id='mall-zhudatuan'
    and actor_id='sandbox-bootstrap' and action='experience.sandbox.published'
    and resource_id='publication:zhudatuan:sandbox:v1');

insert into runtime.schemaversion(version,checksum)
values('20260828180000','0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c')
on conflict(version) do nothing;

do $assert$
declare
  table_name text;
  update_contract record;
begin
  if exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi'
    and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_PURCHASE_ROLE_UNSAFE';
  end if;
  if exists(select 1 from pg_auth_members membership
    where membership.member=(select oid from pg_roles where rolname='zhudatuanpurchaseapi')
      or membership.roleid=(select oid from pg_roles where rolname='zhudatuanpurchaseapi')) then
    raise exception 'ZHUDATUAN_PURCHASE_ROLE_MEMBERSHIP_UNSAFE';
  end if;
  if has_schema_privilege('zhudatuanpurchaseapi','finance','USAGE')
    or has_schema_privilege('zhudatuanpurchaseapi','voucher','USAGE')
    or has_schema_privilege('zhudatuanpurchaseapi','channel','USAGE')
    or has_schema_privilege('zhudatuanpurchaseapi','extension','USAGE') then
    raise exception 'ZHUDATUAN_PURCHASE_FORBIDDEN_DOMAIN_ACCESS';
  end if;
  foreach table_name in array array[
    'identity.session','benefit.account','benefit.lot','benefit.lotmovement','benefit.reservation','benefit.balance',
    'finance.account','finance.journal','finance.entry','finance.period','finance.statement','finance.settlement',
    'voucher.program','voucher.voucher','voucher.reserve','voucher.redemption',
    'payment.attempt','payment.prepay','payment.observation','payment.providerattempt','payment.refund','payment.refundcommand',
    'payment.refundtender','payment.recoverycase','payment.recoveryrequest','runtime.deadletter','runtime.inbox','runtime.rawenvelope',
    'ordering.aftersale','ordering.reviewaction'
  ] loop
    if has_table_privilege('zhudatuanpurchaseapi',table_name,'SELECT')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'INSERT')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'UPDATE')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'DELETE') then
      raise exception 'ZHUDATUAN_PURCHASE_FORBIDDEN_TABLE_ACCESS:%',table_name;
    end if;
  end loop;
  for table_name in select schemaname||'.'||tablename from pg_tables
    where schemaname not in('pg_catalog','information_schema')
  loop
    if has_table_privilege('zhudatuanpurchaseapi',table_name,'DELETE')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'TRUNCATE')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'REFERENCES')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'TRIGGER') then
      raise exception 'ZHUDATUAN_PURCHASE_DESTRUCTIVE_PRIVILEGE:%',table_name;
    end if;
  end loop;
  foreach table_name in array array[
    'checkout.address','cart.item','qualification.profile','qualification.tag','qualification.policy',
    'qualification.policyversion','qualification.subject','qualification.resource','qualification.purchaselimit',
    'invoice.profile','experience.publication','catalog.product','catalog.sku','catalog.listing','catalog.sourcelisting',
    'pricing.pricebook','pricing.price','pricing.rule','risk.policy','risk.policyversion','risk.signal','risk.listentry'
  ] loop
    if has_table_privilege('zhudatuanpurchaseapi',table_name,'INSERT')
      or has_table_privilege('zhudatuanpurchaseapi',table_name,'UPDATE') then
      raise exception 'ZHUDATUAN_PURCHASE_FORBIDDEN_MUTATION:%',table_name;
    end if;
  end loop;
  for update_contract in
    select * from (values
      ('runtime','idempotency',array['state','response']::text[]),
      ('cart','cart',array['state','updated_at','version']::text[]),
      ('checkout','session',array['state','version']::text[]),
      ('pricing','quote',array[]::text[]),
      ('inventory','stockitem',array['onhand','version','updated_at']::text[]),
      ('inventory','reservation',array['state','version']::text[]),
      ('marketing','campaign',array['spent_minor','version','updated_at']::text[]),
      ('marketing','redemption',array['state','updated_at']::text[]),
      ('ordering','orderrecord',array['payment_state','fulfillment_state','lifecycle_state','updated_at','version']::text[]),
      ('payment','intent',array['state','version']::text[]),
      ('payment','intenttender',array['state']::text[])
    ) as contract(schema_name,relation_name,allowed_columns)
  loop
    table_name:=format('%I.%I',update_contract.schema_name,update_contract.relation_name);
    if has_table_privilege('zhudatuanpurchaseapi',table_name,'UPDATE')
      or exists(select 1 from unnest(update_contract.allowed_columns) allowed(column_name)
        where not has_column_privilege('zhudatuanpurchaseapi',table_name,allowed.column_name,'UPDATE'))
      or exists(select 1 from pg_catalog.pg_attribute column_definition
        join pg_catalog.pg_class relation on relation.oid=column_definition.attrelid
        join pg_catalog.pg_namespace namespace on namespace.oid=relation.relnamespace
        where namespace.nspname=update_contract.schema_name and relation.relname=update_contract.relation_name
          and column_definition.attnum>0 and not column_definition.attisdropped
          and not column_definition.attname=any(update_contract.allowed_columns)
          and has_column_privilege('zhudatuanpurchaseapi',relation.oid,column_definition.attnum,'UPDATE')) then
      raise exception 'ZHUDATUAN_PURCHASE_UPDATE_COLUMN_BOUNDARY_INVALID:%',table_name;
    end if;
  end loop;
  if not has_function_privilege('zhudatuanpurchaseapi','identity.resolve_session(text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.resolve_membership(text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.resolve_scope(text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.purchase_member_scope(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','benefit.purchase_available(text,text,text[])','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','benefit.purchase_reserve(text,text,text,text,text[],bigint[])','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','benefit.purchase_consume(text,text,text,text,text,bigint)','EXECUTE') then
    raise exception 'ZHUDATUAN_PURCHASE_REQUIRED_FUNCTION_MISSING';
  end if;
  if has_function_privilege('zhudatuanpurchaseapi',
      'finance.post(text,text,text,text,text,text,text,text,text,bigint,timestamp with time zone)','EXECUTE')
    or has_function_privilege('zhudatuanpurchaseapi','finance.ensure_account(text,text,text,text)','EXECUTE') then
    raise exception 'ZHUDATUAN_PURCHASE_FINANCE_BOUNDARY_BYPASS';
  end if;
  if not has_function_privilege('zhudatuanwebapi','benefit.web_ledger(text,text)','EXECUTE')
    or has_schema_privilege('zhudatuanwebapi','finance','USAGE') then
    raise exception 'ZHUDATUAN_WEB_LEDGER_BOUNDARY_INVALID';
  end if;
  if not has_function_privilege('zhudatuansandboxbootstrap',
      'deployment.sandbox_member_qualification_bootstrap(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuansandboxbootstrap',
      'deployment.sandbox_member_welfare_bootstrap(text,text,bigint,text,text)','EXECUTE')
    or has_schema_privilege('zhudatuansandboxbootstrap','benefit','USAGE')
    or has_schema_privilege('zhudatuansandboxbootstrap','finance','USAGE')
    or not has_table_privilege('zhudatuansandboxbootstrap','experience.release','SELECT')
    or not has_table_privilege('zhudatuansandboxbootstrap','experience.release','INSERT')
    or has_table_privilege('zhudatuansandboxbootstrap','experience.release','UPDATE')
    or has_table_privilege('zhudatuansandboxbootstrap','experience.release','DELETE')
    or not has_table_privilege('zhudatuansandboxbootstrap','experience.publication','SELECT')
    or not has_table_privilege('zhudatuansandboxbootstrap','experience.publication','INSERT')
    or has_table_privilege('zhudatuansandboxbootstrap','experience.publication','UPDATE')
    or has_table_privilege('zhudatuansandboxbootstrap','experience.publication','DELETE') then
    raise exception 'ZHUDATUAN_SANDBOX_PUBLICATION_BOUNDARY_INVALID';
  end if;
  if not has_table_privilege('zhudatuanpurchaseapi','pricing.quote','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','pricing.quote','INSERT')
    or not has_table_privilege('zhudatuanpurchaseapi','ordering.orderrecord','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','ordering.orderrecord','INSERT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.intent','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.intent','INSERT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.intenttender','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','payment.intenttender','INSERT')
    or not has_table_privilege('zhudatuanpurchaseapi','runtime.outbox','SELECT')
    or not has_table_privilege('zhudatuanpurchaseapi','runtime.outbox','INSERT')
    or has_table_privilege('zhudatuanpurchaseapi','runtime.outbox','UPDATE')
    or not has_table_privilege('zhudatuanpurchaseapi','runtime.job','INSERT')
    or has_table_privilege('zhudatuanpurchaseapi','runtime.job','SELECT')
    or has_table_privilege('zhudatuanpurchaseapi','runtime.job','UPDATE') then
    raise exception 'ZHUDATUAN_PURCHASE_REQUIRED_PRIVILEGE_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828180000'
    and checksum='0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c') then
    raise exception 'ZHUDATUAN_PURCHASE_SCHEMA_VERSION_MISSING';
  end if;
end
$assert$;

commit;
