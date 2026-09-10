begin;

-- The public web business runtime and the one-shot sandbox catalog seed do
-- not inherit the broad shopapp role. LOGIN/password provisioning remains an
-- infrastructure responsibility so this migration never manages credentials.
do $database_roles$
declare role_name text;
begin
  foreach role_name in array array['zhudatuanwebapi','zhudatuansandboxbootstrap'] loop
    if not exists(select 1 from pg_roles where rolname=role_name) then
      if not coalesce((select rolcreaterole or rolsuper from pg_roles where rolname=current_user),false) then
        raise exception 'ZHUDATUAN_DATABASE_ROLE_PREPROVISION_REQUIRED:%',role_name;
      end if;
      execute format('create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls',role_name);
    end if;
    if exists(select 1 from pg_roles where rolname=role_name
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
      raise exception 'ZHUDATUAN_DATABASE_ROLE_UNSAFE:%',role_name;
    end if;
  end loop;
end
$database_roles$;

-- The sandbox seed has its own boundary predicate. Keep the relation lookup
-- dynamic so canonical schema replay remains possible without environment
-- bootstrap state, while a real seed still requires the independent database
-- sentinel created by postgres-init-registration.sh.
create or replace function deployment.sandbox_catalog_bootstrap_boundary(p_sentinel text)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,deployment,public
set row_security=off as $function$
declare valid boolean:=false;
begin
  if current_database()<>'zhudatuan_registration'
    or session_user<>'zhudatuansandboxbootstrap'
    or to_regclass('deployment.boundary') is null then
    return false;
  end if;
  execute $query$
    select exists(select 1 from deployment.boundary
      where id='zhudatuan-registration-v1' and database_name=current_database()
        and sentinel_hash=encode(public.digest($1,'sha256'),'hex'))
  $query$ into valid using p_sentinel;
  return coalesce(valid,false);
end
$function$;
revoke all on function deployment.sandbox_catalog_bootstrap_boundary(text) from public,anon,authenticated,service_role,
  shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuanwebapi;

-- RLS helpers are deliberately narrower than access.scope_allowed. A
-- storefront membership may operate only on its member and mall scopes;
-- operator memberships may traverse only the scope already resolved by the
-- AccessPipeline.
create or replace function access.web_member_allowed(p_member text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select p_member is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.member_id=p_member and membership.status='active'
  )
$function$;

-- The canonical resource resolver does not have an owner branch for the
-- profile/address operation ids. This narrowly resolves those operations to
-- the active membership's member and cannot be used through SET ROLE.
create or replace function access.web_member_scope(p_membership text,p_session text)
returns jsonb language plpgsql stable security definer
set search_path=identity,access,member,pg_temp
set row_security=off as $function$
declare resolved jsonb;
begin
  if session_user<>'zhudatuanwebapi' then
    raise exception 'WEB_MEMBER_SCOPE_MEMBERSHIP_INVALID';
  end if;
  select access.scope_object(membership.member_id) into resolved
  from identity.session session
  join access.membership membership on membership.id=session.membership_id and session.client=membership.client
  join member.profile profile on profile.id=membership.member_id and profile.principal_id=session.principal_id
  join identity.principal principal on principal.id=session.principal_id
  where session.id=p_session and session.membership_id=p_membership
    and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version
    and session.access_version=membership.access_version
    and principal.status='active' and profile.status='active' and membership.status='active';
  if resolved is null or resolved->>'kind'<>'owner' then
    raise exception 'WEB_MEMBER_SCOPE_NOT_FOUND';
  end if;
  return resolved;
end
$function$;

-- Member-audience offer reads need the active mall, not the owner scope
-- returned by the canonical audience resolver. This helper is intentionally
-- unavailable to operator sessions or cross-membership/session pairs.
create or replace function access.web_storefront_scope(p_membership text,p_session text)
returns jsonb language plpgsql stable security definer
set search_path=identity,access,member,organization,pg_temp
set row_security=off as $function$
declare resolved jsonb;
begin
  if session_user<>'zhudatuanwebapi' then
    raise exception 'WEB_STOREFRONT_SCOPE_MEMBERSHIP_INVALID';
  end if;
  select access.scope_object(membership.organization_id) into resolved
  from identity.session session
  join access.membership membership on membership.id=session.membership_id
    and membership.client='storefront' and session.client=membership.client
  join member.profile profile on profile.id=membership.member_id and profile.principal_id=session.principal_id
  join identity.principal principal on principal.id=session.principal_id
  join organization.organization organization on organization.id=membership.organization_id
    and organization.kind='mall' and organization.status='active'
  where session.id=p_session and session.membership_id=p_membership
    and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version
    and session.access_version=membership.access_version
    and principal.status='active' and profile.status='active' and membership.status='active';
  if resolved is null or resolved->>'kind'<>'mall' then
    raise exception 'WEB_STOREFRONT_SCOPE_NOT_FOUND';
  end if;
  return resolved;
end
$function$;

create or replace function access.web_scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select p_scope is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and p_scope in(membership.member_id,membership.organization_id))
        or (membership.client<>'storefront' and access.scope_allowed(p_scope)))
  )
$function$;

-- Risk policy evaluation may read the active mall's organization ancestors,
-- but this broader hierarchy visibility is never reused by business tables.
create or replace function access.web_risk_scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,organization,pg_temp as $function$
  select p_scope is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and (
          p_scope=membership.member_id or exists(
            select 1 from organization.unitclosure closure
            where closure.descendant_id=membership.organization_id and closure.ancestor_id=p_scope
          )
        )) or (membership.client='operator' and access.scope_allowed(p_scope)))
  )
$function$;

create or replace function access.web_order_allowed(p_member text,p_mall text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and membership.member_id=p_member and membership.organization_id=p_mall)
        or (membership.client='operator' and access.scope_allowed(p_mall)))
  )
$function$;

create or replace function access.web_audit_scope_allowed(p_scope text)
returns boolean language sql stable security definer
set search_path=access,pg_temp as $function$
  select p_scope is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and p_scope=membership.member_id)
        or (membership.client='operator' and access.scope_allowed(p_scope)))
  )
$function$;

-- benefit.balance is a security-invoker view over Finance. Expose the
-- authoritative account balances needed by benefit.accounts.read without granting the
-- web role any privilege on finance.account/journal/entry.
create or replace function benefit.web_account_balance(p_membership text,p_session text)
returns table(account_id text,available_minor bigint,reserved_minor bigint)
language plpgsql stable security definer
set search_path=identity,access,member,benefit,finance,pg_temp
set row_security=off as $function$
declare owned_member text; owned_scope text;
begin
  if session_user<>'zhudatuanwebapi' then
    raise exception 'WEB_BENEFIT_MEMBERSHIP_INVALID';
  end if;
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
  if owned_member is null or owned_scope is null then
    raise exception 'WEB_BENEFIT_MEMBERSHIP_INVALID';
  end if;
  return query
  with owned as(
    select account.id,account.finance_account_id from benefit.account account
    where account.member_id=owned_member and account.scope_id=owned_scope and account.status<>'closed'
  ), ledger as(
    select owned.id,coalesce(sum(case when entry.side='credit' then entry.amount_minor else -entry.amount_minor end)
      filter(where journal.state='posted'),0)::bigint balance_minor
    from owned left join finance.entry entry on entry.account_id=owned.finance_account_id
    left join finance.journal journal on journal.id=entry.journal_id group by owned.id
  ), reserved as(
    select owned.id,coalesce(sum(reservation.amount_minor) filter(where reservation.state='active'
      and reservation.expires_at>clock_timestamp()),0)::bigint amount
    from owned left join benefit.reservation reservation on reservation.account_id=owned.id group by owned.id
  ), spendable as(
    select owned.id,coalesce(sum(lot.remaining_minor) filter(where lot.state='active'
      and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0)::bigint amount
    from owned left join benefit.lot lot on lot.account_id=owned.id group by owned.id
  )
  select owned.id,greatest(0,least(ledger.balance_minor,spendable.amount)-reserved.amount)::bigint,reserved.amount
  from owned join ledger on ledger.id=owned.id join reserved on reserved.id=owned.id join spendable on spendable.id=owned.id;
end
$function$;

revoke all on function access.web_member_allowed(text),access.web_member_scope(text,text),access.web_storefront_scope(text,text),
  access.web_scope_allowed(text),access.web_order_allowed(text,text),
  access.web_risk_scope_allowed(text),access.web_audit_scope_allowed(text),benefit.web_account_balance(text,text)
  from public,anon,authenticated,service_role,
  shopapp,shopjob,shopread,zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuansandboxbootstrap;

grant usage on schema public,identity,access,capability,member,organization,runtime,risk,audit,reporting,catalog,pricing,
  inventory,experience,cart,checkout,benefit,ordering,fulfillment to zhudatuanwebapi;
grant select on runtime.schemaversion,runtime.idempotency to zhudatuanwebapi;
grant insert,update on runtime.idempotency to zhudatuanwebapi;
grant select on access.membership to zhudatuanwebapi;
grant select,insert on access.decisionaudit to zhudatuanwebapi;
grant select on member.profile to zhudatuanwebapi;
grant select on organization.organization,organization.unitclosure to zhudatuanwebapi;
grant select on risk.policy,risk.policyversion,risk.signal,risk.listentry to zhudatuanwebapi;
grant select,insert on audit.record,audit.accessrecord to zhudatuanwebapi;
grant select on audit.archiveref to zhudatuanwebapi;
grant select on reporting.metric,reporting.fact to zhudatuanwebapi;
grant select on catalog.product,catalog.sku,catalog.listing,catalog.sourcelisting to zhudatuanwebapi;
grant select on pricing.pricebook,pricing.price to zhudatuanwebapi;
grant select on inventory.stockitem,inventory.reservation to zhudatuanwebapi;
grant select on experience.application to zhudatuanwebapi;
grant select,insert,update on cart.cart to zhudatuanwebapi;
grant select,insert,update,delete on cart.item to zhudatuanwebapi;
grant select,insert,update on checkout.address to zhudatuanwebapi;
grant select on benefit.account,benefit.lot to zhudatuanwebapi;
grant select on ordering.orderrecord,ordering.line,ordering.aftersale to zhudatuanwebapi;
grant select on fulfillment.fulfillmentorder to zhudatuanwebapi;
grant execute on function identity.resolve_session(text),access.resolve_membership(text),access.membership_version(text),
  access.resolve_scope(text,text,text),
  access.web_member_allowed(text),access.web_member_scope(text,text),access.web_storefront_scope(text,text),
  access.web_scope_allowed(text),access.web_order_allowed(text,text),
  access.web_risk_scope_allowed(text),access.web_audit_scope_allowed(text),capability.membership_operations(text),
  reporting.cockpit(text),benefit.web_account_balance(text,text),public.digest(text,text) to zhudatuanwebapi;

-- Runtime control and authorization.
create policy zhudatuanwebapi on runtime.schemaversion for select to zhudatuanwebapi
  using(version in('20260821032000','20260821054000','20260828170000','20260828173000'));
create policy zhudatuanwebapiselect on runtime.idempotency for select to zhudatuanwebapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope));
create policy zhudatuanwebapiinsert on runtime.idempotency for insert to zhudatuanwebapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope)
    and state='started' and response is null);
create policy zhudatuanwebapiupdate on runtime.idempotency for update to zhudatuanwebapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope))
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope)
    and state in('completed','failed'));
create policy zhudatuanwebapi on access.membership for select to zhudatuanwebapi
  using(id=nullif(current_setting('app.membership_id',true),'') and status='active');
create policy zhudatuanwebapiselect on access.decisionaudit for select to zhudatuanwebapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_risk_scope_allowed(scope_id));
create policy zhudatuanwebapiinsert on access.decisionaudit for insert to zhudatuanwebapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'')
    and (scope_id is null or access.web_scope_allowed(scope_id)));

-- Member, organization and risk reads stay bound to the AccessPipeline
-- membership context. Risk evaluation is read-only; there is intentionally no
-- risk mutation, runtime.outbox or runtime.job privilege.
create policy zhudatuanwebapi on member.profile for select to zhudatuanwebapi using(access.web_member_allowed(id));
create policy zhudatuanwebapi on organization.organization for select to zhudatuanwebapi using(access.web_scope_allowed(id));
create policy zhudatuanwebapi on organization.unitclosure for select to zhudatuanwebapi
  using(access.web_scope_allowed(ancestor_id) or access.web_scope_allowed(descendant_id));
create policy zhudatuanwebapi on risk.policy for select to zhudatuanwebapi using(access.web_risk_scope_allowed(scope_id));
create policy zhudatuanwebapi on risk.policyversion for select to zhudatuanwebapi
  using(exists(select 1 from risk.policy policy where policy.id=policy_id));
create policy zhudatuanwebapi on risk.signal for select to zhudatuanwebapi
  using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_risk_scope_allowed(scope_id));
create policy zhudatuanwebapi on risk.listentry for select to zhudatuanwebapi
  using(access.web_risk_scope_allowed(scope_id)
    and token=encode(public.digest(nullif(current_setting('app.actor_id',true),''),'sha256'),'hex'));

-- Audit is append-only. Storefront commands use the member scope; operator
-- access records remain constrained to the resolved organization scope.
create policy zhudatuanwebapiselect on audit.record for select to zhudatuanwebapi
  using(access.web_audit_scope_allowed(scope_id));
create policy zhudatuanwebapiinsert on audit.record for insert to zhudatuanwebapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope_id));
create policy zhudatuanwebapiselect on audit.accessrecord for select to zhudatuanwebapi
  using(access.web_audit_scope_allowed(scope_id));
create policy zhudatuanwebapiinsert on audit.accessrecord for insert to zhudatuanwebapi
  with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope_id));
create policy zhudatuanwebapi on audit.archiveref for select to zhudatuanwebapi
  using(access.web_audit_scope_allowed(scope_id));

-- Selected read models.
create policy zhudatuanwebapi on reporting.metric for select to zhudatuanwebapi using(true);
create policy zhudatuanwebapi on reporting.fact for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on catalog.listing for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on catalog.sourcelisting for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on catalog.sku for select to zhudatuanwebapi using(exists(
  select 1 from catalog.listing listing where listing.sku_id=catalog.sku.id and access.web_scope_allowed(listing.scope_id)
  ) or exists(
  select 1 from catalog.sourcelisting source where source.sku_id=catalog.sku.id and access.web_scope_allowed(source.scope_id)
));
create policy zhudatuanwebapi on catalog.product for select to zhudatuanwebapi using(exists(
  select 1 from catalog.sku sku join catalog.listing listing on listing.sku_id=sku.id
  where sku.product_id=catalog.product.id and access.web_scope_allowed(listing.scope_id)
  ) or exists(
  select 1 from catalog.sku sku join catalog.sourcelisting source on source.sku_id=sku.id
  where sku.product_id=catalog.product.id and access.web_scope_allowed(source.scope_id)
));
create policy zhudatuanwebapi on pricing.pricebook for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on pricing.price for select to zhudatuanwebapi using(exists(
  select 1 from pricing.pricebook book where book.id=book_id and access.web_scope_allowed(book.scope_id)
));
create policy zhudatuanwebapi on inventory.stockitem for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on inventory.reservation for select to zhudatuanwebapi using(exists(
  select 1 from inventory.stockitem stock where stock.id=stockitem_id and access.web_scope_allowed(stock.scope_id)
));
create policy zhudatuanwebapi on experience.application for select to zhudatuanwebapi using(access.web_scope_allowed(scope_id));

-- The only customer-data mutations in this profile are addresses and carts.
create policy zhudatuanwebapi on cart.cart for all to zhudatuanwebapi
  using(access.web_member_allowed(member_id) and exists(
    select 1 from access.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.organization_id=mall_id and membership.status='active'
  )) with check(access.web_member_allowed(member_id) and exists(
    select 1 from access.membership membership where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.organization_id=mall_id and membership.status='active'
  ) and exists(select 1 from experience.application application
    where application.id=application_id and application.scope_id=mall_id and application.status='active'));
create policy zhudatuanwebapi on cart.item for all to zhudatuanwebapi using(exists(
  select 1 from cart.cart cart where cart.id=cart_id and access.web_member_allowed(cart.member_id)
)) with check(exists(
  select 1 from cart.cart cart where cart.id=cart_id and access.web_member_allowed(cart.member_id)
));
create policy zhudatuanwebapi on checkout.address for all to zhudatuanwebapi
  using(access.web_member_allowed(member_id)) with check(access.web_member_allowed(member_id));

create policy zhudatuanwebapi on benefit.account for select to zhudatuanwebapi
  using(access.web_member_allowed(member_id) and access.web_scope_allowed(scope_id));
create policy zhudatuanwebapi on benefit.lot for select to zhudatuanwebapi using(exists(
  select 1 from benefit.account account where account.id=account_id and access.web_member_allowed(account.member_id)
));

create policy zhudatuanwebapi on ordering.orderrecord for select to zhudatuanwebapi
  using(access.web_order_allowed(member_id,mall_id));
create policy zhudatuanwebapi on ordering.line for select to zhudatuanwebapi using(exists(
  select 1 from ordering.orderrecord orders where orders.id=order_id and access.web_order_allowed(orders.member_id,orders.mall_id)
));
create policy zhudatuanwebapi on ordering.aftersale for select to zhudatuanwebapi using(exists(
  select 1 from ordering.orderrecord orders where orders.id=order_id and access.web_order_allowed(orders.member_id,orders.mall_id)
));
create policy zhudatuanwebapi on fulfillment.fulfillmentorder for select to zhudatuanwebapi
  using(partner_id=nullif(current_setting('app.scope_id',true),'') or store_id=nullif(current_setting('app.scope_id',true),''));

-- The sandbox catalog role is insert-only, fixed-ID and usable only against
-- the independent zhudatuan registration database boundary.
grant usage on schema public,deployment,runtime,organization,catalog,pricing,inventory,experience,audit to zhudatuansandboxbootstrap;
grant select on runtime.schemaversion,organization.organization,catalog.category,catalog.product,catalog.sku,catalog.pool,
  catalog.poolitem,catalog.poolbinding,catalog.listing,pricing.pricebook,pricing.price,inventory.stockitem,
  experience.application,experience.version,experience.binding,audit.record,audit.accessrecord,audit.archiveref to zhudatuansandboxbootstrap;
grant insert on catalog.category,catalog.product,catalog.sku,catalog.pool,catalog.poolitem,catalog.poolbinding,catalog.listing,
  pricing.pricebook,pricing.price,inventory.stockitem,experience.application,experience.version,experience.binding,audit.record
  to zhudatuansandboxbootstrap;
grant execute on function deployment.sandbox_catalog_bootstrap_boundary(text),public.digest(text,text) to zhudatuansandboxbootstrap;

create policy zhudatuansandboxbootstrap on runtime.schemaversion for select to zhudatuansandboxbootstrap
  using(version in('20260828170000','20260828173000'));
create policy zhudatuansandboxbootstrap on organization.organization for select to zhudatuansandboxbootstrap
  using(id='mall-zhudatuan' and kind='mall' and status='active');
create policy zhudatuansandboxbootstrap on catalog.category for select to zhudatuansandboxbootstrap
  using(id='category:zhudatuan:sandbox');
create policy zhudatuansandboxbootstrapinsert on catalog.category for insert to zhudatuansandboxbootstrap
  with check(id='category:zhudatuan:sandbox' and code='ZHUDATUAN_SANDBOX' and status='active');
create policy zhudatuansandboxbootstrap on catalog.product for select to zhudatuansandboxbootstrap
  using(id='product:zhudatuan:sandbox:welcome');
create policy zhudatuansandboxbootstrapinsert on catalog.product for insert to zhudatuansandboxbootstrap
  with check(id='product:zhudatuan:sandbox:welcome' and owner_partner_id is null and brand_id is null
    and category_id='category:zhudatuan:sandbox' and product_type='physical' and status='active'
    and attributes->>'sandbox'='true');
create policy zhudatuansandboxbootstrap on catalog.sku for select to zhudatuansandboxbootstrap
  using(id='sku:zhudatuan:sandbox:welcome');
create policy zhudatuansandboxbootstrapinsert on catalog.sku for insert to zhudatuansandboxbootstrap
  with check(id='sku:zhudatuan:sandbox:welcome' and product_id='product:zhudatuan:sandbox:welcome'
    and code='ZHUDATUAN-SANDBOX-WELCOME' and status='active');
create policy zhudatuansandboxbootstrap on catalog.pool for select to zhudatuansandboxbootstrap
  using(id='pool:zhudatuan:sandbox' and scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on catalog.pool for insert to zhudatuansandboxbootstrap
  with check(id='pool:zhudatuan:sandbox' and scope_id='mall-zhudatuan' and kind='private' and status='active');
create policy zhudatuansandboxbootstrap on catalog.poolitem for select to zhudatuansandboxbootstrap
  using(pool_id='pool:zhudatuan:sandbox' and sku_id='sku:zhudatuan:sandbox:welcome');
create policy zhudatuansandboxbootstrapinsert on catalog.poolitem for insert to zhudatuansandboxbootstrap
  with check(pool_id='pool:zhudatuan:sandbox' and sku_id='sku:zhudatuan:sandbox:welcome'
    and state='included' and source_version='sandbox:v1');
create policy zhudatuansandboxbootstrap on catalog.poolbinding for select to zhudatuansandboxbootstrap
  using(mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox');
create policy zhudatuansandboxbootstrapinsert on catalog.poolbinding for insert to zhudatuansandboxbootstrap
  with check(mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox' and listing_kind='selected' and status='active');
create policy zhudatuansandboxbootstrap on catalog.listing for select to zhudatuansandboxbootstrap
  using(id='listing:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on catalog.listing for insert to zhudatuansandboxbootstrap
  with check(id='listing:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan'
    and pool_id='pool:zhudatuan:sandbox' and sku_id='sku:zhudatuan:sandbox:welcome' and status='published');
create policy zhudatuansandboxbootstrap on pricing.pricebook for select to zhudatuansandboxbootstrap
  using(id='pricebook:zhudatuan:sandbox' and scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on pricing.pricebook for insert to zhudatuansandboxbootstrap
  with check(id='pricebook:zhudatuan:sandbox' and scope_id='mall-zhudatuan' and currency='CNY' and status='active');
create policy zhudatuansandboxbootstrap on pricing.price for select to zhudatuansandboxbootstrap
  using(id='price:zhudatuan:sandbox:welcome');
create policy zhudatuansandboxbootstrapinsert on pricing.price for insert to zhudatuansandboxbootstrap
  with check(id='price:zhudatuan:sandbox:welcome' and book_id='pricebook:zhudatuan:sandbox'
    and sku_id='sku:zhudatuan:sandbox:welcome' and amount_minor=100 and compare_minor=100);
create policy zhudatuansandboxbootstrap on inventory.stockitem for select to zhudatuansandboxbootstrap
  using(id='stock:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on inventory.stockitem for insert to zhudatuansandboxbootstrap
  with check(id='stock:zhudatuan:sandbox:welcome' and scope_id='mall-zhudatuan'
    and sku_id='sku:zhudatuan:sandbox:welcome' and location_id='sandbox:main' and onhand=100 and safety=0 and status='active');
create policy zhudatuansandboxbootstrap on experience.application for select to zhudatuansandboxbootstrap
  using(id='application:zhudatuan:sandbox:v1' and scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on experience.application for insert to zhudatuansandboxbootstrap
  with check(id='application:zhudatuan:sandbox:v1' and scope_id='mall-zhudatuan' and code='ZHUDATUAN_SANDBOX'
    and public_slug='zhudatuan-sandbox' and status='active' and head_version_id='version:zhudatuan:sandbox:v1');
create policy zhudatuansandboxbootstrap on experience.version for select to zhudatuansandboxbootstrap
  using(id='version:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1');
create policy zhudatuansandboxbootstrapinsert on experience.version for insert to zhudatuansandboxbootstrap
  with check(id='version:zhudatuan:sandbox:v1' and application_id='application:zhudatuan:sandbox:v1'
    and sequence=1 and schema_version='2' and validation_state='valid' and created_by='sandbox-bootstrap');
create policy zhudatuansandboxbootstrap on experience.binding for select to zhudatuansandboxbootstrap
  using(application_id='application:zhudatuan:sandbox:v1' and domain='sandbox.zhudatuan.invalid');
create policy zhudatuansandboxbootstrapinsert on experience.binding for insert to zhudatuansandboxbootstrap
  with check(application_id='application:zhudatuan:sandbox:v1' and domain='sandbox.zhudatuan.invalid'
    and mall_id='mall-zhudatuan' and pool_id='pool:zhudatuan:sandbox');
create policy zhudatuansandboxbootstrap on audit.record for select to zhudatuansandboxbootstrap
  using(scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrapinsert on audit.record for insert to zhudatuansandboxbootstrap
  with check(id='audit:zhudatuan:sandbox-catalog:v1' and scope_id='mall-zhudatuan'
    and actor_id='sandbox-bootstrap' and action='catalog.sandbox.bootstrapped'
    and resource_id='application:zhudatuan:sandbox:v1');
create policy zhudatuansandboxbootstrap on audit.accessrecord for select to zhudatuansandboxbootstrap
  using(scope_id='mall-zhudatuan');
create policy zhudatuansandboxbootstrap on audit.archiveref for select to zhudatuansandboxbootstrap
  using(scope_id='mall-zhudatuan');

insert into runtime.schemaversion(version,checksum)
values('20260828173000','2eaef6eba438f8ed4050547dfacff5f684b0fd2f1f74f38098c6a9913638ac59')
on conflict(version) do nothing;

do $assert$
declare table_name text;
begin
  if exists(select 1 from pg_roles where rolname in('zhudatuanwebapi','zhudatuansandboxbootstrap')
    and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then
    raise exception 'ZHUDATUAN_WEB_ROLE_UNSAFE';
  end if;
  if exists(select 1 from pg_auth_members membership
    where membership.member in(select oid from pg_roles where rolname in('zhudatuanwebapi','zhudatuansandboxbootstrap'))
      or (membership.roleid in(select oid from pg_roles where rolname in('zhudatuanwebapi','zhudatuansandboxbootstrap'))
        and not (membership.member=(select oid from pg_roles where rolname='postgres')
          and membership.grantor=(select oid from pg_roles where rolname='supabase_admin')
          and membership.admin_option and not membership.inherit_option and not membership.set_option))) then
    raise exception 'ZHUDATUAN_WEB_ROLE_INHERITS_BROAD_RUNTIME';
  end if;
  foreach table_name in array array['identity.session','checkout.session','checkout.evidence','organization.organization',
    'organization.unitclosure','member.profile','access.membership','risk.policy','risk.policyversion','risk.signal','risk.decision',
    'risk.listentry','risk.case','reporting.metric','reporting.fact','catalog.product','catalog.sku','catalog.listing',
    'catalog.sourcelisting','pricing.pricebook','pricing.price','inventory.stockitem','inventory.reservation',
    'experience.application','benefit.account','benefit.reservation','benefit.lot','ordering.orderrecord','ordering.line',
    'ordering.aftersale','fulfillment.fulfillmentorder','payment.intent','payment.payment','finance.account','finance.journal',
    'finance.entry','runtime.projectionoffset','runtime.outbox','runtime.job'] loop
    if has_table_privilege('zhudatuanwebapi',table_name,'INSERT')
      or has_table_privilege('zhudatuanwebapi',table_name,'UPDATE')
      or has_table_privilege('zhudatuanwebapi',table_name,'DELETE') then
      raise exception 'ZHUDATUAN_WEB_FORBIDDEN_WRITE:%',table_name;
    end if;
  end loop;
  foreach table_name in array array['identity.session','checkout.session','checkout.evidence','benefit.balance','benefit.reservation',
    'risk.decision',
    'payment.intent','payment.payment','finance.account','finance.journal','finance.entry','runtime.outbox','runtime.job'] loop
    if has_table_privilege('zhudatuanwebapi',table_name,'SELECT') then
      raise exception 'ZHUDATUAN_WEB_FORBIDDEN_READ:%',table_name;
    end if;
  end loop;
  if has_schema_privilege('zhudatuanwebapi','finance','USAGE')
    or has_schema_privilege('zhudatuanwebapi','payment','USAGE')
    or has_schema_privilege('zhudatuanwebapi','channel','USAGE')
    or has_schema_privilege('zhudatuanwebapi','extension','USAGE') then
    raise exception 'ZHUDATUAN_WEB_FORBIDDEN_DOMAIN_ACCESS';
  end if;
  foreach table_name in array array['catalog.category','catalog.product','catalog.sku','catalog.pool','catalog.poolitem',
    'catalog.poolbinding','catalog.listing','pricing.pricebook','pricing.price','inventory.stockitem',
    'experience.application','experience.version','experience.binding','audit.record'] loop
    if not has_table_privilege('zhudatuansandboxbootstrap',table_name,'SELECT')
      or not has_table_privilege('zhudatuansandboxbootstrap',table_name,'INSERT')
      or has_table_privilege('zhudatuansandboxbootstrap',table_name,'UPDATE')
      or has_table_privilege('zhudatuansandboxbootstrap',table_name,'DELETE') then
      raise exception 'ZHUDATUAN_SANDBOX_BOOTSTRAP_TABLE_PRIVILEGE_INVALID:%',table_name;
    end if;
  end loop;
  if has_schema_privilege('zhudatuansandboxbootstrap','finance','USAGE')
    or has_schema_privilege('zhudatuansandboxbootstrap','payment','USAGE')
    or has_schema_privilege('zhudatuansandboxbootstrap','ordering','USAGE')
    or has_schema_privilege('zhudatuansandboxbootstrap','benefit','USAGE')
    or not has_function_privilege('zhudatuansandboxbootstrap','deployment.sandbox_catalog_bootstrap_boundary(text)','EXECUTE') then
    raise exception 'ZHUDATUAN_SANDBOX_BOOTSTRAP_BOUNDARY_INVALID';
  end if;
  if not has_function_privilege('zhudatuanwebapi','identity.resolve_session(text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.resolve_membership(text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.resolve_scope(text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.web_member_scope(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.web_storefront_scope(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.web_risk_scope_allowed(text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','capability.membership_operations(text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','benefit.web_account_balance(text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','reporting.cockpit(text)','EXECUTE') then
    raise exception 'ZHUDATUAN_WEB_REQUIRED_FUNCTION_MISSING';
  end if;
  if not has_table_privilege('zhudatuanwebapi','checkout.address','SELECT')
    or not has_table_privilege('zhudatuanwebapi','checkout.address','INSERT')
    or not has_table_privilege('zhudatuanwebapi','checkout.address','UPDATE')
    or not has_table_privilege('zhudatuanwebapi','cart.cart','SELECT')
    or not has_table_privilege('zhudatuanwebapi','cart.cart','INSERT')
    or not has_table_privilege('zhudatuanwebapi','cart.cart','UPDATE')
    or not has_table_privilege('zhudatuanwebapi','cart.item','SELECT')
    or not has_table_privilege('zhudatuanwebapi','cart.item','INSERT')
    or not has_table_privilege('zhudatuanwebapi','cart.item','UPDATE')
    or not has_table_privilege('zhudatuanwebapi','cart.item','DELETE')
    or not has_table_privilege('zhudatuanwebapi','access.decisionaudit','SELECT')
    or not has_table_privilege('zhudatuanwebapi','access.decisionaudit','INSERT')
    or has_table_privilege('zhudatuanwebapi','access.decisionaudit','UPDATE')
    or has_table_privilege('zhudatuanwebapi','access.decisionaudit','DELETE')
    or not has_table_privilege('zhudatuanwebapi','ordering.orderrecord','SELECT') then
    raise exception 'ZHUDATUAN_WEB_REQUIRED_TABLE_PRIVILEGE_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828173000'
    and checksum='2eaef6eba438f8ed4050547dfacff5f684b0fd2f1f74f38098c6a9913638ac59') then
    raise exception 'ZHUDATUAN_WEB_SCHEMA_VERSION_MISSING';
  end if;
end
$assert$;

commit;
