begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:public-mall-role-contracts:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260901223000'
      and checksum='3faea44c273fadc91245b9cf8f06361ce492288448ff3a8507d358f9edadfa89')
    or exists(select 1 from runtime.schemaversion where version>'20260901223000') then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from pg_roles where rolname='zhudatuanwebapi')
    or not exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi') then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_ROLE_MISSING';
  end if;
end
$precondition$;

-- The Purchase runtime may assemble a quote without reading identity or
-- membership authority tables directly. The live storefront session remains
-- the sole source of member_id and mall_id.
create or replace function access.purchase_checkout_context(
  p_membership text,p_session text,p_address text,p_invoice text
) returns table(
  id text,member_id text,mall_id text,application_id text,version double precision,
  profile_status text,profile_version double precision,city_code text,
  address_version double precision,address_region text,invoice_version double precision,
  experience_version text,experience_hash text
)
language plpgsql stable security definer
set search_path=access,member,cart,qualification,checkout,invoice,experience,pg_temp
set row_security=off as $function$
begin
  if session_user<>'zhudatuanpurchaseapi' then
    raise exception 'PURCHASE_CHECKOUT_CONTEXT_INVALID';
  end if;
  return query
  select selected.id,selected.member_id,selected.mall_id,selected.application_id,selected.version::float8,
    profile.status::text,qualification.version::float8,qualification.city_code::text,
    address.version::float8,address.region_code::text,invoice.version::float8,
    publication.version_id,publication.content_hash::text
  from access.purchase_session_context(p_membership,p_session,false) context
  join member.profile profile on profile.id=context.member_id and profile.status='active'
  join cart.cart selected on selected.member_id=context.member_id and selected.mall_id=context.mall_id and selected.state='active'
  left join qualification.profile qualification
    on qualification.member_id=profile.id and qualification.scope_id=selected.mall_id
  left join checkout.address address
    on address.id=p_address and address.member_id=profile.id and address.status='active'
  left join invoice.profile invoice
    on invoice.id=p_invoice and invoice.owner_id=profile.id and invoice.status='active'
  left join experience.publication publication
    on publication.application_id=selected.application_id and publication.state='active';
end
$function$;

revoke all on function access.purchase_checkout_context(text,text,text,text) from public,
  anon,authenticated,service_role,shopapp,shopjob,shopread,zhudatuanidentityapi,
  zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant execute on function access.purchase_checkout_context(text,text,text,text) to zhudatuanpurchaseapi;

-- Lock and return the exact quote/cart pair used by PlaceOrder. This replaces
-- its direct dependency on access.membership while preserving serialization.
create or replace function access.purchase_order_quote(
  p_membership text,p_session text,p_quote text
) returns table(
  checkout text,cart_id text,member_id text,mall_id text,application_id text,
  quote_id text,quote_hash text,input jsonb,version double precision,signed_payload jsonb,signature text
)
language plpgsql volatile security definer
set search_path=access,cart,checkout,pricing,pg_temp
set row_security=off as $function$
begin
  if session_user<>'zhudatuanpurchaseapi' then
    raise exception 'PURCHASE_ORDER_QUOTE_INVALID';
  end if;
  return query
  select selected.id,selected.cart_id,selected.member_id,selected.mall_id,selected.application_id,
    selected.quote_id,selected.quote_hash::text,selected.input,selected.version::float8,
    priced.signed_payload,priced.signature::text
  from access.purchase_session_context(p_membership,p_session,true) context
  join checkout.session selected
    on selected.member_id=context.member_id and selected.mall_id=context.mall_id
  join pricing.quote priced on priced.id=selected.quote_id
  join cart.cart owned
    on owned.id=selected.cart_id and owned.member_id=context.member_id and owned.mall_id=context.mall_id
  where selected.quote_id=p_quote and selected.state='quoted' and owned.state='active'
    and selected.expires_at>clock_timestamp() and priced.expires_at>clock_timestamp()
  for update of selected,owned;
end
$function$;

revoke all on function access.purchase_order_quote(text,text,text) from public,
  anon,authenticated,service_role,shopapp,shopjob,shopread,zhudatuanidentityapi,
  zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuansandboxbootstrap;
grant execute on function access.purchase_order_quote(text,text,text) to zhudatuanpurchaseapi;

-- The business role matrix intentionally removed direct membership reads and
-- EXECUTE on web_member_allowed. Keep cart/address/benefit policies aligned
-- with the surviving scoped projection.
drop policy if exists zhudatuanwebapi on cart.cart;
create policy zhudatuanwebapi on cart.cart for all to zhudatuanwebapi
  using(access.web_scope_allowed(member_id) and access.web_scope_allowed(mall_id))
  with check(access.web_scope_allowed(member_id) and access.web_scope_allowed(mall_id)
    and exists(select 1 from experience.application application
      where application.id=application_id and application.scope_id=mall_id and application.status='active'));

drop policy if exists zhudatuanwebapi on cart.item;
create policy zhudatuanwebapi on cart.item for all to zhudatuanwebapi
  using(exists(select 1 from cart.cart cart
    where cart.id=cart_id and access.web_scope_allowed(cart.member_id) and access.web_scope_allowed(cart.mall_id)))
  with check(exists(select 1 from cart.cart cart
    where cart.id=cart_id and access.web_scope_allowed(cart.member_id) and access.web_scope_allowed(cart.mall_id)));

drop policy if exists zhudatuanwebapi on checkout.address;
create policy zhudatuanwebapi on checkout.address for all to zhudatuanwebapi
  using(access.web_scope_allowed(member_id))
  with check(access.web_scope_allowed(member_id));

drop policy if exists zhudatuanwebapi on benefit.account;
create policy zhudatuanwebapi on benefit.account for select to zhudatuanwebapi
  using(access.web_scope_allowed(member_id) and access.web_scope_allowed(scope_id));

drop policy if exists zhudatuanwebapi on benefit.lot;
create policy zhudatuanwebapi on benefit.lot for select to zhudatuanwebapi
  using(exists(select 1 from benefit.account account
    where account.id=account_id and access.web_scope_allowed(account.member_id)
      and access.web_scope_allowed(account.scope_id)));

-- Purchase was originally restricted to welfare-balance tenders. A public
-- Mall Core order may instead contain one WeChat cash leg, or a mixed
-- benefit/WeChat plan. Voucher use remains outside this runtime boundary.
drop policy if exists zhudatuanpurchaseapiinsert on pricing.quote;
create policy zhudatuanpurchaseapiinsert on pricing.quote for insert to zhudatuanpurchaseapi
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and currency='CNY'
    and signed_payload#>>'{cart,member}'=member_id and signed_payload#>>'{cart,mall}'=mall_id
    and signed_payload->>'currency'='CNY'
    and jsonb_typeof(signed_payload->'personalMinor')='number'
    and (signed_payload->>'personalMinor')::numeric>=0
    and jsonb_typeof(signed_payload->'tenders')='array' and jsonb_array_length(signed_payload->'tenders')>0
    and not exists(select 1 from jsonb_array_elements(signed_payload->'tenders') tender
      where tender->>'kind' not in('benefit','wechat')
        or (tender->>'kind'='benefit' and tender->>'reference' is null)
        or (tender->>'kind'='wechat' and tender->'reference' is distinct from 'null'::jsonb)
        or jsonb_typeof(tender->'amountMinor') is distinct from 'number'
        or (tender->>'amountMinor')::numeric<=0)
    and expires_at>clock_timestamp() and expires_at<=clock_timestamp()+interval '20 minutes');

drop policy if exists zhudatuanpurchaseapiinsert on checkout.session;
create policy zhudatuanpurchaseapiinsert on checkout.session for insert to zhudatuanpurchaseapi
  with check(access.purchase_member_mall_allowed(member_id,mall_id) and state='quoted'
    and access.purchase_application_allowed(application_id) and access.purchase_quote_allowed(quote_id)
    and jsonb_typeof(input->'vouchers')='array' and jsonb_array_length(input->'vouchers')=0
    and jsonb_typeof(input->'benefits')='array');

drop policy if exists zhudatuanpurchaseapiinsert on ordering.orderrecord;
create policy zhudatuanpurchaseapiinsert on ordering.orderrecord for insert to zhudatuanpurchaseapi
  with check(scope_id=mall_id and access.purchase_member_mall_allowed(member_id,mall_id)
    and access.purchase_checkout_allowed(checkout_id) and currency='CNY' and total_minor>0
    and payment_state='unpaid' and fulfillment_state='unallocated' and aftersale_state='none' and lifecycle_state='created'
    and jsonb_typeof(evidence->'tenders')='array' and jsonb_array_length(evidence->'tenders')>0
    and not exists(select 1 from jsonb_array_elements(evidence->'tenders') tender
      where tender->>'kind' not in('benefit','wechat')
        or (tender->>'kind'='benefit' and tender->>'reference' is null)
        or (tender->>'kind'='wechat' and tender->'reference' is distinct from 'null'::jsonb))
    and jsonb_typeof(evidence#>'{selection,vouchers}')='array'
    and jsonb_array_length(evidence#>'{selection,vouchers}')=0);

drop policy if exists zhudatuanpurchaseapiselect on payment.intenttender;
create policy zhudatuanpurchaseapiselect on payment.intenttender for select to zhudatuanpurchaseapi
  using(access.purchase_intent_allowed(intent_id) and (
    (kind='benefit' and access.purchase_benefit_account_allowed(reference_id))
    or (kind='wechat' and reference_id is null)
  ));

drop policy if exists zhudatuanpurchaseapiinsert on payment.intenttender;
create policy zhudatuanpurchaseapiinsert on payment.intenttender for insert to zhudatuanpurchaseapi
  with check(access.purchase_intent_allowed(intent_id) and (
    (kind='benefit' and state='held' and access.purchase_benefit_account_allowed(reference_id))
    or (kind='wechat' and state='planned' and reference_id is null)
  ));

insert into runtime.schemaversion(version,checksum)
values('20260902010000','59b76d9a5e3b0e9ff8f6837bdfab4e93936a80645cab2e88cf9342f530bafbd3');

do $assert$
begin
  if (select count(*) from pg_policy policy
      join pg_class relation on relation.oid=policy.polrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname='zhudatuanwebapi'
        and (namespace.nspname,relation.relname) in(
          ('cart','cart'),('cart','item'),('checkout','address'),('benefit','account'),('benefit','lot')
        ))<>5 then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_POLICY_COUNT_INVALID';
  end if;
  if exists(select 1 from pg_policy policy
      join pg_class relation on relation.oid=policy.polrelid
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where policy.polname='zhudatuanwebapi'
        and (namespace.nspname,relation.relname) in(
          ('cart','cart'),('cart','item'),('checkout','address'),('benefit','account'),('benefit','lot')
        ) and (coalesce(pg_get_expr(policy.polqual,policy.polrelid),'')
          ||coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),'')) like '%web_member_allowed%') then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_FORBIDDEN_HELPER_RETAINED';
  end if;
  if has_table_privilege('zhudatuanwebapi','access.membership','SELECT')
    or has_function_privilege('zhudatuanwebapi','access.web_member_allowed(text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.web_scope_allowed(text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.purchase_checkout_context(text,text,text,text)','EXECUTE')
    or has_function_privilege('public','access.purchase_checkout_context(text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.purchase_order_quote(text,text,text)','EXECUTE')
    or has_function_privilege('public','access.purchase_order_quote(text,text,text)','EXECUTE') then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_AUTHORITY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902010000'
      and checksum='59b76d9a5e3b0e9ff8f6837bdfab4e93936a80645cab2e88cf9342f530bafbd3') then
    raise exception 'PUBLIC_MALL_ROLE_CONTRACT_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
