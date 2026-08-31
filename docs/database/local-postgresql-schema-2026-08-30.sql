--
-- PostgreSQL database dump
--

\restrict 3uBFKepCLnQMyp8yiV6XVnhzZK7Dh2AcpVaLcDQgJV79diOJb8EZOA0NWgLGseu

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: access; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "access";


--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "audit";


--
-- Name: benefit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "benefit";


--
-- Name: capability; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "capability";


--
-- Name: cart; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "cart";


--
-- Name: catalog; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "catalog";


--
-- Name: channel; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "channel";


--
-- Name: checkout; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "checkout";


--
-- Name: experience; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "experience";


--
-- Name: extension; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "extension";


--
-- Name: finance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "finance";


--
-- Name: fulfillment; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "fulfillment";


--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "identity";


--
-- Name: inventory; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "inventory";


--
-- Name: invoice; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "invoice";


--
-- Name: marketing; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "marketing";


--
-- Name: member; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "member";


--
-- Name: notification; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "notification";


--
-- Name: ordering; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "ordering";


--
-- Name: organization; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "organization";


--
-- Name: partner; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "partner";


--
-- Name: payment; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "payment";


--
-- Name: pricing; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "pricing";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: qualification; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "qualification";


--
-- Name: reporting; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "reporting";


--
-- Name: risk; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "risk";


--
-- Name: runtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "runtime";


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "supabase_migrations";


--
-- Name: support; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "support";


--
-- Name: verification; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "verification";


--
-- Name: voucher; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "voucher";


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: assert_owner_integrity(); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."assert_owner_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
begin
  if exists(
    with active_owner as(
      select role.id role_id,role.scope_id,count(membership.id)::integer active_count,
        min(membership.id) filter(where membership.id is not null) membership_id
      from access.role role
      left join access.membershiprole assignment on assignment.role_id=role.id
        and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      left join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
      where role.kind='owner' and role.status='active' group by role.id,role.scope_id
    )
    select 1 from active_owner active
    left join access.ownership ownership on ownership.role_id=active.role_id
    left join access.membership membership on membership.id=ownership.membership_id
    where active.active_count>1
      or active.active_count=0 and ownership.role_id is not null
      or active.active_count=1 and (
        ownership.role_id is null or ownership.scope_id<>active.scope_id or ownership.membership_id<>active.membership_id
        or membership.organization_id<>active.scope_id or membership.status<>'active'
        or case membership.client when 'storefront' then 'storefront' else 'console' end<>'console'
      )
  ) or exists(
    select 1 from access.ownership ownership
    left join access.role role on role.id=ownership.role_id
    left join access.membership membership on membership.id=ownership.membership_id
    where role.id is null or role.kind<>'owner' or role.status<>'active' or role.scope_id<>ownership.scope_id
      or membership.id is null or membership.organization_id<>ownership.scope_id or membership.status<>'active'
      or case membership.client when 'storefront' then 'storefront' else 'console' end<>'console'
  ) then raise exception 'ACCESS_OWNER_INTEGRITY_VIOLATION'; end if;
  return null;
end
$$;


--
-- Name: authorization_snapshot("text", "text", "text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."authorization_snapshot"("p_membership_id" "text", "p_target" "text", "p_operation" "text", "p_resource" "text") RETURNS TABLE("membership_id" "text", "membership_active" boolean, "access_version" bigint, "credential_version" bigint, "organization_id" "text", "target" "text", "role_assignments" "jsonb", "permission_allows" "text"[], "permission_denies" "text"[], "scopes" "jsonb", "resource_scope" "jsonb", "operation_ids" "text"[], "capability_version" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'capability', 'identity', 'pg_temp'
    AS $$
  with subject as materialized (
    select membership.id,membership.status='active' and principal.status='active' active,
      membership.access_version,principal.credential_version,membership.organization_id,
      case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership
    join identity.principal principal on principal.id=membership.principal_id
    where membership.id=p_membership_id
      and case membership.client when 'operator' then 'console' else membership.client end=p_target
  ), roles as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',role.id,'kind',role.kind,'status',role.status,'version',role.version,
      'effectiveAt',assignment.effective_at,'expiresAt',assignment.expires_at,
      'active',role.status='active' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      order by role.id,assignment.effective_at),'[]'::jsonb) value
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id
    where assignment.membership_id=p_membership_id
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), permission_set as (
    select coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='allow'),'{}'::text[]) allows,
      coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='deny'),'{}'::text[]) denies
    from permissions
  ), scope_set as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'scope',scope,'effect',effect,'effective',effective_at,'expires',expires_at)
      order by effect,scope->>'kind',scope->>'id'),'[]'::jsonb) value
    from access.effective_scopes(p_membership_id)
  ), capability_set as (
    select available.operation_ids,available.capability_version
    from capability.membership_authorization(p_membership_id) available
  )
  select subject.id,subject.active,subject.access_version,subject.credential_version,
    subject.organization_id,subject.target,roles.value,permission_set.allows,permission_set.denies,scope_set.value,
    access.scope_object(access.resource_scope(p_operation,p_resource,p_membership_id)),
    capability_set.operation_ids,capability_set.capability_version
  from subject cross join roles cross join permission_set cross join scope_set cross join capability_set
$$;


--
-- Name: consume_action_proof("bytea", "text", "text", "text", bigint, "text", "text", "text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."consume_action_proof"("p_token_hash" "bytea", "p_operation" "text", "p_resource" "text", "p_request_hash" "text", "p_expected_version" bigint, "p_target" "text", "p_scope" "text", "p_maker_membership" "text", "p_permission" "text") RETURNS TABLE("proof_id" "text", "checker_membership_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'access', 'capability', 'pg_temp'
    AS $$
declare proof access.actionproof%rowtype; snapshot record;
begin
  select * into proof from access.actionproof candidate where candidate.token_hash=p_token_hash for update;
  if proof.id is null then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.consumed_at is not null then raise exception 'ACTION_PROOF_REPLAYED'; end if;
  if proof.expires_at<=clock_timestamp() then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.operation_id<>p_operation or proof.resource_id<>p_resource or proof.request_hash<>p_request_hash
    or proof.expected_version is distinct from p_expected_version or proof.target<>p_target or proof.scope_id<>p_scope
    or proof.maker_membership_id<>p_maker_membership or proof.permission_code<>p_permission then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  if proof.checker_membership_id=proof.maker_membership_id then raise exception 'MAKER_CHECKER_SEPARATION_REQUIRED'; end if;

  select * into snapshot from access.authorization_snapshot(
    proof.checker_membership_id,proof.target,proof.operation_id,proof.resource_id);
  if snapshot.membership_id is null or not snapshot.membership_active
    or snapshot.access_version<>proof.checker_access_version
    or proof.permission_code=any(snapshot.permission_denies)
    or not proof.permission_code=any(snapshot.permission_allows)
    or not proof.operation_id=any(snapshot.operation_ids)
    or snapshot.resource_scope->>'id'<>proof.scope_id then
    raise exception 'ACTION_PROOF_INVALID';
  end if;

  update access.actionproof consumed set consumed_at=clock_timestamp() where consumed.id=proof.id;
  return query select proof.id::text,proof.checker_membership_id;
end
$$;


--
-- Name: effective_permissions("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."effective_permissions"("p_membership_id" "text") RETURNS TABLE("permission_code" "text", "effect" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  with candidates as (
    select permission.code,mapping.effect
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id and role.status='active'
    join access.rolepermission mapping on mapping.role_id=role.id
    join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
    where assignment.membership_id=p_membership_id
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    union all
    select permission.code,override.effect
    from access.membershipoverride override
    join access.permission permission on permission.id=override.permission_id and permission.status='active'
    where override.membership_id=p_membership_id and override.revoked_at is null
      and override.effective_at<=clock_timestamp()
      and (override.expires_at is null or override.expires_at>clock_timestamp())
  ), resolved as (
    select code,bool_or(effect='deny') denied,bool_or(effect='allow') allowed
    from candidates group by code
  )
  select code,case when denied then 'deny' else 'allow' end
  from resolved where denied or allowed order by code
$$;


--
-- Name: effective_scopes("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."effective_scopes"("p_membership_id" "text") RETURNS TABLE("scope" "jsonb", "effect" "text", "effective_at" timestamp with time zone, "expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select coalesce(access.scope_object(grantrow.scope_id),jsonb_build_object(
      'kind',grantrow.scope_kind,'id',grantrow.scope_id,'path','[]'::jsonb)),
    grantrow.effect,grantrow.effective_at,grantrow.expires_at
  from access.scopegrant grantrow
  where grantrow.membership_id=p_membership_id
    and grantrow.effective_at<=clock_timestamp()
    and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
  order by grantrow.effect desc,grantrow.scope_path,grantrow.scope_id
$$;


--
-- Name: navigation_access("text"[]); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."navigation_access"("p_membership_ids" "text"[]) RETURNS TABLE("membership_id" "text", "permission_code" "text", "effect" "text", "access_version" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select membership.id,permission.permission_code,permission.effect,membership.access_version
  from access.membership membership
  left join lateral access.effective_permissions(membership.id) permission on true
  where membership.id=any(p_membership_ids) and membership.status='active'
  order by membership.id,permission.permission_code
$$;


--
-- Name: purchase_application_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_application_allowed"("p_application" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'experience', 'pg_temp'
    AS $$
  select p_application is not null and exists(select 1 from experience.application application
    where application.id=p_application and application.status='active' and access.purchase_mall_allowed(application.scope_id))
$$;


--
-- Name: purchase_audit_scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_audit_scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select p_scope is not null and exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.member_id=p_scope and membership.client='storefront' and membership.status='active')
$$;


--
-- Name: purchase_benefit_account_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_benefit_account_allowed"("p_account" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'benefit', 'pg_temp'
    AS $$
  select p_account is not null and exists(select 1 from benefit.account account
    where account.id=p_account and account.status='active' and account.currency='CNY'
      and access.purchase_member_mall_allowed(account.member_id,account.scope_id))
$$;


--
-- Name: purchase_checkout_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_checkout_allowed"("p_checkout" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'checkout', 'pg_temp'
    AS $$
  select p_checkout is not null and exists(select 1 from checkout.session session
    where session.id=p_checkout and access.purchase_member_mall_allowed(session.member_id,session.mall_id))
$$;


--
-- Name: purchase_fulfillment_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_fulfillment_allowed"("p_fulfillment" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'fulfillment', 'ordering', 'pg_temp'
    AS $$
  select p_fulfillment is not null and exists(select 1 from fulfillment.fulfillmentorder fulfillment
    join ordering.orderrecord orders on orders.id=fulfillment.order_id
    where fulfillment.id=p_fulfillment and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$$;


--
-- Name: purchase_intent_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_intent_allowed"("p_intent" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'payment', 'ordering', 'pg_temp'
    AS $$
  select p_intent is not null and exists(select 1 from payment.intent intent
    join ordering.orderrecord orders on orders.id=intent.order_id
    where intent.id=p_intent and intent.member_id=orders.member_id
      and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$$;


--
-- Name: purchase_mall_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_mall_allowed"("p_mall" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and access.purchase_member_mall_allowed(membership.member_id,p_mall))
$$;


--
-- Name: purchase_member_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_member_allowed"("p_member" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and access.purchase_member_mall_allowed(p_member,membership.organization_id))
$$;


--
-- Name: purchase_member_mall_allowed("text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_member_mall_allowed"("p_member" "text", "p_mall" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'member', 'organization', 'pg_temp'
    AS $$
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
$$;


--
-- Name: purchase_member_scope("text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_member_scope"("p_membership" "text", "p_session" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
declare context record; resolved jsonb;
begin
  select * into context from access.purchase_session_context(p_membership,p_session,false);
  resolved:=access.scope_object(context.member_id);
  if resolved is null or resolved->>'kind'<>'owner' then raise exception 'PURCHASE_MEMBER_SCOPE_NOT_FOUND'; end if;
  return resolved;
end
$$;


--
-- Name: purchase_order_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_order_allowed"("p_order" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'ordering', 'pg_temp'
    AS $$
  select p_order is not null and exists(select 1 from ordering.orderrecord orders
    where orders.id=p_order and access.purchase_member_mall_allowed(orders.member_id,orders.mall_id))
$$;


--
-- Name: purchase_quote_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_quote_allowed"("p_quote" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pricing', 'pg_temp'
    AS $$
  select p_quote is not null and exists(select 1 from pricing.quote quote
    where quote.id=p_quote and access.purchase_member_mall_allowed(quote.member_id,quote.mall_id))
$$;


--
-- Name: purchase_risk_scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."purchase_risk_scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'organization', 'pg_temp'
    AS $$
  select p_scope is not null and exists(select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.client='storefront'
      and membership.status='active' and (p_scope=membership.member_id or exists(
        select 1 from organization.unitclosure closure where closure.descendant_id=membership.organization_id
          and closure.ancestor_id=p_scope
      )))
$$;


--
-- Name: resource_scope("text", "text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."resource_scope"("p_operation" "text", "p_resource" "text", "p_membership_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'capability', 'member', 'organization', 'partner', 'catalog', 'pricing', 'inventory', 'experience', 'cart', 'checkout', 'ordering', 'fulfillment', 'verification', 'payment', 'voucher', 'benefit', 'finance', 'invoice', 'channel', 'support', 'notification', 'reporting', 'risk', 'audit', 'extension', 'identity', 'pg_temp'
    AS $$
declare resolved text;
begin
  if p_operation='organization.stores.manage' then
    select coalesce((select id from partner.partner where id=p_resource and kind='store'),
      (select organization_id from access.membership where id=p_membership_id)) into resolved;
  elsif p_operation='identity.invitations.create' then
    select organization_id into resolved from access.membership where id=p_membership_id;
  elsif p_operation='identity.invitations.revoke' then
    select organization_id into resolved from identity.invitation where id=p_resource;
  elsif p_operation like 'identity.%' then
    select 'self:'||profile.principal_id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif exists(select 1 from capability.operation where operation_id=p_operation and audience='storefront')
      or p_operation like 'cart.%' or p_operation like 'checkout.%' or p_operation in(
      'order.orders.create','order.aftersales.apply','payment.intents.create','benefit.accounts.read','invoice.profiles.manage',
      'invoice.requests.create','invoice.requests.read','invoice.requests.cancel',
      'notification.notifications.read','notification.preferences.manage','notification.endpoints.manage') then
    select profile.id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_operation in('order.orders.read','order.aftersales.read','support.cases.read','support.messages.read')
      and exists(select 1 from access.membership where id=p_membership_id and client='storefront') then
    select profile.id into resolved from access.membership membership
    join member.profile profile on profile.id=membership.member_id where membership.id=p_membership_id;
  elsif p_resource is null then
    select organization_id into resolved from access.membership where id=p_membership_id;
  else
    select id into resolved from organization.organization where id=p_resource;
    if resolved is null then select id into resolved from partner.partner where id=p_resource; end if;
    if resolved is null then select id into resolved from member.profile where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.pool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.sourcelisting where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.listing where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from catalog.importjob where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.pricebook where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from pricing.rule where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from pricing.quote where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from inventory.stockitem where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from experience.application where id=p_resource; end if;
    if resolved is null then select application.scope_id into resolved from experience.version versionrecord
      join experience.application application on application.id=versionrecord.application_id where versionrecord.id=p_resource; end if;
    if resolved is null then select mall_id into resolved from cart.cart where id=p_resource; end if;
    if resolved is null then select mall_id into resolved from checkout.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from ordering.orderrecord where id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.fulfillmentorder fulfillment
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=p_resource; end if;
    if resolved is null then select orders.mall_id into resolved from fulfillment.returnrecord returned
      join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      join ordering.orderrecord orders on orders.id=fulfillment.order_id where returned.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.session where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from verification.device where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from payment.recoverycase where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.program where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.cardpool where id=p_resource; end if;
    if resolved is null then select scope_id into resolved from voucher.reserverequest where id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.issuebatch batch
      join voucher.program program on program.id=batch.program_id where batch.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.voucher voucher
      join voucher.program program on program.id=voucher.program_id where voucher.id=p_resource; end if;
    if resolved is null then select program.scope_id into resolved from voucher.redemption redemption
      join voucher.voucher voucher on voucher.id=redemption.voucher_id
      join voucher.program program on program.id=voucher.program_id where redemption.id=p_resource; end if;
    if resolved is null then select scope_id into resolved from benefit.plan where id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.budget budget
      join benefit.plan plan on plan.id=budget.plan_id where budget.id=p_resource; end if;
    if resolved is null then select plan.scope_id into resolved from benefit.grantbatch batch
      join benefit.plan plan on plan.id=batch.plan_id where batch.id=p_resource; end if;
    if resolved is null then select finance.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from channel.connection where id=p_resource; end if;
    if resolved is null then select support.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select notification.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select reporting.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select risk.resource_scope(p_resource) into resolved; end if;
    if resolved is null then select scope_id into resolved from extension.installation where id=p_resource; end if;
    if resolved is null and p_operation in(
      'access.roles.manage','access.scopes.manage','capability.assignments.manage','partner.partners.manage',
      'qualification.policies.manage','experience.applications.update','notification.templates.manage',
      'notification.announcements.manage','reporting.exports.create','risk.policies.manage',
      'verification.devices.manage','voucher.programs.manage','benefit.plans.manage','benefit.budgets.manage') then
      select organization_id into resolved from access.membership where id=p_membership_id;
    end if;
  end if;
  if resolved is null then raise exception 'RESOURCE_SCOPE_NOT_FOUND'; end if;
  return resolved;
end $$;


--
-- Name: scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'organization', 'partner', 'pg_temp'
    AS $$
  select p_scope is not null and (
    p_scope=nullif(current_setting('app.scope_id',true),'') or
    exists(select 1 from organization.unitclosure closure
      where closure.ancestor_id=nullif(current_setting('app.scope_id',true),'') and closure.descendant_id=p_scope) or
    exists(select 1 from partner.partner subject
      where subject.id=nullif(current_setting('app.scope_id',true),'') and (
        subject.scope_id=p_scope or exists(select 1 from organization.unitclosure closure
          where closure.ancestor_id=subject.scope_id and closure.descendant_id=p_scope))) or
    exists(select 1 from access.membership membership
      where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active' and (
        p_scope=membership.member_id or p_scope=membership.organization_id or
        exists(select 1 from organization.unitclosure closure
          where closure.ancestor_id=membership.organization_id and closure.descendant_id=p_scope)
      ))
  )
$$;


--
-- Name: FUNCTION "scope_allowed"("p_scope" "text"); Type: COMMENT; Schema: access; Owner: -
--

COMMENT ON FUNCTION "access"."scope_allowed"("p_scope" "text") IS 'Allows the authorized resource scope plus the active membership owner and its organization subtree; never an ancestor or sibling scope.';


--
-- Name: scope_object("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."scope_object"("p_scope_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'organization', 'partner', 'member', 'pg_temp'
    AS $$
declare value jsonb;
begin
  select jsonb_strip_nulls(jsonb_build_object(
      'kind',scope.kind,'id',scope.id,
      'tenant',(select ancestor.id from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id where closure.descendant_id=scope.id and ancestor.kind='tenant' limit 1),
      'path',coalesce((select jsonb_agg(jsonb_build_object('kind',ancestor.kind,'id',ancestor.id) order by closure.depth desc)
        from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=scope.id and closure.depth>0),'[]'::jsonb))) into value
    from organization.organization scope where scope.id=p_scope_id;
  if value is not null then return value; end if;
  select jsonb_strip_nulls(jsonb_build_object('kind',subject.kind,'id',subject.id,'tenant',tenant.id,'path',
      coalesce((select jsonb_agg(jsonb_build_object('kind',ancestor.kind,'id',ancestor.id) order by closure.depth desc)
        from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=subject.scope_id),'[]'::jsonb))) into value
    from partner.partner subject
    left join organization.unitclosure tenantclosure on tenantclosure.descendant_id=subject.scope_id
    left join organization.organization tenant on tenant.id=tenantclosure.ancestor_id and tenant.kind='tenant'
    where subject.id=p_scope_id order by tenantclosure.depth asc limit 1;
  if value is not null then return value; end if;
  select jsonb_build_object('kind','owner','id',profile.id,'path','[]'::jsonb) into value from member.profile profile where profile.id=p_scope_id;
  if value is not null then return value; end if;
  if p_scope_id like 'self:%' then return jsonb_build_object('kind','self','id',substr(p_scope_id,6),'path','[]'::jsonb); end if;
  return null;
end
$$;


--
-- Name: sync_bootstrap_ownership(); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."sync_bootstrap_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
declare owner_scope text;
begin
  if session_user<>'zhudatuanbootstrap' then return new; end if;
  select role.scope_id into owner_scope from access.role role
  join access.membership membership on membership.id=new.membership_id
  where role.id=new.role_id and role.kind='owner' and role.status='active'
    and membership.organization_id=role.scope_id and membership.status='active'
    and case membership.client when 'storefront' then 'storefront' else 'console' end='console';
  if owner_scope is not null then
    insert into access.ownership(scope_id,role_id,membership_id)
    values(owner_scope,new.role_id,new.membership_id)
    on conflict(scope_id) do update set role_id=excluded.role_id,membership_id=excluded.membership_id,
      version=access.ownership.version+1,updated_at=clock_timestamp();
  end if;
  return new;
end
$$;


--
-- Name: web_audit_scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."web_audit_scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select p_scope is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and p_scope=membership.member_id)
        or (membership.client='operator' and access.scope_allowed(p_scope)))
  )
$$;


--
-- Name: web_member_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."web_member_allowed"("p_member" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select p_member is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'')
      and membership.member_id=p_member and membership.status='active'
  )
$$;


--
-- Name: web_order_allowed("text", "text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."web_order_allowed"("p_member" "text", "p_mall" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and membership.member_id=p_member and membership.organization_id=p_mall)
        or (membership.client='operator' and access.scope_allowed(p_mall)))
  )
$$;


--
-- Name: web_risk_scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."web_risk_scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'organization', 'pg_temp'
    AS $$
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
$$;


--
-- Name: web_scope_allowed("text"); Type: FUNCTION; Schema: access; Owner: -
--

CREATE FUNCTION "access"."web_scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'pg_temp'
    AS $$
  select p_scope is not null and exists(
    select 1 from access.membership membership
    where membership.id=nullif(current_setting('app.membership_id',true),'') and membership.status='active'
      and ((membership.client='storefront' and p_scope in(membership.member_id,membership.organization_id))
        or (membership.client<>'storefront' and access.scope_allowed(p_scope)))
  )
$$;


--
-- Name: enforce_chain(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION "audit"."enforce_chain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'audit', 'pg_temp'
    AS $$
declare expected char(64);
begin
  perform pg_advisory_xact_lock(hashtextextended('audit:'||new.scope_id,0));
  select record_hash into expected from(
    select record_hash,recorded_at occurred_at,id from audit.record where scope_id=new.scope_id
    union all select record_hash,accessed_at,id from audit.accessrecord where scope_id=new.scope_id
    union all select last_record_hash,through_at,id from audit.archiveref where scope_id=new.scope_id
  ) chain order by occurred_at desc,id desc limit 1;
  if new.previous_hash is distinct from expected then raise exception 'AUDIT_CHAIN_PREVIOUS_HASH_INVALID'; end if;
  return new;
end $$;


--
-- Name: reject_mutation(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION "audit"."reject_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'audit', 'pg_temp'
    AS $$
begin
  raise exception 'AUDIT_IMMUTABLE';
end
$$;


--
-- Name: scope_allowed("text"); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION "audit"."scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'audit', 'access', 'organization', 'pg_temp'
    AS $$
  select access.scope_allowed(p_scope) or (
    nullif(current_setting('app.scope_id',true),'')='organization-platform-root'
    and not exists(select 1 from organization.organization where id=p_scope)
  )
$$;


--
-- Name: purchase_available("text", "text", "text"[]); Type: FUNCTION; Schema: benefit; Owner: -
--

CREATE FUNCTION "benefit"."purchase_available"("p_membership" "text", "p_session" "text", "p_accounts" "text"[]) RETURNS TABLE("id" "text", "available_minor" bigint, "version" bigint, "kind" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'identity', 'access', 'member', 'benefit', 'finance', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
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
$$;


--
-- Name: purchase_consume("text", "text", "text", "text", "text", bigint); Type: FUNCTION; Schema: benefit; Owner: -
--

CREATE FUNCTION "benefit"."purchase_consume"("p_membership" "text", "p_session" "text", "p_order" "text", "p_intent" "text", "p_account" "text", "p_amount" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'identity', 'access', 'member', 'benefit', 'finance', 'ordering', 'payment', 'public', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
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
$$;


--
-- Name: purchase_reserve("text", "text", "text", "text", "text"[], bigint[]); Type: FUNCTION; Schema: benefit; Owner: -
--

CREATE FUNCTION "benefit"."purchase_reserve"("p_membership" "text", "p_session" "text", "p_order" "text", "p_member" "text", "p_accounts" "text"[], "p_amounts" bigint[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'identity', 'access', 'member', 'benefit', 'finance', 'ordering', 'public', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
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
$$;


--
-- Name: membership_authorization("text"); Type: FUNCTION; Schema: capability; Owner: -
--

CREATE FUNCTION "capability"."membership_authorization"("p_membership_id" "text") RETURNS TABLE("operation_ids" "text"[], "capability_version" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'capability', 'access', 'organization', 'pg_temp'
    AS $$
  with membership_scope as (
    select membership.organization_id
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), current_version as (
    select coalesce(max(greatest(entitlement.version,capability.version)),0)::bigint value
    from membership_scope membership
    join organization.unitclosure closure on closure.descendant_id=membership.organization_id
    join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
      and entitlement.state='enabled' and entitlement.effective_at<=clock_timestamp()
      and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
    join capability.capability capability on capability.id=entitlement.capability_id
  )
  select coalesce(array_agg(available.operation_id order by available.operation_id)
    filter(where available.operation_id is not null),'{}'::text[]),current_version.value
  from current_version
  left join capability.membership_operations(p_membership_id) available on true
  group by current_version.value
$$;


--
-- Name: membership_operations("text"); Type: FUNCTION; Schema: capability; Owner: -
--

CREATE FUNCTION "capability"."membership_operations"("p_membership_id" "text") RETURNS TABLE("operation_id" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'capability', 'access', 'organization', 'pg_temp'
    AS $$
  with subject as (
    select membership.organization_id,
      case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  )
  select operation.operation_id
  from subject
  join capability.operation operation on operation.audience in('public',subject.target)
  where exists(
      select 1 from organization.unitclosure closure
      join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
        and entitlement.capability_id=operation.capability_id and entitlement.state='enabled'
        and entitlement.effective_at<=clock_timestamp()
        and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
      where closure.descendant_id=subject.organization_id)
    and (operation.permission_code is null or exists(
      select 1 from permissions permission
      where permission.permission_code=operation.permission_code and permission.effect='allow'))
  order by operation.operation_id
$$;


--
-- Name: navigation_capabilities("text"[]); Type: FUNCTION; Schema: capability; Owner: -
--

CREATE FUNCTION "capability"."navigation_capabilities"("p_scope_ids" "text"[]) RETURNS TABLE("scope_id" "text", "capability_code" "text", "capability_version" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'capability', 'organization', 'pg_temp'
    AS $$
  select requested.scope_id,capability.name,max(greatest(entitlement.version,capability.version))
  from unnest(p_scope_ids) requested(scope_id)
  join organization.unitclosure closure on closure.descendant_id=requested.scope_id
  join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
  join capability.capability capability on capability.id=entitlement.capability_id
  where entitlement.state='enabled'
    and entitlement.effective_at<=clock_timestamp() and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
  group by requested.scope_id,capability.name
  order by requested.scope_id,capability.name
$$;


--
-- Name: accept_webhook("text", "text", "text", "text", "jsonb", "text", "text", "text", "text", timestamp with time zone, "text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."accept_webhook"("p_connection" "text", "p_external" "text", "p_event" "text", "p_reference" "text", "p_normalized" "jsonb", "p_ciphertext" "text", "p_keyversion" "text", "p_rawhash" "text", "p_signaturehash" "text", "p_received" timestamp with time zone, "p_trace" "text") RETURNS TABLE("id" "text", "state" "text", "replayed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'channel', 'runtime', 'public', 'pg_temp'
    AS $$
declare target channel.connection%rowtype; inboxid text; inserted_count integer;
begin
  select * into target from channel.connection where channel.connection.id=p_connection and status in('enabled','degraded') for share;
  if target.id is null then raise exception 'CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE'; end if;
  inboxid := 'webhook:'||encode(public.digest(p_connection||':'||p_external,'sha256'),'hex');
  insert into channel.webhookinbox(id,connection_id,provider,scope_id,external_id,event_type,external_reference,normalized,
    raw_ciphertext,raw_key_version,raw_hash,signature_hash,state,received_at,trace_id)
  values(inboxid,p_connection,target.provider,target.scope_id,p_external,p_event,p_reference,p_normalized,p_ciphertext,p_keyversion,
    p_rawhash,p_signaturehash,'received',p_received,p_trace) on conflict(connection_id,external_id) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=1 then
    insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values('job:channelwebhook:'||inboxid,'channelwebhook','channel',target.scope_id,jsonb_build_object('webhook',inboxid),
      'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing;
  end if;
  return query select webhook.id,webhook.state,inserted_count=0 from channel.webhookinbox webhook
    where webhook.connection_id=p_connection and webhook.external_id=p_external;
end $$;


--
-- Name: build_private_statement("text", "jsonb"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."build_private_statement"("p_scope" "text", "p_period" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
  select jsonb_build_object('objectRef',statement.object_ref,'sha256',statement.sha256) from channel.statement statement
  where statement.provider='private' and statement.period_start=(p_period->>'start')::date and statement.period_end=(p_period->>'end')::date
$$;


--
-- Name: cancel_private_order("text", "text", "text", "text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."cancel_private_order"("p_scope" "text", "p_key" "text", "p_reference" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
declare response jsonb; request_digest text;
begin
  request_digest=encode(digest(p_reference||':'||p_reason,'sha256'),'hex'); response=jsonb_build_object('externalReference',p_reference,'state','cancelled');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('private-cancel:'||md5(p_scope||':'||p_key),'private',p_scope,'cancel',p_key,p_reference,p_reference,'succeeded',request_digest,response,clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do update set updated_at=channel.provideroperation.updated_at
  where channel.provideroperation.request_hash=excluded.request_hash;
  if not found then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if; return response;
end $$;


--
-- Name: private_enabled("text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."private_enabled"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
  select exists(select 1 from channel.connection where provider='private' and scope_id=p_scope and status='enabled')
$$;


--
-- Name: pull_private_catalog("text", "text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."pull_private_catalog"("p_scope" "text", "p_cursor" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'catalog', 'pg_temp'
    AS $$
  with batch as (select external_id,source_version,source_payload from catalog.sourcelisting
    where provider='private' and scope_id=p_scope and status<>'retired' and (p_cursor is null or external_id>p_cursor)
    order by external_id limit 500)
  select jsonb_build_object('records',coalesce(jsonb_agg(jsonb_build_object('externalId',external_id,'version',source_version,'payload',source_payload) order by external_id),'[]'::jsonb),
    'errors','[]'::jsonb,'complete',(select count(*)<500 from batch))||(case when count(*)=500 then jsonb_build_object('nextCursor',max(external_id)) else '{}'::jsonb end) from batch
$$;


--
-- Name: pull_private_stock("text", "jsonb"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."pull_private_stock"("p_scope" "text", "p_keys" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'catalog', 'inventory', 'pg_temp'
    AS $$
  select jsonb_build_object('records',coalesce(jsonb_agg(jsonb_build_object('externalId',listing.external_id,'onhand',stock.onhand,'safety',stock.safety,'version',stock.version,'status',stock.status)),'[]'::jsonb))
  from jsonb_array_elements(p_keys) key join catalog.sourcelisting listing on listing.provider='private' and listing.scope_id=p_scope and listing.external_id=key->>'externalId'
  join inventory.stockitem stock on stock.sku_id=listing.sku_id and stock.scope_id=p_scope
$$;


--
-- Name: pull_private_tracking("text", "text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."pull_private_tracking"("p_scope" "text", "p_reference" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'ordering', 'fulfillment', 'pg_temp'
    AS $$
  select jsonb_build_object('externalReference',p_reference,'milestones',coalesce(jsonb_agg(jsonb_build_object('kind',milestone.kind,'state',milestone.state,'occurredAt',milestone.occurred_at) order by milestone.occurred_at) filter(where milestone.id is not null),'[]'::jsonb))
  from fulfillment.fulfillmentorder target left join fulfillment.milestone milestone on milestone.fulfillment_id=target.id
  where target.external_reference=p_reference and exists(select 1 from ordering.orderrecord source where source.id=target.order_id and source.scope_id=p_scope)
$$;


--
-- Name: submit_private_order("text", "text", "text", "jsonb"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."submit_private_order"("p_scope" "text", "p_key" "text", "p_reference" "text", "p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
declare operation channel.provideroperation%rowtype; request_digest text;
begin
  if not exists(select 1 from channel.connection where provider='private' and scope_id=p_scope and status='enabled') then raise exception 'PRIVATE_PROVIDER_DISABLED'; end if;
  request_digest=encode(digest(p_reference||':'||p_payload::text,'sha256'),'hex');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('private-order:'||md5(p_scope||':'||p_key),'private',p_scope,'order',p_key,p_reference,p_reference,'succeeded',request_digest,
    jsonb_build_object('externalReference',p_reference,'state','accepted','rawReference','local:'||p_reference),clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do nothing;
  select * into strict operation from channel.provideroperation where provider='private' and kind='order' and idempotency_key=p_key;
  if operation.request_hash<>request_digest then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
  return operation.response;
end $$;


--
-- Name: submit_private_refund("text", "text", "jsonb"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."submit_private_refund"("p_scope" "text", "p_key" "text", "p_request" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
declare response jsonb; request_digest text; reference text;
begin
  reference=p_request->>'reference'; if reference is null then raise exception 'PRIVATE_REFUND_REFERENCE_REQUIRED'; end if;
  request_digest=encode(digest(p_request::text,'sha256'),'hex'); response=jsonb_build_object('externalReference','refund:'||reference,'state','submitted');
  insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
  values('private-refund:'||md5(p_scope||':'||p_key),'private',p_scope,'refund',p_key,reference,'refund:'||reference,'submitted',request_digest,response,clock_timestamp(),clock_timestamp())
  on conflict(provider,kind,idempotency_key) do update set updated_at=channel.provideroperation.updated_at where channel.provideroperation.request_hash=excluded.request_hash;
  if not found then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if; return response;
end $$;


--
-- Name: webhook_context("text"); Type: FUNCTION; Schema: channel; Owner: -
--

CREATE FUNCTION "channel"."webhook_context"("p_connection" "text") RETURNS TABLE("provider" "text", "scope_id" "text", "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'channel', 'pg_temp'
    AS $$
  select connection.provider,connection.scope_id,connection.status from channel.connection connection
  where connection.id=p_connection and connection.status in('enabled','degraded')
$$;


--
-- Name: read_published("text"); Type: FUNCTION; Schema: experience; Owner: -
--

CREATE FUNCTION "experience"."read_published"("p_mall" "text") RETURNS TABLE("release" "text", "version" "text", "hash" "text", "document" "jsonb", "effective_at" timestamp with time zone, "object_key" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'experience', 'pg_temp'
    AS $$
  select release.id,version.id,publication.content_hash,version.configuration,release.effective_at,publication.object_key
  from experience.binding binding
  join experience.release release on release.application_id=binding.application_id and release.state='active' and release.effective_at<=clock_timestamp()
  join experience.publication publication on publication.release_id=release.id and publication.state='active'
  join experience.version version on version.id=publication.version_id and version.validation_state='valid'
  where binding.mall_id=p_mall
  order by release.effective_at desc,release.id desc limit 1
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: installation; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."installation" (
    "id" "text" NOT NULL,
    "extension_id" "text" NOT NULL,
    "extension_version" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "base_url" "text",
    "endpoints" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "secret_ref" "text",
    "health_operation" "text",
    "version" bigint DEFAULT 0 NOT NULL,
    "installed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "extension_installation_configuration" CHECK (((("length"("health_operation") >= 1) AND ("length"("health_operation") <= 64)) AND ("health_operation" ~ '^[a-z][a-z0-9]*$'::"text") AND (("base_url" IS NULL) OR (("length"("base_url") <= 2048) AND ("base_url" ~ '^https://'::"text"))) AND (("secret_ref" IS NULL) OR ((("length"("secret_ref") >= 3) AND ("length"("secret_ref") <= 256)) AND ("secret_ref" ~ '^[a-z0-9][a-z0-9/.-]+$'::"text"))))),
    CONSTRAINT "extension_installation_size" CHECK ((("pg_column_size"("manifest") <= 65536) AND ("pg_column_size"("endpoints") <= 32768) AND ("length"("id") <= 128) AND ("length"("scope_id") <= 128))),
    CONSTRAINT "extension_installation_status" CHECK (("status" = ANY (ARRAY['disabled'::"text", 'testing'::"text", 'enabled'::"text", 'degraded'::"text"]))),
    CONSTRAINT "installation_check" CHECK ((("extension_id" = 'private'::"text") OR (("base_url" IS NOT NULL) AND ("secret_ref" IS NOT NULL) AND ("health_operation" IS NOT NULL)))),
    CONSTRAINT "installation_endpoints_check" CHECK (("jsonb_typeof"("endpoints") = 'object'::"text")),
    CONSTRAINT "installation_manifest_check" CHECK (("jsonb_typeof"("manifest") = 'object'::"text"))
);


--
-- Name: enabled_installations(); Type: FUNCTION; Schema: extension; Owner: -
--

CREATE FUNCTION "extension"."enabled_installations"() RETURNS SETOF "extension"."installation"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'extension', 'pg_temp'
    AS $$
  select installation.* from extension.registry registry join extension.installation installation on installation.id=registry.installation_id
  where registry.state='enabled' and installation.status='enabled'
  order by registry.extension_id,registry.scope_id,registry.generation
$$;


--
-- Name: load_installation("text", "text"); Type: FUNCTION; Schema: extension; Owner: -
--

CREATE FUNCTION "extension"."load_installation"("p_id" "text", "p_scope" "text") RETURNS SETOF "extension"."installation"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'extension', 'access', 'pg_temp'
    AS $$
  select installation.* from extension.installation installation where installation.id=p_id and installation.scope_id=p_scope
    and installation.status in('testing','enabled','degraded')
    and (session_user='shopjob' or access.scope_allowed(installation.scope_id))
$$;


--
-- Name: runnable_installations(); Type: FUNCTION; Schema: extension; Owner: -
--

CREATE FUNCTION "extension"."runnable_installations"() RETURNS SETOF "extension"."installation"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'extension', 'pg_temp'
    AS $$
  select installation.* from extension.installation installation where installation.status in('testing','enabled','degraded')
  order by installation.extension_id,installation.scope_id,installation.id
$$;


--
-- Name: sync_registry(); Type: FUNCTION; Schema: extension; Owner: -
--

CREATE FUNCTION "extension"."sync_registry"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extension', 'pg_temp'
    AS $$
begin
  if new.status='enabled' then
    insert into extension.registry(extension_id,scope_id,installation_id,extension_version,installation_version,state,generation,activated_at)
    values(new.extension_id,new.scope_id,new.id,new.extension_version,new.version,'enabled',1,clock_timestamp())
    on conflict(extension_id,scope_id) do update set installation_id=excluded.installation_id,
      extension_version=excluded.extension_version,installation_version=excluded.installation_version,state='enabled',
      generation=extension.registry.generation+1,activated_at=clock_timestamp();
  elsif new.status='degraded' then
    update extension.registry set state='degraded',installation_version=new.version,generation=generation+1
      where extension_id=new.extension_id and scope_id=new.scope_id and installation_id=new.id;
  else
    delete from extension.registry where extension_id=new.extension_id and scope_id=new.scope_id and installation_id=new.id;
  end if;
  return new;
end $$;


--
-- Name: account_id("text", "text", "text"); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."account_id"("p_scope" "text", "p_code" "text", "p_currency" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select 'account:'||substr(encode(public.digest(p_scope||':'||p_code||':'||p_currency,'sha256'::text),'hex'),1,40)
$$;


--
-- Name: assert_journal_balance(); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."assert_journal_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'finance', 'pg_temp'
    AS $$
declare selected text;
begin
  if tg_table_name='journal' then selected:=new.id; else selected:=new.journal_id; end if;
  if exists(select 1 from finance.journal where id=selected and state='posted') and
    (select count(*)<>2 or coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0)<>0
      from finance.entry where journal_id=selected) then raise exception 'FINANCE_JOURNAL_UNBALANCED:%',selected;
  end if;
  return null;
end $$;


--
-- Name: enforce_balanced_journal(); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."enforce_balanced_journal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'finance', 'pg_temp'
    AS $$
declare debit bigint; credit bigint;
begin
  if new.state='posted' and old.state<>'posted' then
    select coalesce(sum(amount_minor) filter(where side='debit'),0),coalesce(sum(amount_minor) filter(where side='credit'),0)
    into debit,credit from finance.entry where journal_id=new.id;
    if debit=0 or debit<>credit then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
    new.posted_at=clock_timestamp();
  end if;
  return new;
end $$;


--
-- Name: ensure_account("text", "text", "text", "text"); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."ensure_account"("p_scope" "text", "p_code" "text", "p_currency" "text", "p_kind" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'finance', 'pg_temp'
    AS $$
declare accountid text:=finance.account_id(p_scope,p_code,p_currency);
begin
  insert into finance.account(id,scope_id,code,currency,kind,status) values(accountid,p_scope,p_code,p_currency,p_kind,'active')
    on conflict(scope_id,code,currency) do update set status='active'
    where finance.account.kind=excluded.kind;
  if not exists(select 1 from finance.account where id=accountid and scope_id=p_scope and code=p_code and currency=p_currency and kind=p_kind)
    then raise exception 'FINANCE_ACCOUNT_CONTRACT_MISMATCH'; end if;
  return accountid;
end $$;


--
-- Name: post("text", "text", "text", "text", "text", "text", "text", "text", "text", bigint, timestamp with time zone); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."post"("p_scope" "text", "p_reference_type" "text", "p_reference_id" "text", "p_currency" "text", "p_description" "text", "p_debit_code" "text", "p_debit_kind" "text", "p_credit_code" "text", "p_credit_kind" "text", "p_amount" bigint, "p_occurred_at" timestamp with time zone DEFAULT "clock_timestamp"()) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'finance', 'pg_temp'
    AS $_$
declare debitid text; creditid text; periodid text:=to_char(p_occurred_at at time zone 'UTC','YYYY-MM');
  journalid text:='journal:'||substr(encode(public.digest(p_scope||':'||p_reference_type||':'||p_reference_id,'sha256'::text),'hex'),1,40); inserted text;
begin
  if p_amount<=0 or p_currency!~'^[A-Z]{3}$' or p_reference_type='' or p_reference_id='' then raise exception 'FINANCE_POST_INVALID'; end if;
  if exists(select 1 from finance.period where scope_id=p_scope and period=to_char(p_occurred_at at time zone 'UTC','YYYY-MM') and state='closed')
    then raise exception 'FINANCE_PERIOD_CLOSED'; end if;
  insert into finance.period(scope_id,period,state) values(p_scope,periodid,'open') on conflict(scope_id,period) do nothing;
  debitid:=finance.ensure_account(p_scope,p_debit_code,p_currency,p_debit_kind);
  creditid:=finance.ensure_account(p_scope,p_credit_code,p_currency,p_credit_kind);
  if debitid=creditid then raise exception 'FINANCE_POST_SAME_ACCOUNT'; end if;
  insert into finance.journal(id,scope_id,reference_type,reference_id,currency,period,state,description,posted_at,version)
    values(journalid,p_scope,p_reference_type,p_reference_id,p_currency,periodid,'posted',p_description,p_occurred_at,0)
    on conflict(scope_id,reference_type,reference_id) do nothing returning id into inserted;
  if inserted is null then
    if not exists(select 1 from finance.journal journal where journal.id=journalid and journal.scope_id=p_scope
      and journal.currency=p_currency and journal.state='posted'
      and (select count(*) from finance.entry entry where entry.journal_id=journal.id)=2
      and exists(select 1 from finance.entry where journal_id=journal.id and account_id=debitid and side='debit' and amount_minor=p_amount)
      and exists(select 1 from finance.entry where journal_id=journal.id and account_id=creditid and side='credit' and amount_minor=p_amount))
      then raise exception 'FINANCE_IDEMPOTENCY_MISMATCH'; end if;
    return journalid;
  end if;
  insert into finance.entry(id,journal_id,account_id,side,amount_minor,created_at) values
    ('entry:'||substr(encode(public.digest(journalid||':debit','sha256'::text),'hex'),1,40),journalid,debitid,'debit',p_amount,p_occurred_at),
    ('entry:'||substr(encode(public.digest(journalid||':credit','sha256'::text),'hex'),1,40),journalid,creditid,'credit',p_amount,p_occurred_at);
  if (select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0) from finance.entry where journal_id=journalid)<>0
    then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  insert into finance.statement(id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,generated_at)
    values('statement:'||substr(encode(public.digest(p_scope||':'||periodid||':'||p_currency,'sha256'::text),'hex'),1,40),p_scope,
      date_trunc('month',p_occurred_at at time zone 'UTC')::date,
      (date_trunc('month',p_occurred_at at time zone 'UTC')+interval '1 month'-interval '1 day')::date,
      p_currency,coalesce((select closing_minor from finance.statement where scope_id=p_scope and currency=p_currency and state='final'
        and period_end<date_trunc('month',p_occurred_at at time zone 'UTC')::date order by period_end desc limit 1),0),p_amount,p_amount,
      coalesce((select closing_minor from finance.statement where scope_id=p_scope and currency=p_currency and state='final'
        and period_end<date_trunc('month',p_occurred_at at time zone 'UTC')::date order by period_end desc limit 1),0),'draft',clock_timestamp())
    on conflict(scope_id,period_start,period_end,currency,state) do update set debit_minor=finance.statement.debit_minor+excluded.debit_minor,
      credit_minor=finance.statement.credit_minor+excluded.credit_minor,closing_minor=finance.statement.opening_minor+
        finance.statement.debit_minor+excluded.debit_minor-finance.statement.credit_minor-excluded.credit_minor,generated_at=clock_timestamp();
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values('event:'||substr(encode(public.digest('finance.entry.posted:'||journalid,'sha256'::text),'hex'),1,40),'finance.entry.posted',1,
      'journal',journalid,p_scope,jsonb_build_object('journal',journalid,'referenceType',p_reference_type,'referenceId',p_reference_id,
        'amountMinor',p_amount,'currency',p_currency,'debit',p_debit_code,'credit',p_credit_code),journalid,p_occurred_at,clock_timestamp())
    on conflict(id) do nothing;
  return journalid;
end $_$;


--
-- Name: reject_economic_leg_mutation(); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."reject_economic_leg_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'finance', 'pg_temp'
    AS $$
begin raise exception 'FINANCE_ECONOMIC_LEG_APPEND_ONLY'; end $$;


--
-- Name: reject_ledger_mutation(); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."reject_ledger_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'finance', 'pg_temp'
    AS $$
begin raise exception 'FINANCE_LEDGER_APPEND_ONLY'; end $$;


--
-- Name: resource_scope("text"); Type: FUNCTION; Schema: finance; Owner: -
--

CREATE FUNCTION "finance"."resource_scope"("p_resource" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'finance', 'invoice', 'pg_temp'
    AS $$
declare resolved text;
begin
  select scope_id into resolved from finance.reconciliation where id=p_resource;
  if resolved is null then select scope_id into resolved from finance.settlement where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.settlementadjustment where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.withdrawal where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.hold where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.periodclose where id=p_resource; end if;
  if resolved is null then select scope_id into resolved from finance.backfill where id=p_resource; end if;
  if resolved is null then select profile.owner_id into resolved from invoice.request request join invoice.profile profile on profile.id=request.profile_id where request.id=p_resource; end if;
  return resolved;
end $$;


--
-- Name: enforce_invitation_membership_target(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."enforce_invitation_membership_target"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
declare membership_target text;
begin
  if new.membership_id is null then return new; end if;
  select case membership.client when 'operator' then 'console' else membership.client end
  into membership_target
  from access.membership membership where membership.id=new.membership_id;
  if membership_target is null or membership_target<>new.target then
    raise exception 'INVITATION_MEMBERSHIP_TARGET_INVALID';
  end if;
  return new;
end
$$;


--
-- Name: invitation_key_readiness("text"[]); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."invitation_key_readiness"("active_versions" "text"[]) RETURNS TABLE("active_count" bigint, "missing_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
  select count(*)::bigint,
    count(*) filter(where not invitation.token_key_version=any(active_versions))::bigint
  from identity.invitation invitation
  where invitation.status='active' and invitation.expires_at>clock_timestamp()
$$;


--
-- Name: navigation_identity("text", "text"); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."navigation_identity"("p_principal_id" "text", "p_membership_id" "text") RETURNS TABLE("principal_id" "text", "membership_id" "text", "membership_status" "text", "access_version" bigint, "assurance" smallint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'identity', 'access', 'member', 'pg_temp'
    AS $$
  select principal.id,membership.id,membership.status,membership.access_version,
    coalesce((select max(assurance.level) from identity.assurance assurance where assurance.principal_id=principal.id
      and (assurance.expires_at is null or assurance.expires_at>clock_timestamp())),1)::smallint
  from identity.principal principal
  join member.profile profile on profile.principal_id=principal.id and profile.status='active'
  join access.membership membership on membership.id=p_membership_id and membership.member_id=profile.id
  where principal.id=p_principal_id and principal.status='active'
$$;


--
-- Name: notification_recipient("text"); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."notification_recipient"("p_membership" "text") RETURNS TABLE("id" "text", "subject_ciphertext" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'identity', 'pg_temp'
    AS $$
  select identity.id,identity.subject_ciphertext from identity.federatedidentity identity
  where identity.membership_id=p_membership and identity.provider='wechat' and identity.status='active'
  order by identity.updated_at desc limit 1
$$;


--
-- Name: protect_federation_consumption(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."protect_federation_consumption"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
begin
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then raise exception 'FEDERATION_CONSUMPTION_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'FEDERATION_VERSION_SEQUENCE_INVALID'; end if;
  return new;
end $$;


--
-- Name: protect_invitation_receipt_shape(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."protect_invitation_receipt_shape"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
declare invitation_kind text;
begin
  select invitation.kind into invitation_kind from identity.invitation invitation where invitation.id=new.invitation_id;
  if invitation_kind is null
    or (invitation_kind='campaign' and new.session_id is not null)
    or (invitation_kind<>'campaign' and new.session_id is null) then
    raise exception 'INVITATION_RECEIPT_SHAPE_INVALID';
  end if;
  return new;
end $$;


--
-- Name: protect_linkcase_transition(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."protect_linkcase_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
begin
  if old.status<>'open' and new.status is distinct from old.status then raise exception 'LINKCASE_TERMINAL'; end if;
  if new.version<>old.version+1 then raise exception 'LINKCASE_VERSION_SEQUENCE_INVALID'; end if;
  return new;
end $$;


--
-- Name: reject_invitationreceipt_mutation(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."reject_invitationreceipt_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin raise exception 'INVITATION_RECEIPT_IMMUTABLE'; end
$$;


--
-- Name: resolve_preauth("bytea", "bytea", "bytea", "text", "text"); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."resolve_preauth"("p_token_hash" "bytea", "p_browser_hash" "bytea", "p_device_hash" "bytea", "p_purpose" "text", "p_target" "text") RETURNS TABLE("id" "text", "purpose" "text", "target" "text", "principal_id" "text", "reference_id" "text", "version" bigint, "expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'identity', 'pg_temp'
    AS $$
  select preauth.id::text,preauth.purpose,preauth.target,preauth.principal_id,preauth.reference_id,
    preauth.version,preauth.expires_at
  from identity.preauth preauth
  where preauth.token_hash=p_token_hash and preauth.browser_hash=p_browser_hash
    and preauth.device_hash=p_device_hash and preauth.purpose=p_purpose and preauth.target=p_target
    and preauth.state='active' and preauth.consumed_at is null and preauth.expires_at>clock_timestamp()
$$;


--
-- Name: resolve_session("text"); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."resolve_session"("p_token_hash" "text") RETURNS TABLE("actor_id" "text", "session_id" "text", "membership_id" "text", "credential_version" bigint, "access_version" bigint, "target" "text", "assurance_level" smallint, "assurance_verified_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'identity', 'member', 'access', 'pg_temp'
    AS $$
  select session.principal_id,session.id,session.membership_id,session.credential_version,session.access_version,
    case session.client when 'operator' then 'console' else session.client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null
      then stepup.verified_at else null end
  from identity.session session join identity.principal principal on principal.id=session.principal_id
  join member.profile profile on profile.principal_id=session.principal_id
  join access.membership membership on membership.id=session.membership_id and membership.member_id=profile.id
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1) phone on true
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.level>=3
      and evidence.verified_at<=clock_timestamp() and (evidence.expires_at is null or evidence.expires_at>clock_timestamp())
    order by evidence.level desc,evidence.verified_at desc limit 1) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version and principal.status='active' and membership.status='active'
$$;


--
-- Name: validate_federation_link_binding(); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION "identity"."validate_federation_link_binding"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'identity', 'access'
    AS $$
begin
  if new.purpose='link' and not exists(
    select 1 from access.membership membership
    where membership.id=new.link_membership_id and membership.principal_id=new.link_principal_id and membership.status='active'
  ) then
    raise exception 'FEDERATION_LINK_MEMBERSHIP_INVALID';
  end if;
  return new;
end $$;


--
-- Name: resource_scope("text"); Type: FUNCTION; Schema: notification; Owner: -
--

CREATE FUNCTION "notification"."resource_scope"("p_resource" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'notification', 'pg_temp'
    AS $$
  select coalesce((select scope_id from notification.dispatch where id=p_resource),
    (select scope_id from notification.template where id=p_resource),
    (select scope_id from notification.announcement where id=p_resource))
$$;


--
-- Name: protect_order_snapshot(); Type: FUNCTION; Schema: ordering; Owner: -
--

CREATE FUNCTION "ordering"."protect_order_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
begin
  if (new.id,new.order_number,new.scope_id,new.member_id,new.mall_id,new.checkout_id,new.currency,new.total_minor,new.evidence,
      new.address_snapshot,new.invoice_snapshot,new.delivery_snapshot,new.experience_version,new.created_at)
    is distinct from
    (old.id,old.order_number,old.scope_id,old.member_id,old.mall_id,old.checkout_id,old.currency,old.total_minor,old.evidence,
      old.address_snapshot,old.invoice_snapshot,old.delivery_snapshot,old.experience_version,old.created_at) then
    raise exception 'ORDER_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end $$;


--
-- Name: navigation_scopes("text"[]); Type: FUNCTION; Schema: organization; Owner: -
--

CREATE FUNCTION "organization"."navigation_scopes"("p_membership_ids" "text"[]) RETURNS TABLE("membership_id" "text", "scope_id" "text", "scope_kind" "text", "scope_status" "text", "scope_version" bigint, "is_default" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'access', 'organization', 'pg_temp'
    AS $$
  select distinct membership.id,scope.id,scope.kind,scope.status,scope.version,scope.id=membership.organization_id
  from access.membership membership
  join access.scopegrant allowed on allowed.membership_id=membership.id and allowed.effect='allow'
    and allowed.effective_at<=clock_timestamp() and (allowed.expires_at is null or allowed.expires_at>clock_timestamp())
  join organization.unitclosure closure on closure.ancestor_id=allowed.scope_id
  join organization.organization scope on scope.id=closure.descendant_id
  where membership.id=any(p_membership_ids) and membership.status='active' and scope.status='active'
    and not exists(select 1 from access.scopegrant denied join organization.unitclosure deniedclosure on deniedclosure.ancestor_id=denied.scope_id
      where denied.membership_id=membership.id and denied.effect='deny' and deniedclosure.descendant_id=scope.id
        and denied.effective_at<=clock_timestamp() and (denied.expires_at is null or denied.expires_at>clock_timestamp()))
  order by membership.id,scope.id
$$;


--
-- Name: receive_directory_event("uuid", "text", bigint, character, "text"); Type: FUNCTION; Schema: organization; Owner: -
--

CREATE FUNCTION "organization"."receive_directory_event"("p_connection" "uuid", "p_event" "text", "p_version" bigint, "p_hash" character, "p_envelope" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'organization', 'runtime', 'pg_temp'
    AS $$
declare latest bigint;run_id uuid;inserted integer;
begin
  perform 1 from organization.directoryconnection where id=p_connection and status='enabled' for update;
  if not found then raise exception 'DIRECTORY_NOT_FOUND'; end if;
  select greatest(connection.successful_version,coalesce(max(inbox.provider_version),0)) into latest
  from organization.directoryconnection connection
  left join organization.directoryinbox inbox on inbox.connection_id=connection.id
  where connection.id=p_connection group by connection.successful_version;
  insert into organization.directoryinbox(connection_id,provider_event_id,provider_version,body_hash,envelope_ciphertext,state,received_at)
    values(p_connection,p_event,p_version,p_hash,p_envelope,case when p_version<latest then 'stale' else 'received' end,clock_timestamp())
    on conflict(connection_id,provider_event_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return 'duplicate'; end if;
  if p_version<latest then return 'stale'; end if;
  run_id:=gen_random_uuid();
  insert into organization.syncrun(id,connection_id,provider_run_id,mode,state,created_at)
    values(run_id,p_connection,'event:'||p_event,'event','queued',clock_timestamp());
  insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values('job:'||gen_random_uuid(),'directorysync','organization',p_connection::text,
      jsonb_build_object('resource',p_connection::text,'connection',p_connection::text,'run',run_id::text),'queued',10,
      clock_timestamp(),clock_timestamp(),clock_timestamp());
  return 'accepted';
end $$;


--
-- Name: webhook_directory("uuid"); Type: FUNCTION; Schema: organization; Owner: -
--

CREATE FUNCTION "organization"."webhook_directory"("p_connection" "uuid") RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "organization_id" "text", "provider_instance_id" "uuid", "provider_type" "text", "secret_ref" "text", "cursor_ciphertext" "text", "successful_version" bigint, "status" "text", "version" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'organization', 'pg_temp'
    AS $$
  select connection.id,connection.tenant_id,connection.organization_id,connection.provider_instance_id,connection.provider_type,
    connection.secret_ref,connection.cursor_ciphertext,connection.successful_version,connection.status,connection.version
  from organization.directoryconnection connection
  where connection.id=p_connection and connection.status='enabled' and connection.provider_status='enabled'
$$;


--
-- Name: webhook_scope("text", "text"); Type: FUNCTION; Schema: payment; Owner: -
--

CREATE FUNCTION "payment"."webhook_scope"("p_kind" "text", "p_reference" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'payment', 'ordering', 'pg_temp'
    AS $$
declare resolved text;
begin
  if p_kind='payment' then
    select orders.scope_id into resolved from payment.intent intent
      join ordering.orderrecord orders on orders.id=intent.order_id where intent.provider_reference=p_reference;
  elsif p_kind='refund' then
    select orders.scope_id into resolved from payment.refund refund
      join payment.payment captured on captured.id=refund.payment_id
      join payment.intent intent on intent.id=captured.intent_id
      join ordering.orderrecord orders on orders.id=intent.order_id where refund.provider_reference=p_reference;
  else
    raise exception 'PAYMENT_WEBHOOK_KIND_INVALID';
  end if;
  return resolved;
end
$$;


--
-- Name: reject_quote_mutation(); Type: FUNCTION; Schema: pricing; Owner: -
--

CREATE FUNCTION "pricing"."reject_quote_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
begin raise exception 'CHECKOUT_QUOTE_IMMUTABLE'; end $$;


--
-- Name: alert_wechat_refund_event_deadletter("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."alert_wechat_refund_event_deadletter"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare event public.wechat_refund_event_outbox%rowtype;
  command public.wechat_refund_commands%rowtype; order_row public.orders%rowtype;
  notification_id uuid;
begin
  select * into strict event from public.wechat_refund_event_outbox
  where id=p_event_id and status='dead_letter';
  select * into strict command from public.wechat_refund_commands
  where id=event.command_id;
  select * into strict order_row from public.orders where id=command.order_id;
  insert into public.notification_dispatches(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,recipient_kind,recipient_id,channel,template_key,payload_json
  ) values(
    command.tenant_id,command.mall_id,command.order_id,command.payment_id,
    null,null,command.refund_id,'operations',command.mall_id,'inapp',
    'refund.effect.deadletter',jsonb_build_object('eventId',event.id,
      'refundId',command.refund_id,'eventType',event.event_type,
      'errorCode',event.last_error_code,'attempts',event.attempts)
  ) on conflict(refund_id,recipient_kind,channel,template_key)
    where refund_id is not null do nothing returning id into notification_id;
  if notification_id is not null then
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,
      resource_id,request_id,after_json,created_at
    ) values(
      gen_random_uuid()::text,command.tenant_id,order_row.enterprise_id,
      command.mall_id,'system','refund.wechat.effect_dead_letter','refund',
      command.refund_id,'wechat-refund-deadletter:'||event.id,
      jsonb_build_object('eventId',event.id,'eventType',event.event_type,
        'errorCode',event.last_error_code,'attempts',event.attempts),now()
    );
  end if;
end $$;


--
-- Name: apply_abo_product_taxonomy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."apply_abo_product_taxonomy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_path jsonb;
begin
  if new.supplier_id <> 'supplier-test-abo' or new.is_test is not true then
    return new;
  end if;
  v_path := public.classify_abo_product_taxonomy(new.name, new.subtitle, new.detail_json);
  new.taxonomy_l1 := v_path->>'l1';
  new.taxonomy_l2 := v_path->>'l2';
  new.taxonomy_l3 := v_path->>'l3';
  new.category_code := v_path->>'l1';
  new.classification_status := 'machine_classified';
  new.classification_confidence := (v_path->>'confidence')::numeric;
  new.taxonomy_version := '2026.08';
  return new;
end;
$$;


--
-- Name: assert_payment_journal_balanced(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."assert_payment_journal_balanced"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target_journal_id uuid; debit bigint; credit bigint; entry_count integer;
begin
  if tg_table_name='finance_journals' then target_journal_id:=new.id;
  else target_journal_id:=new.journal_id; end if;
  select count(*),coalesce(sum(amount_cents) filter(where side='debit'),0),
    coalesce(sum(amount_cents) filter(where side='credit'),0)
  into entry_count,debit,credit from public.finance_journal_entries
  where finance_journal_entries.journal_id=target_journal_id;
  if entry_count<2 or debit<>credit
  then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
  return null;
end $$;


--
-- Name: bump_distributor_relation_authz_versions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."bump_distributor_relation_authz_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_old_distributor_id text;
  v_old_tenant_id text;
  v_new_distributor_id text;
  v_new_tenant_id text;
begin
  if tg_op <> 'INSERT' then
    v_old_distributor_id:=old.distributor_id;
    v_old_tenant_id:=old.tenant_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_distributor_id:=new.distributor_id;
    v_new_tenant_id:=new.tenant_id;
  end if;
  update public.memberships membership
  set authz_version=membership.authz_version+1,updated_at=now()
  where exists(
    select 1 from public.membership_scopes scope
    where scope.membership_id=membership.id and scope.scope_kind='distributor'
      and (
        (membership.tenant_id=v_old_tenant_id and scope.resource_id=v_old_distributor_id)
        or (membership.tenant_id=v_new_tenant_id and scope.resource_id=v_new_distributor_id)
      )
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: bump_distributor_status_authz_versions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."bump_distributor_status_authz_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.status is distinct from old.status then
    update public.memberships membership
    set authz_version=membership.authz_version+1,updated_at=now()
    where exists(select 1 from public.membership_scopes scope
      where scope.membership_id=membership.id and scope.scope_kind='distributor'
        and scope.resource_id=new.id);
  end if;
  return new;
end;
$$;


--
-- Name: bump_membership_authz_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."bump_membership_authz_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_old_membership_id text; v_new_membership_id text;
begin
  if tg_op<>'INSERT' then v_old_membership_id:=old.membership_id; end if;
  if tg_op<>'DELETE' then v_new_membership_id:=new.membership_id; end if;
  update public.memberships membership
  set authz_version=membership.authz_version+1,updated_at=now()
  where membership.id in (v_old_membership_id,v_new_membership_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: bump_membership_version_on_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."bump_membership_version_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status is distinct from old.status or new.expires_at is distinct from old.expires_at then
    new.authz_version := old.authz_version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: bump_role_membership_authz_versions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."bump_role_membership_authz_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  update public.memberships membership
  set authz_version = membership.authz_version + 1, updated_at = now()
  where exists (
    select 1 from public.membership_roles membership_role
    where membership_role.membership_id = membership.id
      and membership_role.role_id in (coalesce(new.role_id, old.role_id), coalesce(old.role_id, new.role_id))
      and membership_role.revoked_at is null
      and (membership_role.expires_at is null or membership_role.expires_at > now())
  );
  return coalesce(new, old);
end;
$$;


--
-- Name: classify_abo_product_taxonomy("text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."classify_abo_product_taxonomy"("p_name" "text", "p_subtitle" "text", "p_detail_json" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_type text := upper(coalesce(p_detail_json->>'productType', ''));
  v_text text := lower(concat_ws(' ', p_name, p_subtitle, p_detail_json->>'brand',
    p_detail_json->>'model', p_detail_json->>'productType', p_detail_json->>'description'));
begin
  if v_type ~ '(GROCERY|FOOD|SNACK|COFFEE|TEA|BEVERAGE|DAIRY|HERB|CEREAL)'
    or v_text ~ '(food|grocery|snack|coffee|tea|beverage|cereal|pasta|sauce|chocolate|cookie|candy|rice|flour|spice|organic|milk|juice|wine|beer|sugar|cream cheese|fruit spread|ice cream|soup|ground beef|食品|零食|咖啡|茶饮|牛奶|饮料|大米|杂粮|食用油|调味)' then
    if v_text ~ '(rice|grain|cereal|flour|pasta|大米|杂粮)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_grain', 'l3', 'food_grain_rice', 'confidence', 0.9);
    elsif v_text ~ '(oil|sauce|spice|seasoning|食用油|调味)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_grain', 'l3', 'food_grain_oil', 'confidence', 0.9);
    elsif v_text ~ '(coffee|tea|咖啡|茶饮)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_drink', 'l3', 'food_drink_coffee_tea', 'confidence', 0.9);
    elsif v_text ~ '(milk|dairy|beverage|juice|wine|beer|牛奶|乳品|饮料)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_drink', 'l3', 'food_drink_dairy', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'food', 'l2', 'food_snack', 'l3', 'food_snack_nuts', 'confidence', 0.86);
  end if;

  if v_type ~ '(KITCHEN_APPLIANCE|VACUUM|REFRIGERATOR|AIR_CONDITIONER|HOME_APPLIANCE)'
    or v_text ~ '(vacuum|air purifier|purifier|refrigerator|microwave|oven|blender|mixer|food processor|coffee maker|kettle|toaster|washer|dryer|air conditioner|ceiling fan|heater|appliance|吸尘器|净化器|冰箱|微波炉|烤箱|料理机|搅拌机|电水壶|烤面包机|洗衣机|烘干机|空调)' then
    if v_text ~ '(air purifier|purifier|air conditioner|ceiling fan|heater|净化器|空调)' then
      return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_living', 'l3', 'appliance_living_air', 'confidence', 0.9);
    elsif v_text ~ '(vacuum|washer|dryer|refrigerator|filter cartridge|吸尘器|洗衣机|烘干机|冰箱)' then
      return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_living', 'l3', 'appliance_living_clean', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_kitchen', 'l3', 'appliance_kitchen_cook', 'confidence', 0.88);
  end if;

  if v_type ~ '(CELLULAR_PHONE|PORTABLE_ELECTRONIC|WIRELESS_ACCESSORY|CHARGING_ADAPTER|HEADPHONES|SPEAKERS|MICROPHONE|CAMERA|COMPUTER|OFFICE_ELECTRONICS|OFFICE_PRODUCTS|WRITING_INSTRUMENT|3D_PRINTER)'
    or v_text ~ '(computer|laptop|notebook|monitor|keyboard|mouse|printer|camera|phone|tablet|headphone|headset|speaker|router|electronic|digital|usb|battery|charger|cable|playstation|ethernet|displayport|mobile cover|phone case|手机壳|手机套|耳机|音箱|电脑|笔记本|显示器|键盘|鼠标|打印机|相机|数据线|充电)' then
    if v_text ~ '(headphone|headset|speaker|microphone|耳机|音箱|麦克风)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_audio', 'l3', 'digital_audio_audio', 'confidence', 0.92);
    elsif v_text ~ '(phone case|mobile cover|electronic device cover|手机壳|手机套)' or v_type ~ '(CELLULAR_PHONE_CASE|PORTABLE_ELECTRONIC_DEVICE_COVER)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_mobile', 'l3', 'digital_mobile_accessory', 'confidence', 0.94);
    elsif v_text ~ '(phone|tablet|camera|手机|平板|相机)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_audio', 'l3', 'digital_audio_mobile', 'confidence', 0.88);
    elsif v_text ~ '(laptop|notebook|computer|monitor|笔记本|电脑整机|显示器)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_computer', 'l3', 'digital_computer_pc', 'confidence', 0.9);
    elsif v_text ~ '(office|paper|pen|stationery|crayon|办公|文具|纸品)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_office', 'l3', 'digital_office_stationery', 'confidence', 0.86);
    end if;
    return jsonb_build_object('l1', 'digital', 'l2', 'digital_computer', 'l3', 'digital_computer_peripheral', 'confidence', 0.88);
  end if;

  if v_type ~ '(BEAUTY|SKIN|HEALTH_PERSONAL_CARE|JANITORIAL|CLEANING|DRUGSTORE)'
    or v_text ~ '(shampoo|hair conditioner|soap|tooth|dental|skin|beauty|cosmetic|makeup|razor|shave|deodorant|lotion|towel|tissue|cleaning|detergent|body wash|washmittel|toilet roll|洗发|护发|香皂|沐浴露|牙膏|护肤|美妆|剃须|洗衣液|清洁剂|纸巾)' then
    if v_text ~ '(skin|beauty|cosmetic|makeup|lotion|razor|shave|护肤|美妆|剃须)' then
      return jsonb_build_object('l1', 'personal', 'l2', 'personal_beauty', 'l3', 'personal_beauty_skin', 'confidence', 0.88);
    elsif v_text ~ '(detergent|cleaning|tissue|toilet roll|washmittel|洗衣液|清洁剂|纸巾)' then
      return jsonb_build_object('l1', 'personal', 'l2', 'personal_wash', 'l3', 'personal_wash_clean', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'personal', 'l2', 'personal_wash', 'l3', 'personal_wash_hair', 'confidence', 0.86);
  end if;

  if v_type ~ '(BED|PILLOW|SHEET|RUG|CURTAIN|SOFA|CHAIR|TABLE|DESK|OTTOMAN|CABINET|SHELF|HEADBOARD|FURNITURE|KITCHEN|FLATWARE|DRINKING_CUP|LAMP|LIGHT|STORAGE|HANGER|HOOK|HOME|WALL_ART)'
    or v_text ~ '(furniture|chair|table|desk|bed|mattress|pillow|blanket|duvet|curtain|lamp|rug|shelf|storage|organizer|kitchenware|cookware|sheet|sofa|headboard|basket|whisk|cabinet|hanger|mirror|toilet|bathroom|shower|家具|椅|桌|床|床垫|枕|被|窗帘|灯|地毯|置物架|收纳|锅|杯|沙发|床头板|衣架|镜|浴室|花洒)' then
    if v_text ~ '(bed|mattress|pillow|blanket|duvet|sheet|curtain|rug|床|床垫|枕|被|床单|窗帘|地毯)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_furniture', 'l3', 'home_furniture_bedding', 'confidence', 0.9);
    elsif v_text ~ '(kitchenware|cookware|pan|whisk|cup|glass|mug|bottle|flatware|锅|杯|餐具)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_kitchen', 'l3', 'home_kitchen_tableware', 'confidence', 0.88);
    elsif v_text ~ '(storage|organizer|basket|hanger|rack|ironing board|收纳|置物架|篮|衣架|熨衣板)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_storage', 'l3', 'home_storage_organize', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'home', 'l2', 'home_furniture', 'l3', 'home_furniture_furniture', 'confidence', 0.86);
  end if;

  if v_text ~ '(gift|festival|hamper|礼盒|礼品|节日)' then
    return jsonb_build_object('l1', 'welfare', 'l2', 'welfare_gift', 'l3', 'welfare_gift_festival', 'confidence', 0.86);
  end if;
  return jsonb_build_object('l1', 'welfare', 'l2', 'welfare_review', 'l3', 'welfare_review_unclassified', 'confidence', 0.8);
end;
$$;


--
-- Name: copy_recipient_snapshot_to_sub_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."copy_recipient_snapshot_to_sub_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  select o.recipient_snapshot_json
  into new.recipient_snapshot_json
  from public.orders o
  where o.id = new.parent_order_id
    and o.tenant_id = new.tenant_id
    and o.mall_id = new.mall_id;

  if new.recipient_snapshot_json is null then
    raise exception 'PARENT_ORDER_RECIPIENT_NOT_FOUND';
  end if;
  return new;
end;
$$;


--
-- Name: emit_internal_payment_outbox(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."emit_internal_payment_outbox"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare tender_count integer; tender_total bigint; tender_channels integer;
  key_count integer; base_key text; intent_id uuid:=gen_random_uuid();
begin
  if old.status<>'pending_payment' or new.status<>'paid'
    or new.paid_cents<>new.payable_cents
  then return new; end if;
  if exists(select 1 from public.payment_intents intent
    where intent.tenant_id=new.tenant_id and intent.order_id=new.id)
  then raise exception 'INTERNAL_PAYMENT_INTENT_ALREADY_EXISTS'; end if;
  select count(*),coalesce(sum(payment.amount_cents),0),
    count(distinct payment.channel),
    count(distinct regexp_replace(payment.idempotency_key,
      ':(welfare|meal)$','')),min(regexp_replace(payment.idempotency_key,
      ':(welfare|meal)$',''))
  into tender_count,tender_total,tender_channels,key_count,base_key
  from public.payments payment where payment.order_id=new.id
    and payment.channel in('welfare','meal');
  if tender_count=0 then return new; end if;
  if tender_count<>tender_channels or tender_count not between 1 and 2
    or tender_total<>new.payable_cents or key_count<>1
    or exists(select 1 from public.payments payment where payment.order_id=new.id
      and payment.channel not in('welfare','meal'))
    or exists(select 1 from public.payments payment where payment.order_id=new.id
      and payment.channel in('welfare','meal')
      and not public.internal_payment_tender_valid(new.id,payment.id))
  then raise exception 'INTERNAL_PAYMENT_INTENT_EVIDENCE_INVALID'; end if;
  insert into public.payment_intents(id,tenant_id,mall_id,user_id,order_id,
    source,currency,amount_cents,status,idempotency_key,completed_at)
  values(intent_id,new.tenant_id,new.mall_id,new.user_id,new.id,'internal',
    'CNY',new.payable_cents,'succeeded',base_key,coalesce(new.paid_at,now()));
  update public.payments set payment_intent_id=intent_id
  where order_id=new.id and channel in('welfare','meal');
  if not public.internal_payment_intent_valid(intent_id)
  then raise exception 'INTERNAL_PAYMENT_INTENT_INCOMPLETE'; end if;
  insert into public.payment_outbox(event_key,source,topic,order_id,
    payment_id,payment_intent_id,attempt_id,payload_json,created_at,updated_at)
  values('payment-intent:'||intent_id||':captured:v1','internal',
    'order.payment_succeeded',new.id,null,intent_id,null,
    jsonb_build_object('orderId',new.id,'paymentIntentId',intent_id,
      'amountCents',new.payable_cents,'currency','CNY','outcome','applied'),
    coalesce(new.paid_at,now()),now());
  return new;
end $_$;


--
-- Name: enforce_fulfillment_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_fulfillment_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ begin
  if row(new.tenant_id,new.mall_id,new.order_id,new.sub_order_id,new.supplier_id,new.payment_id,new.payment_intent_id,new.source_effect_id,new.amount_cents,new.idempotency_key,new.created_at)
    is distinct from row(old.tenant_id,old.mall_id,old.order_id,old.sub_order_id,old.supplier_id,old.payment_id,old.payment_intent_id,old.source_effect_id,old.amount_cents,old.idempotency_key,old.created_at)
  then raise exception 'FULFILLMENT_IDENTITY_IMMUTABLE'; end if;return new;end $$;


--
-- Name: enforce_notification_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_notification_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if row(new.tenant_id,new.mall_id,new.order_id,new.payment_id,new.payment_intent_id,
      new.source_effect_id,new.refund_id,new.recipient_kind,new.recipient_id,
      new.channel,new.template_key,new.payload_json,new.created_at)
     is distinct from row(old.tenant_id,old.mall_id,old.order_id,old.payment_id,
      old.payment_intent_id,old.source_effect_id,old.refund_id,old.recipient_kind,
      old.recipient_id,old.channel,old.template_key,old.payload_json,old.created_at)
  then raise exception 'NOTIFICATION_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;


--
-- Name: enforce_payment_effect_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_payment_effect_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ begin
  if row(new.inbox_id,new.outbox_id,new.tenant_id,new.order_id,new.payment_id,new.payment_intent_id,new.effect_type,new.payload_json,new.created_at)
    is distinct from row(old.inbox_id,old.outbox_id,old.tenant_id,old.order_id,old.payment_id,old.payment_intent_id,old.effect_type,old.payload_json,old.created_at)
  then raise exception 'PAYMENT_EFFECT_IDENTITY_IMMUTABLE'; end if;return new;end $$;


--
-- Name: enforce_payment_outbox_envelope_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_payment_outbox_envelope_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if row(new.event_key,new.source,new.topic,new.tenant_id,new.aggregate_type,
      new.aggregate_id,new.aggregate_version,new.event_type,new.event_version,
      new.headers_json,new.order_id,new.payment_id,new.payment_intent_id,
      new.attempt_id,new.payload_json,new.created_at)
    is distinct from row(old.event_key,old.source,old.topic,old.tenant_id,
      old.aggregate_type,old.aggregate_id,old.aggregate_version,old.event_type,
      old.event_version,old.headers_json,old.order_id,old.payment_id,
      old.payment_intent_id,old.attempt_id,old.payload_json,old.created_at)
  then raise exception 'PAYMENT_OUTBOX_ENVELOPE_IMMUTABLE'; end if;
  return new;
end $$;


--
-- Name: enforce_product_taxonomy_path(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_product_taxonomy_path"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.status = 'active' and new.classification_status <> 'pending'
    and not public.is_valid_catalog_taxonomy_path(new.taxonomy_l1, new.taxonomy_l2, new.taxonomy_l3) then
    raise exception 'Invalid taxonomy path for product %', new.id using errcode = '23514';
  end if;
  if new.taxonomy_l1 is not null then
    new.category_code := new.taxonomy_l1;
  end if;
  return new;
end;
$$;


--
-- Name: enforce_wechat_refund_attempt_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_wechat_refund_attempt_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if row(new.command_id,new.attempt_no,new.operation,new.worker_id,new.started_at)
     is distinct from row(old.command_id,old.attempt_no,old.operation,old.worker_id,old.started_at)
  then raise exception 'WECHAT_REFUND_ATTEMPT_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;


--
-- Name: enforce_wechat_refund_event_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."enforce_wechat_refund_event_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if row(new.event_key,new.command_id,new.tenant_id,new.aggregate_type,new.aggregate_id,
      new.aggregate_version,new.event_type,new.event_version,new.payload_json,new.created_at)
     is distinct from row(old.event_key,old.command_id,old.tenant_id,old.aggregate_type,
      old.aggregate_id,old.aggregate_version,old.event_type,old.event_version,
      old.payload_json,old.created_at)
  then raise exception 'WECHAT_REFUND_EVENT_IDENTITY_IMMUTABLE'; end if;
  return new;
end $$;


--
-- Name: ensure_refund_finance_journal("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_refund_finance_journal"("p_refund_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare refund public.refunds%rowtype; payment public.payments%rowtype;
  orders public.orders%rowtype;
  created_journal_id uuid; credit_account text;
begin
  select * into strict refund from public.refunds
  where id=p_refund_id and status='succeeded';
  select * into strict payment from public.payments where id=refund.payment_id;
  select * into strict orders from public.orders where id=refund.order_id;
  if refund.tenant_id<>orders.tenant_id or refund.mall_id<>orders.mall_id
     or payment.order_id<>orders.id or payment.tenant_id<>orders.tenant_id
     or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id
     or refund.amount_cents>payment.amount_cents
  then raise exception 'REFUND_FINANCE_EVIDENCE_MISMATCH'; end if;
  credit_account:=case payment.channel
    when 'wechat' then 'asset:wechat_receivable'
    when 'welfare' then 'liability:welfare_balance'
    when 'meal' then 'liability:meal_balance'
    else null end;
  if credit_account is null then raise exception 'REFUND_FINANCE_CHANNEL_UNSUPPORTED'; end if;
  insert into public.finance_journals(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
  ) values(
    refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,null,refund.id,
    'payment_refund','refund:'||refund.id,'CNY',refund.amount_cents,'posted',
    coalesce(refund.completed_at,now())
  ) on conflict(tenant_id,journal_type,business_reference) do nothing
  returning id into created_journal_id;
  if created_journal_id is null then
    select journal.id into strict created_journal_id
    from public.finance_journals journal
    where journal.refund_id=refund.id and journal.journal_type='payment_refund';
  end if;
  insert into public.finance_journal_entries(
    journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
    account_code,side,amount_cents,subject_type,subject_id
  ) values
    (created_journal_id,refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,
      'liability:customer_payment_clearing','debit',refund.amount_cents,'order',refund.order_id),
    (created_journal_id,refund.tenant_id,refund.mall_id,refund.order_id,payment.id,null,
      credit_account,'credit',refund.amount_cents,'order',refund.order_id)
  on conflict(journal_id,account_code,side) do nothing;
end $$;


--
-- Name: ensure_storefront_membership_for_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."ensure_storefront_membership_for_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  storefront_membership_id text := 'membership-storefront-for-' || new.id;
  employee_role_id text;
begin
  if new.target <> 'admin' or new.context_user_id is null then
    return new;
  end if;

  insert into public.memberships (
    id, member_id, context_user_id, tenant_id, enterprise_id, mall_id,
    supplier_id, target, status, expires_at
  )
  select
    storefront_membership_id, new.member_id, new.context_user_id,
    new.tenant_id, new.enterprise_id, new.mall_id, new.supplier_id,
    'storefront', new.status, new.expires_at
  where not exists (
    select 1
    from public.memberships storefront
    where storefront.member_id = new.member_id
      and storefront.target = 'storefront'
      and storefront.tenant_id = new.tenant_id
      and storefront.enterprise_id is not distinct from new.enterprise_id
      and storefront.mall_id is not distinct from new.mall_id
      and storefront.supplier_id is not distinct from new.supplier_id
      and storefront.context_user_id is not distinct from new.context_user_id
  )
  on conflict (id) do nothing;

  select storefront.id into storefront_membership_id
  from public.memberships storefront
  where storefront.member_id = new.member_id
    and storefront.target = 'storefront'
    and storefront.tenant_id = new.tenant_id
    and storefront.enterprise_id is not distinct from new.enterprise_id
    and storefront.mall_id is not distinct from new.mall_id
    and storefront.supplier_id is not distinct from new.supplier_id
    and storefront.context_user_id is not distinct from new.context_user_id
  order by storefront.created_at, storefront.id
  limit 1;

  select role.id into employee_role_id
  from public.roles role
  where role.tenant_id = new.tenant_id and role.code = 'employee'
  order by role.id
  limit 1;

  if storefront_membership_id is not null and employee_role_id is not null then
    insert into public.membership_roles (membership_id, role_id)
    values (storefront_membership_id, employee_role_id)
    on conflict (membership_id, role_id) do update
      set revoked_at = null, expires_at = null;
  end if;

  if storefront_membership_id is not null then
    insert into public.membership_scopes (membership_id, scope_kind, resource_id)
    values (storefront_membership_id, 'self', new.context_user_id)
    on conflict do nothing;
  end if;

  -- Match a normal registered customer's initial wallet state without
  -- granting money or unfreezing an existing account.
  if new.enterprise_id is not null and new.mall_id is not null then
    insert into public.welfare_accounts (
      id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents, status
    ) values (
      'account-storefront-for-' || new.id, new.tenant_id, new.enterprise_id,
      new.mall_id, new.context_user_id, 'welfare', 0, 'active'
    )
    on conflict (mall_id, user_id, account_type) do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: execute_internal_refund_primitive("text", bigint, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."execute_internal_refund_primitive"("p_after_sale_id" "text", "p_refund_cents" bigint, "p_idempotency_key" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare after_sale public.after_sales%rowtype; order_row public.orders%rowtype;
  payment record; account public.welfare_accounts%rowtype;
  internal_intent_id uuid; intent_count integer; capture_count integer;
  refundable_count integer; refundable_total bigint; remaining bigint:=p_refund_cents;
  refund_amount bigint; total_refunded bigint; refund_no text;
  refund_nos jsonb:='[]'::jsonb; occurred_at timestamptz:=clock_timestamp();
begin
  if p_refund_cents is null or p_refund_cents<=0
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
  then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  select * into strict after_sale from public.after_sales where id=p_after_sale_id;
  select * into strict order_row from public.orders where id=after_sale.order_id;
  if after_sale.status<>'approved' then raise exception 'AFTER_SALE_NOT_APPROVED'; end if;
  if after_sale.migration_status<>'ready' then raise exception 'AFTER_SALE_HISTORY_REQUIRES_REVIEW'; end if;
  if after_sale.type<>'refund_only' then raise exception 'AFTER_SALE_NOT_REFUNDABLE'; end if;
  if order_row.status<>'refund_pending' then raise exception 'AFTER_SALE_ORDER_STATE_CONFLICT'; end if;
  if after_sale.user_id<>order_row.user_id or after_sale.tenant_id<>order_row.tenant_id
     or after_sale.mall_id<>order_row.mall_id
  then raise exception 'REFUND_INTERNAL_EVIDENCE_MISMATCH'; end if;
  if p_refund_cents>after_sale.requested_amount_cents
  then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;

  select (array_agg(distinct source.payment_intent_id)
      filter(where source.payment_intent_id is not null))[1],
    count(distinct source.payment_intent_id)
  into internal_intent_id,intent_count
  from public.payments source
  where source.order_id=order_row.id and source.channel in('welfare','meal')
    and source.status in('succeeded','refunded');
  if internal_intent_id is null or intent_count<>1
     or exists(select 1 from public.payments source
       where source.order_id=order_row.id and source.channel in('welfare','meal')
         and source.status in('succeeded','refunded') and source.payment_intent_id is null)
  then raise exception 'PAYMENT_ACCOUNTING_PENDING'; end if;
  select count(*) into capture_count from public.finance_journals journal
  where journal.payment_intent_id=internal_intent_id and journal.payment_id is null
    and journal.journal_type='payment_capture' and journal.status='posted'
    and journal.order_id=order_row.id and journal.amount_cents=order_row.paid_cents;
  if capture_count<>1 then raise exception 'PAYMENT_ACCOUNTING_PENDING'; end if;

  select count(*),coalesce(sum(source.remaining_cents),0)
  into refundable_count,refundable_total
  from(
    select source.id,source.amount_cents-
      coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)
      as remaining_cents
    from public.payments source left join public.refunds refund on refund.payment_id=source.id
    where source.order_id=order_row.id and source.channel in('welfare','meal')
      and source.status in('succeeded','refunded')
    group by source.id,source.amount_cents
  ) source where source.remaining_cents>0;
  if p_refund_cents>refundable_total then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  -- No signed business/finance rule currently chooses which internal tender is
  -- consumed by a partial multi-tender refund.  Full remainder is unambiguous;
  -- a single remaining tender may still be partially refunded.
  if refundable_count>1 and p_refund_cents<>refundable_total
  then raise exception 'REFUND_ALLOCATION_RULE_REQUIRED'; end if;

  perform 1 from public.welfare_accounts welfare_account
  join public.payment_allocations allocation on allocation.account_id=welfare_account.id
  join public.payments source on source.id=allocation.payment_id
  where source.order_id=order_row.id and source.channel in('welfare','meal')
    and source.status in('succeeded','refunded')
  order by case source.channel when 'welfare' then 1 else 2 end,welfare_account.id
  for update of welfare_account;
  for payment in
    select source.id,source.payment_no,source.channel,source.amount_cents,source.user_id,
      source.amount_cents-
        coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)
        as remaining_cents
    from public.payments source left join public.refunds refund on refund.payment_id=source.id
    where source.order_id=order_row.id and source.channel in('welfare','meal')
      and source.status in('succeeded','refunded')
    group by source.id,source.payment_no,source.channel,source.amount_cents,source.user_id
    having source.amount_cents-
      coalesce(sum(refund.amount_cents) filter(where refund.status='succeeded'),0)>0
    order by case source.channel when 'welfare' then 1 else 2 end,source.id
  loop
    exit when remaining=0;
    refund_amount:=least(remaining,payment.remaining_cents);
    select welfare_account.* into strict account
    from public.welfare_accounts welfare_account
    join public.payment_allocations allocation on allocation.account_id=welfare_account.id
    where allocation.payment_id=payment.id and allocation.order_id=order_row.id
      and allocation.channel=payment.channel and allocation.amount_cents=payment.amount_cents;
    if account.tenant_id<>order_row.tenant_id or account.enterprise_id<>order_row.enterprise_id
       or account.mall_id<>order_row.mall_id or account.user_id<>order_row.user_id
       or account.account_type<>payment.channel
    then raise exception 'REFUND_INTERNAL_EVIDENCE_MISMATCH'; end if;
    update public.welfare_accounts welfare_account set
      balance_cents=welfare_account.balance_cents+refund_amount,
      version=welfare_account.version+1,updated_at=occurred_at
    where welfare_account.id=account.id;
    insert into public.account_ledgers(
      id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,
      balance_after_cents,business_type,business_id,idempotency_key,created_at
    ) select gen_random_uuid()::text,order_row.tenant_id,order_row.mall_id,account.id,
      order_row.user_id,'credit',refund_amount,welfare_account.balance_cents,
      'order_refund',order_row.id,p_idempotency_key||':'||payment.id,occurred_at
    from public.welfare_accounts welfare_account where welfare_account.id=account.id;
    refund_no:='REF'||to_char(occurred_at,'YYYYMMDDHH24MISSMS')||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.refunds(
      id,refund_no,tenant_id,mall_id,order_id,payment_id,amount_cents,status,
      reason,idempotency_key,created_at,completed_at
    ) values(
      gen_random_uuid()::text,refund_no,order_row.tenant_id,order_row.mall_id,
      order_row.id,payment.id,refund_amount,'succeeded',after_sale.reason,
      p_idempotency_key||':'||payment.id,occurred_at,occurred_at
    );
    update public.payments source set status=case
      when (select coalesce(sum(refund.amount_cents),0)
        from public.refunds refund where refund.payment_id=source.id
          and refund.status='succeeded')=source.amount_cents
      then 'refunded' else 'succeeded' end
    where source.id=payment.id;
    refund_nos:=refund_nos||jsonb_build_array(refund_no);
    remaining:=remaining-refund_amount;
  end loop;
  if remaining<>0 then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  select coalesce(sum(refund.amount_cents),0) into total_refunded
  from public.refunds refund where refund.order_id=order_row.id and refund.status='succeeded';
  update public.after_sales set status='completed',updated_at=occurred_at
  where id=after_sale.id;
  update public.orders set
    status=case when total_refunded=paid_cents then 'refunded' else 'paid' end,
    updated_at=occurred_at where id=order_row.id;
  return jsonb_build_object('refund',jsonb_build_object(
    'afterSaleId',after_sale.id,'orderId',order_row.id,'amountCents',p_refund_cents,
    'refundNos',refund_nos,'status','succeeded','completedAt',occurred_at
  ),'requestId',p_request_id);
end $$;


--
-- Name: internal_anchor_admin_create_member("text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_admin_create_member"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_username" "text", "p_password_hash" "text", "p_display_name" "text", "p_employee_no" "text", "p_email" "text", "p_department_id" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare normalized_username text:=lower(trim(p_username)); new_user text:='user-admin-'||gen_random_uuid()::text;
  new_member text:='member-admin-'||gen_random_uuid()::text; new_membership text:='membership-admin-'||gen_random_uuid()::text;
  employee_role text; employee_no text:=coalesce(nullif(upper(trim(p_employee_no)),''),'ADM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if normalized_username !~ '^[a-z][a-z0-9._-]{3,31}$' or length(p_password_hash) not between 40 and 1024
    or length(trim(coalesce(p_display_name,''))) not between 1 and 60 or employee_no !~ '^[A-Z0-9_-]{2,40}$'
    or length(coalesce(p_email,''))>200 then return jsonb_build_object('status','invalid_input'); end if;
  if p_department_id is not null and not exists(select 1 from public.departments d where d.id=p_department_id and d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id) then return jsonb_build_object('status','invalid_department'); end if;
  if exists(select 1 from public.member_login_aliases where (provider='local_username' and subject=normalized_username) or (provider='test' and lower(subject)=normalized_username)) then return jsonb_build_object('status','account_exists'); end if;
  select id into employee_role from public.roles where tenant_id=p_tenant_id and code='employee' and not is_owner;
  if employee_role is null then raise exception 'EMPLOYEE_ROLE_NOT_FOUND'; end if;
  begin
    insert into public.users(id,tenant_id,enterprise_id,department_id,employee_no,display_name,email,identity_subject,status)
    values(new_user,p_tenant_id,p_enterprise_id,p_department_id,employee_no,trim(p_display_name),nullif(trim(p_email),''),'local_username:'||normalized_username,'active');
    insert into public.members(id,user_id,primary_identifier,status) values(new_member,new_user,'local_username:'||normalized_username,'active');
    insert into public.member_login_aliases(provider,subject,member_id) values('local_username',normalized_username,new_member);
    insert into public.member_credentials(member_id,password_hash,phone_cipher,must_reset_password)
    values(new_member,p_password_hash,'{"version":1,"kind":"unbound"}'::jsonb,true);
    insert into public.memberships(id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status)
    values(new_membership,new_member,new_user,p_tenant_id,p_enterprise_id,p_mall_id,'storefront','active');
    insert into public.membership_roles(membership_id,role_id,granted_by_membership_id) values(new_membership,employee_role,p_actor_membership_id);
    insert into public.membership_scopes(membership_id,scope_kind,resource_id) values(new_membership,'self',new_user);
    insert into public.welfare_accounts(id,tenant_id,enterprise_id,mall_id,user_id,account_type,balance_cents)
    values('account-admin-'||gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,new_user,'welfare',0);
  exception when unique_violation then return jsonb_build_object('status','account_exists'); end;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.admin_created','membership',new_membership,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('username',normalized_username,'employeeNo',employee_no,'displayName',trim(p_display_name),'roleCode','employee','mustResetPassword',true,'phoneBound',false),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('status','active','membershipId',new_membership,'memberId',new_member,'employeeNo',employee_no,'username',normalized_username);
end;
$_$;


--
-- Name: internal_anchor_apply_qualification_config("text", "text", "text", "text", "text", "text", "text", bigint, "jsonb", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_apply_qualification_config"("p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_actor_user_id" "text", "p_actor_membership_id" "text", "p_kind" "text", "p_entity_id" "text", "p_expected_version" bigint, "p_payload" "jsonb", "p_reason" "text", "p_idempotency_key" "text", "p_request_hash" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_id text;
  v_existing_version bigint;
  v_previous jsonb;
  v_after jsonb;
  v_now timestamptz := now();
  v_status text;
  v_count integer;
  v_existing_idempotency public.idempotency_keys%rowtype;
  v_response jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 or length(p_reason) > 500 then raise exception 'QUALIFICATION_CHANGE_REASON_REQUIRED'; end if;
  if p_kind not in ('catalog_pool','city_zone','entitlement_policy','purchase_limit','supplier_agreement','brand','store') then
    raise exception 'QUALIFICATION_CONFIG_KIND_INVALID';
  end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 8 or length(p_idempotency_key) > 120
    or length(trim(coalesce(p_request_hash,''))) < 16 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  if not exists (
    select 1 from public.memberships membership
    join public.users actor on actor.id = membership.context_user_id
    where membership.id = p_actor_membership_id and membership.context_user_id = p_actor_user_id
      and membership.tenant_id = p_tenant_id and membership.enterprise_id = p_enterprise_id
      and membership.mall_id = p_mall_id and membership.target = 'admin' and membership.status = 'active'
      and actor.status = 'active'
      and (membership.expires_at is null or membership.expires_at > v_now)
  ) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_mall_id||':qualification:config:'||p_idempotency_key,0));
  select * into v_existing_idempotency from public.idempotency_keys
  where mall_id=p_mall_id and scope='qualification:config' and idempotency_key=p_idempotency_key and expires_at>v_now;
  if found then
    if v_existing_idempotency.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing_idempotency.response_json;
  end if;

  v_id := nullif(trim(coalesce(p_entity_id, '')), '');
  v_status := trim(coalesce(p_payload ->> 'status', 'draft'));
  if v_status not in ('draft','active','disabled') then raise exception 'QUALIFICATION_STATUS_INVALID'; end if;

  if p_kind = 'catalog_pool' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'poolKind' not in ('selected','combined')
      or jsonb_typeof(p_payload -> 'skuIds') is distinct from 'array'
      or jsonb_array_length(p_payload -> 'skuIds') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if v_status = 'active' and jsonb_array_length(p_payload -> 'skuIds') = 0 then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_payload -> 'skuIds') requested(id)
      where not exists (select 1 from public.skus sku where sku.id = requested.id and sku.tenant_id = p_tenant_id and sku.mall_id = p_mall_id)
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;

    if v_id is null then
      v_id := 'pool-' || gen_random_uuid()::text;
      if coalesce(p_expected_version, 0) <> 0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.catalog_pools (id,tenant_id,owner_kind,owner_id,code,name,pool_kind,status,version,updated_at)
      values (v_id,p_tenant_id,'mall',p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'poolKind',v_status,1,v_now);
      v_existing_version := 1;
    else
      select version, to_jsonb(pool) into v_existing_version, v_previous from public.catalog_pools pool
      where pool.id = v_id and pool.tenant_id = p_tenant_id and pool.owner_kind = 'mall' and pool.owner_id = p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version <> v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.catalog_pools set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),pool_kind=p_payload ->> 'poolKind',status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version := v_existing_version + 1;
    end if;
    delete from public.catalog_pool_items where pool_id = v_id;
    insert into public.catalog_pool_items(pool_id,tenant_id,sku_id,status)
    select v_id,p_tenant_id,id,'active' from (select distinct value as id from jsonb_array_elements_text(p_payload -> 'skuIds')) requested;
    insert into public.mall_catalog_pool_bindings(mall_id,pool_id,tenant_id,listing_kind,status)
    values(p_mall_id,v_id,p_tenant_id,p_payload ->> 'poolKind',case when v_status='active' then 'active' else 'disabled' end)
    on conflict (mall_id,pool_id) do update set listing_kind=excluded.listing_kind,status=excluded.status;

  elsif p_kind = 'city_zone' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'appliesTo' not in ('visible','purchasable','both')
      or jsonb_typeof(p_payload -> 'cities') is distinct from 'array' or jsonb_array_length(p_payload -> 'cities') > 500
      or jsonb_typeof(p_payload -> 'resources') is distinct from 'array' or jsonb_array_length(p_payload -> 'resources') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if v_status = 'active' and (jsonb_array_length(p_payload -> 'cities') = 0 or jsonb_array_length(p_payload -> 'resources') = 0) then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists (select 1 from jsonb_array_elements(p_payload -> 'cities') city where length(trim(coalesce(city ->> 'code',''))) < 2 or length(trim(coalesce(city ->> 'name',''))) < 2)
      or exists (select 1 from jsonb_array_elements(p_payload -> 'resources') resource where resource ->> 'kind' not in ('product','sku')) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;

    if v_id is null then
      v_id := 'zone-' || gen_random_uuid()::text;
      if coalesce(p_expected_version, 0) <> 0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.city_zones(id,tenant_id,mall_id,code,name,applies_to,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'appliesTo',v_status,1,v_now);
      v_existing_version := 1;
    else
      select version,to_jsonb(zone) into v_existing_version,v_previous from public.city_zones zone where zone.id=v_id and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.city_zones set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),applies_to=p_payload ->> 'appliesTo',status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version := v_existing_version+1;
    end if;
    delete from public.city_zone_cities where zone_id=v_id;
    insert into public.city_zone_cities(zone_id,city_code,city_name,city_key)
    select distinct on (city_key) v_id,city_code,city_name,city_key from (
      select trim(city ->> 'code') city_code,trim(city ->> 'name') city_name,
        lower(regexp_replace(regexp_replace(trim(city ->> 'name'),'[[:space:]]+','','g'),'市$','')) city_key
      from jsonb_array_elements(p_payload -> 'cities') city
    ) normalized order by city_key,city_code;
    delete from public.city_zone_catalog_items where zone_id=v_id;
    insert into public.city_zone_catalog_items(zone_id,tenant_id,product_id,sku_id)
    select distinct v_id,p_tenant_id,case when resource ->> 'kind'='product' then resource ->> 'id' end,case when resource ->> 'kind'='sku' then resource ->> 'id' end
    from jsonb_array_elements(p_payload -> 'resources') resource;

  elsif p_kind = 'entitlement_policy' then
    if length(trim(coalesce(p_payload ->> 'name',''))) < 2 or p_payload ->> 'action' not in ('visible','purchasable')
      or p_payload ->> 'effect' not in ('allow','deny') or coalesce(p_payload ->> 'priority','') !~ '^[0-9]{1,5}$'
      or (p_payload ->> 'priority')::integer > 10000 or jsonb_typeof(p_payload -> 'subjects') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'resources') is distinct from 'array' or jsonb_array_length(p_payload -> 'subjects') > 200
      or jsonb_array_length(p_payload -> 'resources') > 500 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if jsonb_array_length(p_payload -> 'subjects')=0 or jsonb_array_length(p_payload -> 'resources')=0 then raise exception 'QUALIFICATION_ACTIVE_RESOURCE_EMPTY'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload -> 'subjects') item where item ->> 'kind' not in ('all','enterprise','department','user','membership','tag') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*')))
      or exists(select 1 from jsonb_array_elements(p_payload -> 'resources') item where item ->> 'kind' not in ('all','catalog_pool','product','sku','city_zone') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*'))) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where (resource ->> 'kind'='catalog_pool' and not exists(select 1 from public.catalog_pools pool where pool.id=resource ->> 'id' and pool.tenant_id=p_tenant_id and pool.owner_kind='mall' and pool.owner_id=p_mall_id))
         or (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
         or (resource ->> 'kind'='city_zone' and not exists(select 1 from public.city_zones zone where zone.id=resource ->> 'id' and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'policy-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.entitlement_policies(id,tenant_id,mall_id,name,action,effect,priority,reason_code,status,version,created_by_membership_id,updated_by_membership_id,updated_at)
      values(v_id,p_tenant_id,p_mall_id,trim(p_payload ->> 'name'),p_payload ->> 'action',p_payload ->> 'effect',(p_payload ->> 'priority')::integer,coalesce(nullif(trim(p_payload ->> 'reasonCode'),''),'POLICY_RULE'),v_status,1,p_actor_membership_id,p_actor_membership_id,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(policy) into v_existing_version,v_previous from public.entitlement_policies policy where policy.id=v_id and policy.tenant_id=p_tenant_id and policy.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.entitlement_policies set name=trim(p_payload ->> 'name'),action=p_payload ->> 'action',effect=p_payload ->> 'effect',priority=(p_payload ->> 'priority')::integer,reason_code=coalesce(nullif(trim(p_payload ->> 'reasonCode'),''),'POLICY_RULE'),status=v_status,version=version+1,updated_by_membership_id=p_actor_membership_id,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.entitlement_policy_subjects where policy_id=v_id;
    insert into public.entitlement_policy_subjects(policy_id,subject_kind,subject_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'subjects') item;
    delete from public.entitlement_policy_resources where policy_id=v_id;
    insert into public.entitlement_policy_resources(policy_id,resource_kind,resource_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'resources') item;

  elsif p_kind = 'purchase_limit' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2 or p_payload ->> 'countScope' not in ('sku','product')
      or jsonb_typeof(p_payload -> 'subjects') is distinct from 'array' or jsonb_typeof(p_payload -> 'resources') is distinct from 'array'
      or jsonb_array_length(p_payload -> 'subjects')=0 or jsonb_array_length(p_payload -> 'resources')=0 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if not exists (
      select 1 from jsonb_each_text(p_payload) pair
      where pair.key in ('maxPerOrderQty','maxDailyQty','maxMonthlyQty','maxLifetimeQty','maxPerOrderAmountCents','maxDailyAmountCents','maxMonthlyAmountCents','maxLifetimeAmountCents')
        and nullif(pair.value,'') is not null and pair.value ~ '^[1-9][0-9]{0,11}$'
    ) then raise exception 'QUALIFICATION_LIMIT_REQUIRED'; end if;
    if exists (
      select 1 from jsonb_each_text(p_payload) pair
      where pair.key in ('maxPerOrderQty','maxDailyQty','maxMonthlyQty','maxLifetimeQty','maxPerOrderAmountCents','maxDailyAmountCents','maxMonthlyAmountCents','maxLifetimeAmountCents')
        and nullif(pair.value,'') is not null and pair.value !~ '^[1-9][0-9]{0,11}$'
    ) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload -> 'subjects') item where item ->> 'kind' not in ('all','enterprise','department','user','membership','tag') or length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*')))
      or exists(select 1 from jsonb_array_elements(p_payload -> 'resources') item where length(trim(coalesce(item ->> 'id','')))=0 or ((item ->> 'kind'='all') <> (item ->> 'id'='*'))) then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'resources') resource
      where resource ->> 'kind' not in ('all','catalog_pool','product','sku','city_zone')
         or (resource ->> 'kind'='catalog_pool' and not exists(select 1 from public.catalog_pools pool where pool.id=resource ->> 'id' and pool.tenant_id=p_tenant_id and pool.owner_kind='mall' and pool.owner_id=p_mall_id))
         or (resource ->> 'kind'='product' and not exists(select 1 from public.products product where product.id=resource ->> 'id' and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id))
         or (resource ->> 'kind'='sku' and not exists(select 1 from public.skus sku where sku.id=resource ->> 'id' and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id))
         or (resource ->> 'kind'='city_zone' and not exists(select 1 from public.city_zones zone where zone.id=resource ->> 'id' and zone.tenant_id=p_tenant_id and zone.mall_id=p_mall_id))
    ) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'limit-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.purchase_limit_templates(id,tenant_id,mall_id,code,name,count_scope,max_per_order_qty,max_daily_qty,max_monthly_qty,max_lifetime_qty,max_per_order_amount_cents,max_daily_amount_cents,max_monthly_amount_cents,max_lifetime_amount_cents,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'countScope',nullif(p_payload ->> 'maxPerOrderQty','')::integer,nullif(p_payload ->> 'maxDailyQty','')::integer,nullif(p_payload ->> 'maxMonthlyQty','')::integer,nullif(p_payload ->> 'maxLifetimeQty','')::integer,nullif(p_payload ->> 'maxPerOrderAmountCents','')::bigint,nullif(p_payload ->> 'maxDailyAmountCents','')::bigint,nullif(p_payload ->> 'maxMonthlyAmountCents','')::bigint,nullif(p_payload ->> 'maxLifetimeAmountCents','')::bigint,v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(template) into v_existing_version,v_previous from public.purchase_limit_templates template where template.id=v_id and template.tenant_id=p_tenant_id and template.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.purchase_limit_templates set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),count_scope=p_payload ->> 'countScope',max_per_order_qty=nullif(p_payload ->> 'maxPerOrderQty','')::integer,max_daily_qty=nullif(p_payload ->> 'maxDailyQty','')::integer,max_monthly_qty=nullif(p_payload ->> 'maxMonthlyQty','')::integer,max_lifetime_qty=nullif(p_payload ->> 'maxLifetimeQty','')::integer,max_per_order_amount_cents=nullif(p_payload ->> 'maxPerOrderAmountCents','')::bigint,max_daily_amount_cents=nullif(p_payload ->> 'maxDailyAmountCents','')::bigint,max_monthly_amount_cents=nullif(p_payload ->> 'maxMonthlyAmountCents','')::bigint,max_lifetime_amount_cents=nullif(p_payload ->> 'maxLifetimeAmountCents','')::bigint,status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.purchase_limit_subjects where template_id=v_id;
    insert into public.purchase_limit_subjects(template_id,subject_kind,subject_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'subjects') item;
    delete from public.purchase_limit_resources where template_id=v_id;
    insert into public.purchase_limit_resources(template_id,resource_kind,resource_id)
    select distinct v_id,item ->> 'kind',item ->> 'id' from jsonb_array_elements(p_payload -> 'resources') item;

  elsif p_kind = 'supplier_agreement' then
    if length(trim(coalesce(p_payload ->> 'agreementCode',''))) < 2 or length(trim(coalesce(p_payload ->> 'supplierId',''))) < 2 then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if not exists(select 1 from public.suppliers supplier where supplier.id=p_payload ->> 'supplierId' and supplier.tenant_id=p_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'agreement-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.mall_supplier_agreements(id,tenant_id,mall_id,supplier_id,agreement_code,settlement_mode,status,version,updated_at)
      values(v_id,p_tenant_id,p_mall_id,p_payload ->> 'supplierId',trim(p_payload ->> 'agreementCode'),coalesce(nullif(trim(p_payload ->> 'settlementMode'),''),'manual'),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(agreement) into v_existing_version,v_previous from public.mall_supplier_agreements agreement where agreement.id=v_id and agreement.tenant_id=p_tenant_id and agreement.mall_id=p_mall_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.mall_supplier_agreements set supplier_id=p_payload ->> 'supplierId',agreement_code=trim(p_payload ->> 'agreementCode'),settlement_mode=coalesce(nullif(trim(p_payload ->> 'settlementMode'),''),'manual'),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;

  elsif p_kind = 'brand' then
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$' or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or jsonb_typeof(p_payload -> 'supplierIds') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'productIds') is distinct from 'array'
      or jsonb_typeof(p_payload -> 'authorizedInMall') is distinct from 'boolean' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'supplierIds') supplier_id where not exists(select 1 from public.suppliers supplier where supplier.id=supplier_id and supplier.tenant_id=p_tenant_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'productIds') product_id where not exists(select 1 from public.products product where product.id=product_id and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id := 'brand-' || gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.brands(id,tenant_id,code,name,status,version,updated_at) values(v_id,p_tenant_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(brand) into v_existing_version,v_previous from public.brands brand where brand.id=v_id and brand.tenant_id=p_tenant_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.brands set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.supplier_brand_bindings where brand_id=v_id;
    insert into public.supplier_brand_bindings(tenant_id,supplier_id,brand_id,relationship_kind,status)
    select p_tenant_id,supplier.value,v_id,'authorized',case when v_status='active' then 'active' else 'disabled' end
    from jsonb_array_elements_text(p_payload -> 'supplierIds') supplier(value);
    if coalesce((p_payload ->> 'authorizedInMall')::boolean,false) then
      insert into public.mall_brand_authorizations(id,tenant_id,mall_id,brand_id,status)
      values('brand-auth-'||p_mall_id||'-'||v_id,p_tenant_id,p_mall_id,v_id,case when v_status='active' then 'active' else 'disabled' end)
      on conflict(mall_id,brand_id) do update set status=excluded.status,updated_at=v_now;
    else
      delete from public.mall_brand_authorizations where mall_id=p_mall_id and brand_id=v_id;
    end if;
    update public.products set brand_id=null,updated_at=v_now where tenant_id=p_tenant_id and mall_id=p_mall_id and brand_id=v_id
      and id not in (select value from jsonb_array_elements_text(p_payload -> 'productIds'));
    update public.products set brand_id=v_id,updated_at=v_now where tenant_id=p_tenant_id and mall_id=p_mall_id
      and id in (select value from jsonb_array_elements_text(p_payload -> 'productIds'));

  else
    if coalesce(p_payload ->> 'code','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,79}$'
      or length(trim(coalesce(p_payload ->> 'name',''))) < 2
      or p_payload ->> 'storeType' not in ('online','offline','hybrid')
      or jsonb_typeof(p_payload -> 'brandIds') is distinct from 'array' then raise exception 'QUALIFICATION_CONFIG_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload -> 'brandIds') brand_id where not exists(select 1 from public.brands brand where brand.id=brand_id and brand.tenant_id=p_tenant_id)) then raise exception 'QUALIFICATION_RESOURCE_OUTSIDE_MALL'; end if;
    if v_id is null then
      v_id:='store-'||gen_random_uuid()::text;
      if coalesce(p_expected_version,0)<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      insert into public.stores(id,tenant_id,code,name,store_type,province_code,city_code,address_text,status,version,updated_at)
      values(v_id,p_tenant_id,upper(p_payload ->> 'code'),trim(p_payload ->> 'name'),p_payload ->> 'storeType',nullif(trim(p_payload ->> 'provinceCode'),''),nullif(trim(p_payload ->> 'cityCode'),''),nullif(trim(p_payload ->> 'addressText'),''),v_status,1,v_now);
      v_existing_version:=1;
    else
      select version,to_jsonb(store_row) into v_existing_version,v_previous from public.stores store_row where store_row.id=v_id and store_row.tenant_id=p_tenant_id for update;
      if not found then raise exception 'QUALIFICATION_CONFIG_NOT_FOUND'; end if;
      if p_expected_version is null or p_expected_version<>v_existing_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
      update public.stores set code=upper(p_payload ->> 'code'),name=trim(p_payload ->> 'name'),store_type=p_payload ->> 'storeType',province_code=nullif(trim(p_payload ->> 'provinceCode'),''),city_code=nullif(trim(p_payload ->> 'cityCode'),''),address_text=nullif(trim(p_payload ->> 'addressText'),''),status=v_status,version=version+1,updated_at=v_now where id=v_id;
      v_existing_version:=v_existing_version+1;
    end if;
    delete from public.brand_store_bindings where store_id=v_id;
    insert into public.brand_store_bindings(tenant_id,brand_id,store_id,relationship_kind,status)
    select p_tenant_id,brand.value,v_id,'authorized',case when v_status='active' then 'active' else 'disabled' end
    from (select distinct value from jsonb_array_elements_text(p_payload -> 'brandIds')) brand;
  end if;

  execute format('select to_jsonb(row_value) from public.%I row_value where id=$1', case p_kind when 'catalog_pool' then 'catalog_pools' when 'city_zone' then 'city_zones' when 'entitlement_policy' then 'entitlement_policies' when 'purchase_limit' then 'purchase_limit_templates' when 'supplier_agreement' then 'mall_supplier_agreements' when 'brand' then 'brands' else 'stores' end)
  into v_after using v_id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via,created_at)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.'||p_kind||'.save',p_kind,v_id,p_request_id,left(coalesce(p_user_agent,''),300),v_previous,v_after||jsonb_build_object('changeReason',trim(p_reason),'config',p_payload),p_actor_membership_id,p_granted_via,v_now);
  v_response:=jsonb_build_object('kind',p_kind,'id',v_id,'version',v_existing_version,'status',v_status,'updatedAt',v_now);
  insert into public.idempotency_keys(tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,created_at,expires_at)
  values(p_tenant_id,p_mall_id,'qualification:config',p_idempotency_key,p_request_hash,v_id,v_response,v_now,v_now+interval '24 hours');
  return v_response;
exception when unique_violation then
  raise exception 'QUALIFICATION_CODE_CONFLICT';
end;
$_$;


--
-- Name: internal_anchor_create_auth_session("uuid", "text", "text", "text", "text", "text", "text", timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_create_auth_session"("p_session_id" "uuid", "p_member_id" "text", "p_membership_id" "text", "p_target" "text", "p_ip_hash" "text", "p_user_agent" "text", "p_device_label" "text", "p_expires_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare version integer;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '8 hours 1 minute' then return false; end if;
  if not exists (
    select 1 from public.memberships ms join public.members m on m.id=ms.member_id
    where ms.id=p_membership_id and ms.member_id=p_member_id and ms.target=p_target
      and ms.status='active' and m.status='active'
  ) then return false; end if;
  select credential_version into version from public.member_credentials where member_id=p_member_id;
  insert into public.auth_sessions (
    id,member_id,membership_id,target,credential_version,ip_hash,user_agent,device_label,expires_at
  ) values (
    p_session_id,p_member_id,p_membership_id,p_target,version,p_ip_hash,
    left(coalesce(p_user_agent,''),300),left(p_device_label,100),p_expires_at
  );
  return true;
end;
$$;


--
-- Name: internal_anchor_create_custom_role("text", "text", "text", "text", "text", "text", "text", "text", "text"[], "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_create_custom_role"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_code" "text", "p_name" "text", "p_description" "text", "p_permission_codes" "text"[], "p_source_role_id" "text", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare actor public.memberships%rowtype; source_role public.roles%rowtype; actor_is_owner boolean; role_id text:='role-custom-'||gen_random_uuid()::text; requested text[];
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if lower(trim(coalesce(p_code,''))) !~ '^[a-z][a-z0-9_]{2,39}$' or length(trim(coalesce(p_name,''))) not between 2 and 60 or length(coalesce(p_description,''))>300 or length(trim(coalesce(p_reason,'')))<4 then raise exception 'CUSTOM_ROLE_INPUT_INVALID'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if p_source_role_id is not null then
    select * into source_role from public.roles where id=p_source_role_id and tenant_id=p_tenant_id and status='active';
    if not found then raise exception 'ROLE_NOT_FOUND'; end if;
    if source_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
    select coalesce(array_agg(p.code order by p.code),'{}') into requested from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=source_role.id;
  else requested:=coalesce(p_permission_codes,'{}'); end if;
  if cardinality(requested)>100 or exists(select 1 from unnest(requested) code where not exists(select 1 from public.permissions p where p.code=code)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  if not actor_is_owner and exists(select 1 from public.permissions p where p.code=any(requested) and not (
    exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.role_id=r.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
    and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  begin
    insert into public.roles(id,tenant_id,code,name,description,is_system,is_owner,is_editable,sort_order,status,created_by_membership_id)
    values(role_id,p_tenant_id,lower(trim(p_code)),trim(p_name),trim(coalesce(p_description,'')),false,false,true,200,'active',actor.id);
  exception when unique_violation then raise exception 'ROLE_CODE_CONFLICT'; end;
  insert into public.role_permissions(role_id,permission_id) select role_id,p.id from public.permissions p where p.code=any(requested);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','role.custom.created','role',role_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('code',lower(trim(p_code)),'name',trim(p_name),'permissions',requested,'sourceRoleId',p_source_role_id,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',role_id,'code',lower(trim(p_code)),'name',trim(p_name),'status','active','permissions',to_jsonb(requested));
end;
$_$;


--
-- Name: internal_anchor_create_membership_invite("text", "text", "text", "text", "text", "text", "text", integer, timestamp with time zone, "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_create_membership_invite"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_label" "text", "p_code_hash" "text", "p_max_uses" integer, "p_expires_at" timestamp with time zone, "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare invite_id text:='invite-'||gen_random_uuid()::text; employee_role text; actor public.memberships%rowtype;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id
    and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if not exists(select 1 from public.membership_scopes s where s.membership_id=actor.id and (
    (s.scope_kind='tenant' and s.resource_id=p_tenant_id) or (s.scope_kind='enterprise' and s.resource_id=p_enterprise_id)
    or (s.scope_kind='mall' and s.resource_id=p_mall_id))) then raise exception 'SCOPE_MISMATCH'; end if;
  if length(trim(coalesce(p_label,''))) not between 2 and 80 or length(coalesce(p_code_hash,'')) not between 40 and 128
    or p_max_uses not between 1 and 500 or p_expires_at<=now()+interval '10 minutes'
    or p_expires_at>now()+interval '90 days' then raise exception 'INVALID_INVITATION_INPUT'; end if;
  select id into employee_role from public.roles where tenant_id=p_tenant_id and code='employee' and not is_owner;
  if employee_role is null then raise exception 'EMPLOYEE_ROLE_NOT_FOUND'; end if;
  insert into public.membership_registration_invites(
    id,label,code_hash,tenant_id,enterprise_id,mall_id,role_id,target,max_uses,expires_at,created_by_membership_id
  ) values(invite_id,trim(p_label),p_code_hash,p_tenant_id,p_enterprise_id,p_mall_id,employee_role,'storefront',p_max_uses,p_expires_at,p_actor_membership_id);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.invitation.created','membership_invitation',invite_id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('label',trim(p_label),'maxUses',p_max_uses,'expiresAt',p_expires_at,'roleCode','employee'),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('id',invite_id,'label',trim(p_label),'maxUses',p_max_uses,'expiresAt',p_expires_at,'status','active');
end;
$$;


--
-- Name: internal_anchor_custom_role_center("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_custom_role_center"("p_actor_membership_id" "text", "p_tenant_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare actor public.memberships%rowtype; actor_is_owner boolean;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then return null; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  return jsonb_build_object(
    'roles',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'code',r.code,'name',r.name,'description',r.description,'status',r.status,
      'isSystem',r.is_system,'isOwner',r.is_owner,'isEditable',r.is_editable,
      'assignmentCount',(select count(*) from public.membership_roles mr where mr.role_id=r.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at>now())),
      'permissions',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb),
      'createdAt',r.created_at,'updatedAt',r.updated_at
    ) order by case when r.status='active' then 0 else 1 end,r.sort_order,r.name) from public.roles r where r.tenant_id=p_tenant_id),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(jsonb_build_object(
      'code',p.code,'name',p.name,'category',p.category,'risk',p.risk_level,'mvp',p.is_mvp,
      'grantable',actor_is_owner or (exists(select 1 from public.membership_roles mr join public.roles ar on ar.id=mr.role_id and ar.status='active' join public.role_permissions rp on rp.role_id=ar.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
        and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now())))
    ) order by p.category,p.code) from public.permissions p),'[]'::jsonb)
  );
end;
$$;


--
-- Name: internal_anchor_disable_membership_invite("text", "text", "text", "text", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_disable_membership_invite"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_invite_id" "text", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare invitation public.membership_registration_invites%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'CHANGE_REASON_REQUIRED'; end if;
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into invitation from public.membership_registration_invites where id=p_invite_id and tenant_id=p_tenant_id
    and enterprise_id=p_enterprise_id and mall_id=p_mall_id for update;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  update public.membership_registration_invites set status='disabled' where id=invitation.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.invitation.disabled','membership_invitation',invitation.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('status',invitation.status),jsonb_build_object('status','disabled','reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('id',invitation.id,'status','disabled');
end;
$$;


--
-- Name: internal_anchor_has_permissions("text", "text"[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_has_permissions"("p_membership_id" "text", "p_permission_codes" "text"[], "p_require_all" boolean DEFAULT true) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when coalesce(cardinality(p_permission_codes),0)=0 then false
    when p_require_all then not exists(
      select 1 from unnest(p_permission_codes) code
      where not public.api_membership_has_permission(p_membership_id,code)
    )
    else exists(
      select 1 from unnest(p_permission_codes) code
      where public.api_membership_has_permission(p_membership_id,code)
    )
  end;
$$;


--
-- Name: internal_anchor_initial_change_local_password("text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_initial_change_local_password"("p_member_id" "text", "p_password_hash" "text", "p_request_id" "text", "p_user_agent" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target_member public.members%rowtype; storefront_membership public.memberships%rowtype; changed integer;
begin
  if length(p_password_hash) not between 40 and 1024 then return false; end if;
  select * into target_member from public.members where id=p_member_id and status='active';
  if not found then return false; end if;
  update public.member_credentials set password_hash=p_password_hash,password_changed_at=now(),
    must_reset_password=false,credential_version=credential_version+1,updated_at=now()
  where member_id=p_member_id and must_reset_password=true;
  get diagnostics changed=row_count;
  if changed<>1 then return false; end if;
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now()),revoked_reason=coalesce(revoked_reason,'initial_password_changed')
  where member_id=p_member_id and revoked_at is null;
  select ms.* into storefront_membership from public.memberships ms
  where ms.member_id=p_member_id and ms.target='storefront' order by ms.created_at limit 1;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id)
  values(gen_random_uuid()::text,storefront_membership.tenant_id,storefront_membership.enterprise_id,storefront_membership.mall_id,target_member.user_id,'user','member.initial_password.changed','member',p_member_id,
    p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('otherSessionsRevoked',true),storefront_membership.id);
  return true;
end;
$$;


--
-- Name: internal_anchor_member_operations_center("text", "text", "text", "text", boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_member_operations_center"("p_actor_membership_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_include_pii" boolean DEFAULT false, "p_include_history" boolean DEFAULT false, "p_include_import_errors" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare actor public.memberships%rowtype;
begin
  select * into actor from public.memberships
  where id=p_actor_membership_id and tenant_id=p_tenant_id
    and enterprise_id=p_enterprise_id and target='admin' and status='active';
  if not found then return null; end if;
  return jsonb_build_object(
    'profiles',coalesce((select jsonb_agg(jsonb_build_object(
      'membershipId',ms.id,'memberId',ms.member_id,'userId',u.id,
      'displayName',u.display_name,'employeeNo',u.employee_no,
      'username',(select a.subject from public.member_login_aliases a where a.member_id=ms.member_id and a.provider='local_username' limit 1),
      'email',case when p_include_pii then u.email else null end,
      'mobileMasked',case when p_include_pii then u.mobile_masked else null end,
      'phoneBound',exists(select 1 from public.member_login_aliases a where a.member_id=ms.member_id and a.provider='local_phone'),
      'departmentId',u.department_id,'departmentName',d.name,
      'target',ms.target,'status',ms.status,'authzVersion',ms.authz_version,
      'isOwner',exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=ms.id and mr.revoked_at is null and r.is_owner),
      'createdAt',ms.created_at
    ) order by u.display_name)
      from public.memberships ms join public.members m on m.id=ms.member_id
      join public.users u on u.id=m.user_id left join public.departments d on d.id=u.department_id
      where ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id
        and (ms.mall_id is null or ms.mall_id=p_mall_id)
        and (exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='tenant' and s.resource_id=p_tenant_id)
          or exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='enterprise' and s.resource_id=ms.enterprise_id)
          or exists(select 1 from public.membership_scopes s where s.membership_id=p_actor_membership_id and s.scope_kind='mall' and s.resource_id=ms.mall_id)
          or ms.id=p_actor_membership_id)), '[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'label',i.label,'target',i.target,'maxUses',i.max_uses,
      'useCount',i.use_count,'startsAt',i.starts_at,'expiresAt',i.expires_at,
      'status',case when i.status='active' and i.expires_at<=now() then 'expired' else i.status end,
      'createdAt',i.created_at
    ) order by i.created_at desc) from public.membership_registration_invites i
      where i.tenant_id=p_tenant_id and i.enterprise_id=p_enterprise_id and i.mall_id=p_mall_id), '[]'::jsonb),
    'imports',coalesce((select jsonb_agg(jsonb_build_object(
      'id',j.id,'sourceName',j.source_name,'status',j.status,'totalRows',j.total_rows,
      'successRows',j.success_rows,'failedRows',j.failed_rows,'createdAt',j.created_at,
      'errors',case when p_include_import_errors then coalesce((select jsonb_agg(jsonb_build_object(
        'rowNumber',e.row_number,'code',e.error_code,'message',e.message,'input',e.input_json
      ) order by e.row_number) from public.membership_import_errors e where e.job_id=j.id),'[]'::jsonb) else '[]'::jsonb end
    ) order by j.created_at desc) from (select * from public.membership_import_jobs
      where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id
      order by created_at desc limit 30) j), '[]'::jsonb),
    'history',case when p_include_history then coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'action',a.action,'resourceType',a.resource_type,'resourceId',a.resource_id,
      'actorUserId',a.actor_user_id,'before',a.before_json,'after',a.after_json,'createdAt',a.created_at
    ) order by a.created_at desc) from (select * from public.audit_logs
      where tenant_id=p_tenant_id and enterprise_id=p_enterprise_id
        and (mall_id is null or mall_id=p_mall_id) and action like 'member.%'
      order by created_at desc limit 100) a), '[]'::jsonb) else '[]'::jsonb end,
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name)
      from public.departments d where d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id), '[]'::jsonb)
  );
end;
$$;


--
-- Name: internal_anchor_permission_command_center("text", "text", "text", "text", boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_permission_command_center"("p_actor_membership_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_include_pii" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare actor public.memberships%rowtype;
begin
  select membership.* into actor from public.memberships membership
  join public.members member on member.id=membership.member_id
  where membership.id=p_actor_membership_id and membership.tenant_id=p_tenant_id
    and membership.enterprise_id=p_enterprise_id and membership.target='admin'
    and membership.status='active' and member.status='active'
    and (membership.expires_at is null or membership.expires_at>now());
  if not found then return null; end if;
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'membershipId',ms.id,'memberId',ms.member_id,'displayName',u.display_name,'employeeNo',u.employee_no,
      'email',case when p_include_pii then u.email else null end,'mobileMasked',case when p_include_pii then u.mobile_masked else null end,
      'target',ms.target,'status',ms.status,'authzVersion',ms.authz_version,'isSelf',ms.id=p_actor_membership_id,
      'isOwner',exists(select 1 from public.membership_roles omr join public.roles owner_role on owner_role.id=omr.role_id where omr.membership_id=ms.id and omr.revoked_at is null and owner_role.is_owner),
      'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name) order by r.sort_order,r.name) from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=ms.id and mr.revoked_at is null and r.status='active' and (mr.expires_at is null or mr.expires_at>now())),'[]'::jsonb),
      'scopes',coalesce((select jsonb_agg(jsonb_build_object('kind',s.scope_kind,'resourceId',s.resource_id) order by s.scope_kind,s.resource_id) from public.membership_scopes s where s.membership_id=ms.id),'[]'::jsonb),
      'deniedPermissions',coalesce((select jsonb_agg(p.code order by p.code) from public.membership_permission_overrides mpo join public.permissions p on p.id=mpo.permission_id where mpo.membership_id=ms.id and mpo.effect='deny' and mpo.revoked_at is null and (mpo.expires_at is null or mpo.expires_at>now())),'[]'::jsonb)
    ) order by u.display_name) from public.memberships ms join public.members m on m.id=ms.member_id join public.users u on u.id=m.user_id
      where ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and (ms.mall_id is null or ms.mall_id=p_mall_id)
        and (public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',ms.enterprise_id) or public.api_actor_can_grant_scope(p_actor_membership_id,'mall',ms.mall_id) or ms.id=p_actor_membership_id)),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'description',r.description,'status',r.status,'isSystem',r.is_system,'isOwner',r.is_owner,'isEditable',r.is_editable,'permissions',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb)) order by r.sort_order,r.name) from public.roles r where r.tenant_id=p_tenant_id),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(jsonb_build_object('code',p.code,'name',p.name,'category',p.category,'risk',p.risk_level,'mvp',p.is_mvp) order by p.category,p.code) from public.permissions p),'[]'::jsonb),
    'scopeOptions',jsonb_build_object(
      'platform',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from public.org_units o where o.kind='platform' and o.status='active' and public.api_actor_can_grant_scope(p_actor_membership_id,'platform',o.id)),'[]'::jsonb),
      'distributor',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name) from public.distributors d join public.distributor_tenants relation on relation.distributor_id=d.id where d.status='active' and relation.tenant_id=p_tenant_id and relation.status='active' and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now()) and public.api_actor_can_grant_scope(p_actor_membership_id,'distributor',d.id)),'[]'::jsonb),
      'tenant',case when public.api_actor_can_grant_scope(p_actor_membership_id,'tenant',p_tenant_id) then jsonb_build_array(jsonb_build_object('id',p_tenant_id,'name','Smart Wing 安全租户')) else '[]'::jsonb end,
      'enterprise',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name) order by e.name) from public.enterprises e where e.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',e.id)),'[]'::jsonb),
      'mall',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) order by m.name) from public.malls m where m.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'mall',m.id)),'[]'::jsonb),
      'supplier',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.suppliers s where s.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'supplier',s.id)),'[]'::jsonb),
      'brand',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name) from public.brands b where b.tenant_id=p_tenant_id and b.status<>'disabled' and public.api_actor_can_grant_scope(p_actor_membership_id,'brand',b.id)),'[]'::jsonb),
      'store',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name) from public.stores s where s.tenant_id=p_tenant_id and s.status<>'disabled' and public.api_actor_can_grant_scope(p_actor_membership_id,'store',s.id)),'[]'::jsonb),
      'department',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name) from public.departments d where d.tenant_id=p_tenant_id and public.api_actor_can_grant_scope(p_actor_membership_id,'department',d.id)),'[]'::jsonb)
    )
  );
end;
$$;


--
-- Name: internal_anchor_record_member_import("text", "text", "text", "text", "text", "text", integer, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_record_member_import"("p_job_id" "text", "p_actor_membership_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_source_name" "text", "p_total_rows" integer, "p_success_rows" integer, "p_errors" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare item jsonb; failed integer:=jsonb_array_length(coalesce(p_errors,'[]'::jsonb)); job_status text;
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if p_total_rows not between 1 and 500 or p_success_rows<0 or p_success_rows+failed<>p_total_rows
    or length(trim(coalesce(p_source_name,''))) not between 1 and 200 then raise exception 'INVALID_IMPORT_SUMMARY'; end if;
  job_status:=case when failed=0 then 'completed' when p_success_rows=0 then 'failed' else 'partial' end;
  insert into public.membership_import_jobs(id,tenant_id,enterprise_id,mall_id,actor_membership_id,source_name,status,total_rows,success_rows,failed_rows)
  values(p_job_id,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_membership_id,trim(p_source_name),job_status,p_total_rows,p_success_rows,failed);
  for item in select value from jsonb_array_elements(coalesce(p_errors,'[]'::jsonb)) loop
    insert into public.membership_import_errors(job_id,row_number,error_code,message,input_json)
    values(p_job_id,(item->>'rowNumber')::integer,left(item->>'code',80),left(item->>'message',300),coalesce(item->'input','{}'::jsonb));
  end loop;
  return jsonb_build_object('id',p_job_id,'status',job_status,'totalRows',p_total_rows,'successRows',p_success_rows,'failedRows',failed,'errors',coalesce(p_errors,'[]'::jsonb));
end;
$$;


--
-- Name: internal_anchor_record_step_up("text", "text", "text", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_record_step_up"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_request_id" "text", "p_user_agent" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id and ms.tenant_id=p_tenant_id and ms.status='active') then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','auth.step_up.succeeded','membership',p_actor_membership_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('verifiedAt',now()),p_actor_membership_id,jsonb_build_object('method','current_password'));
  return true;
end;
$$;


--
-- Name: internal_anchor_request_qualification_change("text", "text", "text", "text", "text", "text", "text", bigint, "jsonb", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_request_qualification_change"("p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_actor_user_id" "text", "p_actor_membership_id" "text", "p_kind" "text", "p_entity_id" "text", "p_expected_version" bigint, "p_payload" "jsonb", "p_reason" "text", "p_idempotency_key" "text", "p_request_hash" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_preview jsonb; v_id text:='qualification-change-'||gen_random_uuid()::text; v_existing public.qualification_change_requests%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'QUALIFICATION_CHANGE_REASON_REQUIRED'; end if;
  if length(trim(coalesce(p_idempotency_key,'')))<8 or length(p_idempotency_key)>120 or length(trim(coalesce(p_request_hash,'')))<16 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  if not exists(select 1 from public.memberships membership join public.users actor on actor.id=membership.context_user_id where membership.id=p_actor_membership_id and membership.context_user_id=p_actor_user_id and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='admin' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and actor.status='active') then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_mall_id||':qualification:approval:'||p_actor_membership_id||':'||p_idempotency_key,0));
  select * into v_existing from public.qualification_change_requests where mall_id=p_mall_id and requested_by_membership_id=p_actor_membership_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('approvalRequired',true,'changeRequestId',v_existing.id,'status',v_existing.status,'preview',v_existing.preview_json);
  end if;
  if coalesce(public.api_qualification_entity_version(p_tenant_id,p_mall_id,p_kind,p_entity_id),-1)<>p_expected_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
  v_preview:=public.api_qualification_change_preview(p_tenant_id,p_enterprise_id,p_mall_id,p_kind,p_entity_id,p_payload);
  if not coalesce((v_preview->>'requiresApproval')::boolean,false) then raise exception 'QUALIFICATION_APPROVAL_NOT_REQUIRED'; end if;
  insert into public.qualification_change_requests(id,tenant_id,enterprise_id,mall_id,config_kind,entity_id,expected_version,requested_status,payload_json,preview_json,reason,risk_level,requested_by_user_id,requested_by_membership_id,idempotency_key,request_hash)
  values(v_id,p_tenant_id,p_enterprise_id,p_mall_id,p_kind,nullif(trim(coalesce(p_entity_id,'')),''),p_expected_version,p_payload->>'status',p_payload,v_preview,trim(p_reason),v_preview->>'riskLevel',p_actor_user_id,p_actor_membership_id,p_idempotency_key,p_request_hash);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.change.request','qualification_change_request',v_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('reason',trim(p_reason),'preview',v_preview,'kind',p_kind,'entityId',p_entity_id),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('approvalRequired',true,'changeRequestId',v_id,'status','pending','preview',v_preview);
exception when unique_violation then raise exception 'QUALIFICATION_APPROVAL_ALREADY_PENDING';
end;
$$;


--
-- Name: internal_anchor_set_custom_role_status("text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_set_custom_role_status"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_role_id" "text", "p_status" "text", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare actor public.memberships%rowtype; target_role public.roles%rowtype; affected integer:=0;
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target_role from public.roles where id=p_role_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if target_role.is_system or not target_role.is_editable then raise exception 'SYSTEM_ROLE_READ_ONLY'; end if;
  if p_status not in ('active','disabled') or length(trim(coalesce(p_reason,'')))<4 then raise exception 'CUSTOM_ROLE_STATUS_INVALID'; end if;
  if p_status='disabled' and exists(select 1 from public.membership_roles mr where mr.membership_id=actor.id and mr.role_id=target_role.id and mr.revoked_at is null) then raise exception 'SELF_ROLE_MUTATION_FORBIDDEN'; end if;
  if p_status='disabled' then
    update public.membership_roles set revoked_at=now() where role_id=target_role.id and revoked_at is null;
    get diagnostics affected=row_count;
  end if;
  update public.roles set status=p_status,updated_at=now() where id=target_role.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin',case when p_status='disabled' then 'role.custom.disabled' else 'role.custom.enabled' end,'role',target_role.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('status',target_role.status),jsonb_build_object('status',p_status,'revokedAssignments',affected,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',target_role.id,'status',p_status,'revokedAssignments',affected);
end;
$$;


--
-- Name: internal_anchor_update_custom_role("text", "text", "text", "text", "text", "text", "text", "text", "text"[], "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_update_custom_role"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_role_id" "text", "p_name" "text", "p_description" "text", "p_permission_codes" "text"[], "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare actor public.memberships%rowtype; target_role public.roles%rowtype; actor_is_owner boolean; requested text[]:=coalesce(p_permission_codes,'{}'); before_permissions text[];
begin
  select * into actor from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and target='admin' and status='active';
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target_role from public.roles where id=p_role_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if target_role.is_system or not target_role.is_editable then raise exception 'SYSTEM_ROLE_READ_ONLY'; end if;
  if exists(select 1 from public.membership_roles mr where mr.membership_id=actor.id and mr.role_id=target_role.id and mr.revoked_at is null) then raise exception 'SELF_ROLE_MUTATION_FORBIDDEN'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 60 or length(coalesce(p_description,''))>300 or length(trim(coalesce(p_reason,'')))<4 or cardinality(requested)>100 then raise exception 'CUSTOM_ROLE_INPUT_INVALID'; end if;
  if exists(select 1 from unnest(requested) code where not exists(select 1 from public.permissions p where p.code=code)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=actor.id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and exists(select 1 from public.permissions p where p.code=any(requested) and not (
    exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id and r.status='active' join public.role_permissions rp on rp.role_id=r.id where mr.membership_id=actor.id and mr.revoked_at is null and rp.permission_id=p.id)
    and not exists(select 1 from public.membership_permission_overrides deny where deny.membership_id=actor.id and deny.permission_id=p.id and deny.effect='deny' and deny.revoked_at is null and (deny.expires_at is null or deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  select coalesce(array_agg(p.code order by p.code),'{}') into before_permissions from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=target_role.id;
  update public.roles set name=trim(p_name),description=trim(coalesce(p_description,'')),updated_at=now() where id=target_role.id;
  delete from public.role_permissions where role_id=target_role.id;
  insert into public.role_permissions(role_id,permission_id) select target_role.id,p.id from public.permissions p where p.code=any(requested);
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','role.custom.updated','role',target_role.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('name',target_role.name,'description',target_role.description,'permissions',before_permissions),jsonb_build_object('name',trim(p_name),'description',trim(coalesce(p_description,'')),'permissions',requested,'reason',trim(p_reason)),actor.id,p_granted_via);
  return jsonb_build_object('id',target_role.id,'status',target_role.status,'permissions',to_jsonb(requested));
end;
$$;


--
-- Name: internal_anchor_update_employee_qualification("text", "text", "text", "text", "text", "text", bigint, "text", "text", "text", "jsonb", "jsonb", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_update_employee_qualification"("p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_actor_user_id" "text", "p_actor_membership_id" "text", "p_user_id" "text", "p_expected_version" bigint, "p_city_code" "text", "p_city_name" "text", "p_status" "text", "p_attributes" "jsonb", "p_tags" "jsonb", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_previous jsonb; v_version bigint; v_after jsonb;
begin
  if p_status not in ('active','disabled') or jsonb_typeof(p_attributes) is distinct from 'object' or jsonb_typeof(p_tags) is distinct from 'array' or length(trim(coalesce(p_reason,'')))<4 then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if not exists(select 1 from public.memberships where id=p_actor_membership_id and context_user_id=p_actor_user_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id and mall_id=p_mall_id and target='admin' and status='active' and (expires_at is null or expires_at>now())) then raise exception 'QUALIFICATION_ACTOR_INVALID'; end if;
  if not exists(select 1 from public.memberships membership join public.users user_row on user_row.id=membership.context_user_id where membership.context_user_id=p_user_id and membership.tenant_id=p_tenant_id and membership.enterprise_id=p_enterprise_id and membership.mall_id=p_mall_id and membership.target='storefront' and membership.status='active' and (membership.expires_at is null or membership.expires_at>now()) and user_row.status='active') then raise exception 'EMPLOYEE_QUALIFICATION_USER_NOT_FOUND'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) tag where length(trim(coalesce(tag->>'code','')))<1 or length(tag->>'code')>64 or tag->>'code' ~ '[[:space:],]') then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) tag where nullif(tag->>'startsAt','') is not null and (tag->>'startsAt')::timestamptz is null) or exists(select 1 from jsonb_array_elements(p_tags) tag where nullif(tag->>'endsAt','') is not null and (tag->>'endsAt')::timestamptz is null) then raise exception 'EMPLOYEE_QUALIFICATION_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) requested join public.employee_qualification_tags existing on existing.user_id=p_user_id and existing.tag_code=trim(requested->>'code') where existing.source<>'manual') then raise exception 'EMPLOYEE_QUALIFICATION_TAG_SOURCE_CONFLICT'; end if;
  select version,to_jsonb(profile) into v_version,v_previous from public.employee_qualification_profiles profile where user_id=p_user_id for update;
  v_previous:=coalesce(v_previous,'{}'::jsonb)||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('code',tag_code,'startsAt',starts_at,'endsAt',ends_at,'source',source)) from public.employee_qualification_tags where user_id=p_user_id),'[]'::jsonb));
  if found then
    if p_expected_version<>v_version then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
    update public.employee_qualification_profiles set city_code=nullif(trim(coalesce(p_city_code,'')),''),city_name=nullif(trim(coalesce(p_city_name,'')),''),status=p_status,attributes_json=p_attributes,version=version+1,updated_at=now() where user_id=p_user_id returning version into v_version;
  else
    if p_expected_version<>0 then raise exception 'QUALIFICATION_VERSION_CONFLICT'; end if;
    insert into public.employee_qualification_profiles(tenant_id,user_id,city_code,city_name,status,attributes_json,version) values(p_tenant_id,p_user_id,nullif(trim(coalesce(p_city_code,'')),''),nullif(trim(coalesce(p_city_name,'')),''),p_status,p_attributes,1) returning version into v_version;
  end if;
  delete from public.employee_qualification_tags where user_id=p_user_id and source='manual';
  insert into public.employee_qualification_tags(tenant_id,user_id,tag_code,starts_at,ends_at,source)
  select p_tenant_id,p_user_id,trim(tag->>'code'),nullif(tag->>'startsAt','')::timestamptz,nullif(tag->>'endsAt','')::timestamptz,'manual' from jsonb_array_elements(p_tags) tag on conflict(user_id,tag_code) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at where employee_qualification_tags.source='manual';
  select to_jsonb(profile)||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('code',tag_code,'startsAt',starts_at,'endsAt',ends_at,'source',source)) from public.employee_qualification_tags where user_id=p_user_id),'[]'::jsonb)) into v_after from public.employee_qualification_profiles profile where user_id=p_user_id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','qualification.employee.update','employee_qualification',p_user_id,p_request_id,left(coalesce(p_user_agent,''),300),v_previous,v_after||jsonb_build_object('changeReason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('userId',p_user_id,'version',v_version,'status',p_status);
end;
$$;


--
-- Name: internal_anchor_update_member_profile("text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_update_member_profile"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_target_membership_id" "text", "p_display_name" "text", "p_email" "text", "p_department_id" "text", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.memberships%rowtype; target_user public.users%rowtype; department_changed boolean;
begin
  if length(trim(coalesce(p_display_name,''))) not between 1 and 60 or length(coalesce(p_email,''))>200
    or length(trim(coalesce(p_reason,'')))<4 then raise exception 'INVALID_MEMBER_PROFILE'; end if;
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id
    and ms.tenant_id=p_tenant_id and ms.enterprise_id=p_enterprise_id and ms.target='admin' and ms.status='active') then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select * into target from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target.id and mr.revoked_at is null and r.is_owner) then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  if p_department_id is not null and not exists(select 1 from public.departments d where d.id=p_department_id and d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;
  select u.* into target_user from public.members m join public.users u on u.id=m.user_id where m.id=target.member_id for update of u;
  department_changed:=target_user.department_id is distinct from p_department_id;
  update public.users set display_name=trim(p_display_name),email=nullif(trim(p_email),''),department_id=p_department_id,updated_at=now() where id=target_user.id;
  if department_changed then update public.memberships set authz_version=authz_version+1,updated_at=now() where member_id=target.member_id; end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','member.profile.updated','membership',target.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('displayName',target_user.display_name,'email',target_user.email,'departmentId',target_user.department_id),
    jsonb_build_object('displayName',trim(p_display_name),'email',nullif(trim(p_email),''),'departmentId',p_department_id,'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target.id,'status','updated','authzVersion',(select authz_version from public.memberships where id=target.id));
end;
$$;


--
-- Name: internal_anchor_update_membership_access("text", "text", "text", "text", "text", "text", "text"[], "jsonb", "text"[], "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_update_membership_access"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_target_membership_id" "text", "p_role_ids" "text"[], "p_scopes" "jsonb", "p_denied_permission_codes" "text"[], "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target_membership public.memberships%rowtype; scope_item jsonb; target_is_owner boolean; actor_is_owner boolean; requested_role_id text; permission_id text;
begin
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'ACCESS_CHANGE_REASON_REQUIRED'; end if;
  if p_target_membership_id=p_actor_membership_id then raise exception 'SELF_ACCESS_MUTATION_FORBIDDEN'; end if;
  if jsonb_typeof(coalesce(p_scopes,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_scopes,'[]'::jsonb))<1 then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  select * into target_membership from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target_membership.id and mr.revoked_at is null and r.is_owner) into target_is_owner;
  if target_is_owner then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  if exists(select 1 from unnest(coalesce(p_role_ids,'{}')) requested where not exists(select 1 from public.roles r where r.id=requested and r.tenant_id=p_tenant_id and r.status='active')) then raise exception 'ROLE_NOT_FOUND'; end if;
  if exists(select 1 from public.roles r where r.id=any(coalesce(p_role_ids,'{}')) and r.is_owner) then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if exists(select 1 from unnest(coalesce(p_denied_permission_codes,'{}')) requested where not exists(select 1 from public.permissions p where p.code=requested)) then raise exception 'PERMISSION_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=p_actor_membership_id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and not (public.api_actor_can_grant_scope(p_actor_membership_id,'enterprise',target_membership.enterprise_id) or public.api_actor_can_grant_scope(p_actor_membership_id,'mall',target_membership.mall_id)) then raise exception 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE'; end if;
  if not actor_is_owner and exists(select 1 from public.roles requested_role join public.role_permissions requested_grant on requested_grant.role_id=requested_role.id where requested_role.id=any(coalesce(p_role_ids,'{}')) and (
    not exists(select 1 from public.membership_roles actor_role join public.roles ar on ar.id=actor_role.role_id and ar.status='active' join public.role_permissions actor_grant on actor_grant.role_id=ar.id where actor_role.membership_id=p_actor_membership_id and actor_role.revoked_at is null and actor_grant.permission_id=requested_grant.permission_id)
    or exists(select 1 from public.membership_permission_overrides actor_deny where actor_deny.membership_id=p_actor_membership_id and actor_deny.permission_id=requested_grant.permission_id and actor_deny.effect='deny' and actor_deny.revoked_at is null and (actor_deny.expires_at is null or actor_deny.expires_at>now()))
  )) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) requested_scope where not public.api_actor_can_grant_scope(p_actor_membership_id,requested_scope->>'kind',requested_scope->>'resourceId')) then raise exception 'SCOPE_GRANT_EXCEEDS_ACTOR'; end if;
  update public.membership_roles set revoked_at=now() where membership_id=target_membership.id and revoked_at is null;
  foreach requested_role_id in array coalesce(p_role_ids,'{}') loop
    insert into public.membership_roles(membership_id,role_id,granted_by_membership_id,granted_at,expires_at,revoked_at)
    values(target_membership.id,requested_role_id,p_actor_membership_id,now(),null,null)
    on conflict on constraint membership_roles_pkey do update set granted_by_membership_id=excluded.granted_by_membership_id,granted_at=now(),expires_at=null,revoked_at=null;
  end loop;
  delete from public.membership_scopes where membership_id=target_membership.id;
  for scope_item in select value from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) loop insert into public.membership_scopes(membership_id,scope_kind,resource_id) values(target_membership.id,scope_item->>'kind',scope_item->>'resourceId'); end loop;
  update public.membership_permission_overrides set revoked_at=now() where membership_id=target_membership.id and effect='deny' and revoked_at is null;
  for permission_id in select p.id from public.permissions p where p.code=any(coalesce(p_denied_permission_codes,'{}')) loop
    insert into public.membership_permission_overrides(membership_id,permission_id,effect,granted_by_membership_id,reason,revoked_at) values(target_membership.id,permission_id,'deny',p_actor_membership_id,trim(p_reason),null)
    on conflict on constraint membership_permission_overrides_pkey do update set effect='deny',granted_by_membership_id=p_actor_membership_id,reason=trim(p_reason),expires_at=null,revoked_at=null,created_at=now();
  end loop;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','membership.access.updated','membership',target_membership.id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('roleIds',coalesce(p_role_ids,'{}'),'scopes',coalesce(p_scopes,'[]'::jsonb),'deniedPermissions',coalesce(p_denied_permission_codes,'{}'),'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target_membership.id,'authzVersion',(select authz_version from public.memberships where id=target_membership.id));
end;
$$;


--
-- Name: internal_anchor_update_membership_status("text", "text", "text", "text", "text", "text", "text", "text", "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_anchor_update_membership_status"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_target_membership_id" "text", "p_status" "text", "p_reason" "text", "p_request_id" "text", "p_user_agent" "text", "p_granted_via" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target public.memberships%rowtype; actor_is_owner boolean;
begin
  if p_status not in ('active','suspended','offboarded') then raise exception 'MEMBERSHIP_STATUS_INVALID'; end if;
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'ACCESS_CHANGE_REASON_REQUIRED'; end if;
  if p_target_membership_id=p_actor_membership_id then raise exception 'SELF_ACCESS_MUTATION_FORBIDDEN'; end if;
  select * into target from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=p_actor_membership_id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and not (
    exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=target.enterprise_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='mall' and actor_scope.resource_id=target.mall_id)
  ) then raise exception 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE'; end if;
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target.id and mr.revoked_at is null and r.is_owner) then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  update public.memberships set status=p_status where id=target.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','membership.status.updated','membership',target.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('status',target.status),jsonb_build_object('status',p_status,'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target.id,'status',p_status,'authzVersion',(select authz_version from public.memberships where id=target.id));
end;
$$;


--
-- Name: internal_authorize_payment_deadletter_actor("text", "text", "text", "text", "text", "text", "jsonb", boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_authorize_payment_deadletter_actor"("p_actor_membership_id" "text", "p_actor_user_id" "text", "p_tenant_id" "text", "p_enterprise_id" "text", "p_mall_id" "text", "p_permission_code" "text", "p_granted_via" "jsonb", "p_require_step_up" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_actor_member_id text;
begin
  if p_permission_code not in ('payment.outbox.read', 'payment.outbox.manage')
     or p_require_step_up is distinct from (p_permission_code = 'payment.outbox.manage')
     or length(trim(coalesce(p_actor_membership_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_actor_user_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_tenant_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_enterprise_id, ''))) not between 1 and 300
     or length(trim(coalesce(p_mall_id, ''))) not between 1 and 300
  then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_lock_membership_actor(
    p_actor_membership_id, p_actor_user_id, 'admin', p_tenant_id,
    p_enterprise_id, p_mall_id
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_membership_has_permission(
    p_actor_membership_id, p_permission_code
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  if not public.api_authorization_evidence_matches(
    p_granted_via, p_actor_membership_id, p_permission_code, p_require_step_up
  ) then raise exception 'PAYMENT_OUTBOX_NOT_AUTHORIZED'; end if;
  select membership.member_id into strict v_actor_member_id
  from public.memberships membership
  where membership.id = p_actor_membership_id
    and membership.context_user_id = p_actor_user_id;
  return v_actor_member_id;
end;
$$;


--
-- Name: internal_payment_intent_valid("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_payment_intent_valid"("p_intent_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce((select intent.status='succeeded'
    and intent.source='internal' and intent.currency='CNY'
    and orders.status in(
      'paid','processing','shipped','completed','refund_pending','refunded')
    and orders.paid_cents=orders.payable_cents
    and intent.amount_cents=orders.payable_cents
    and(select count(*) from public.payments payment
      where payment.payment_intent_id=intent.id)
      =(select count(distinct payment.channel) from public.payments payment
        where payment.payment_intent_id=intent.id)
    and(select count(*) from public.payments payment
      where payment.payment_intent_id=intent.id) between 1 and 2
    and(select sum(payment.amount_cents) from public.payments payment
      where payment.payment_intent_id=intent.id)=intent.amount_cents
    and not exists(select 1 from public.payments payment
      where payment.payment_intent_id=intent.id
        and not public.internal_payment_tender_valid(orders.id,payment.id))
    from public.payment_intents intent join public.orders orders
      on orders.id=intent.order_id and orders.tenant_id=intent.tenant_id
      and orders.mall_id=intent.mall_id and orders.user_id=intent.user_id
    where intent.id=p_intent_id),false)
$$;


--
-- Name: internal_payment_tender_valid("text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_payment_tender_valid"("p_order_id" "text", "p_payment_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce((select
    payment.channel in('welfare','meal')
    and ((payment.status='succeeded' and coalesce((select
        sum(refund.amount_cents) from public.refunds refund
        where refund.payment_id=payment.id and refund.status='succeeded'),0)
          <payment.amount_cents)
      or (payment.status='refunded' and coalesce((select
        sum(refund.amount_cents) from public.refunds refund
        where refund.payment_id=payment.id and refund.status='succeeded'),0)
          =payment.amount_cents))
    and payment.provider_trade_no is null
    and payment.tenant_id=orders.tenant_id and payment.mall_id=orders.mall_id
    and payment.user_id=orders.user_id
    and not exists(select 1 from public.refunds refund
      where refund.payment_id=payment.id
        and (refund.tenant_id<>orders.tenant_id
          or refund.mall_id<>orders.mall_id or refund.order_id<>orders.id))
    and (select count(*) from public.payment_allocations allocation
      join public.welfare_accounts account on account.id=allocation.account_id
      where allocation.payment_id=payment.id and allocation.order_id=orders.id
        and allocation.tenant_id=orders.tenant_id
        and allocation.mall_id=orders.mall_id
        and allocation.channel=payment.channel
        and allocation.amount_cents=payment.amount_cents
        and account.account_type=payment.channel
        and account.tenant_id=orders.tenant_id
        and account.mall_id=orders.mall_id
        and account.user_id=orders.user_id)=1
    and (select count(*) from public.account_ledgers ledger
      join public.payment_allocations allocation
        on allocation.account_id=ledger.account_id
        and allocation.payment_id=payment.id
      where ledger.business_type='order_payment'
        and ledger.business_id=orders.id
        and ledger.idempotency_key=payment.idempotency_key
        and ledger.direction='debit'
        and ledger.amount_cents=payment.amount_cents)=1
    from public.payments payment join public.orders orders
      on orders.id=payment.order_id
    where orders.id=p_order_id and payment.id=p_payment_id),false)
$$;


--
-- Name: internal_qualification_manage_permission("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_qualification_manage_permission"("p_kind" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when p_kind in ('catalog_pool','supplier_agreement','brand','store') then 'commercial_resource.manage'
    when p_kind in ('city_zone','entitlement_policy') then 'entitlement.manage'
    when p_kind='purchase_limit' then 'purchase_limit.manage'
  end;
$$;


--
-- Name: internal_qualification_read_permissions("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."internal_qualification_read_permissions"("p_kind" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when p_kind in ('catalog_pool','supplier_agreement','brand','store')
      then array['commercial_resource.read','commercial_resource.manage']::text[]
    when p_kind in ('city_zone','entitlement_policy')
      then array['entitlement.read','entitlement.manage']::text[]
    when p_kind='purchase_limit'
      then array['purchase_limit.read','purchase_limit.manage']::text[]
    else '{}'::text[]
  end;
$$;


--
-- Name: is_valid_catalog_taxonomy_path("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."is_valid_catalog_taxonomy_path"("p_l1" "text", "p_l2" "text", "p_l3" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.catalog_taxonomy_nodes l1
    join public.catalog_taxonomy_nodes l2 on l2.parent_code = l1.code and l2.level = 2
    join public.catalog_taxonomy_nodes l3 on l3.parent_code = l2.code and l3.level = 3
    where l1.level = 1 and l1.status = 'active' and l2.status = 'active' and l3.status = 'active'
      and l1.code = p_l1 and l2.code = p_l2 and l3.code = p_l3
  );
$$;


--
-- Name: payment_capture_effect_superseded("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."payment_capture_effect_superseded"("p_effect_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce((select effect.effect_type in('fulfillment','notification')
    and event.topic='order.payment_succeeded' and orders.status='refunded'
    and orders.paid_cents=orders.payable_cents
    and event.tenant_id=orders.tenant_id and event.order_id=orders.id
    and event.payment_id is not distinct from effect.payment_id
    and event.payment_intent_id is not distinct from effect.payment_intent_id
    and ((event.source='wechat' and exists(select 1
      from public.payments payment join public.wechat_payment_attempts attempt
        on attempt.id=event.attempt_id and attempt.payment_id=payment.id
      where payment.id=effect.payment_id and payment.order_id=orders.id
        and payment.tenant_id=orders.tenant_id and payment.mall_id=orders.mall_id
        and payment.user_id=orders.user_id and payment.channel='wechat'
        and payment.status='refunded' and attempt.status='succeeded'
        and attempt.transaction_id is not distinct from payment.provider_trade_no
        and(select coalesce(sum(refund.amount_cents),0) from public.refunds refund
          where refund.payment_id=payment.id and refund.status='succeeded')=payment.amount_cents
        and not exists(select 1 from public.refunds refund
          where refund.payment_id=payment.id and(refund.tenant_id<>orders.tenant_id
            or refund.mall_id<>orders.mall_id or refund.order_id<>orders.id))
        and exists(select 1 from public.finance_journals journal
          where journal.payment_id=payment.id and journal.payment_intent_id is null
            and journal.order_id=orders.id and journal.journal_type='payment_capture'
            and journal.status='posted' and journal.amount_cents=payment.amount_cents)))
      or(event.source='internal' and effect.payment_id is null
        and public.internal_payment_intent_valid(effect.payment_intent_id)
        and(select coalesce(sum(refund.amount_cents),0) from public.refunds refund
          join public.payments payment on payment.id=refund.payment_id
          where payment.payment_intent_id=effect.payment_intent_id
            and refund.status='succeeded')=orders.paid_cents
        and exists(select 1 from public.finance_journals journal
          where journal.payment_intent_id=effect.payment_intent_id
            and journal.payment_id is null and journal.order_id=orders.id
            and journal.journal_type='payment_capture' and journal.status='posted'
            and journal.amount_cents=orders.paid_cents)))
  from public.payment_event_effects effect join public.payment_outbox event
    on event.id=effect.outbox_id join public.orders orders on orders.id=effect.order_id
  where effect.id=p_effect_id),false)
$$;


--
-- Name: persist_payment_deadletter_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."persist_payment_deadletter_alert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare resource_kind text; resource text; order_ref text; code text; details jsonb;
  dead boolean;
begin
  if tg_table_name='payment_event_effects' then
    dead:=new.status='dead_letter' and old.status is distinct from 'dead_letter';
    resource_kind:='payment_effect';resource:=new.id::text;order_ref:=new.order_id;
    code:=coalesce(new.last_error_code,'PAYMENT_EFFECT_FAILED');
    details:=jsonb_build_object('effectType',new.effect_type,
      'attempts',new.attempts);
  else
    dead:=new.query_dead_lettered_at is not null
      and old.query_dead_lettered_at is null;
    resource_kind:='payment_query';resource:=new.id::text;order_ref:=new.order_id;
    code:=coalesce(new.query_last_error_code,'PAYMENT_QUERY_FAILED');
    details:=jsonb_build_object('operation',new.query_operation,
      'attempts',new.query_attempts);
  end if;
  if not dead then return new; end if;
  insert into public.payment_operations_alerts(
    tenant_id,enterprise_id,mall_id,order_id,resource_type,resource_id,
    severity,status,error_code,details_json)
  select orders.tenant_id,orders.enterprise_id,orders.mall_id,orders.id,
    resource_kind,resource,'critical','open',code,details
  from public.orders orders where orders.id=order_ref
  on conflict(resource_type,resource_id) do update set
    status='open',error_code=excluded.error_code,
    details_json=excluded.details_json,
    occurrence_count=payment_operations_alerts.occurrence_count+1,
    opened_at=now(),resolved_at=null,resolution_request_id=null,
    updated_at=now();
  return new;
end $$;


--
-- Name: post_refund_finance_journal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."post_refund_finance_journal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  perform public.ensure_refund_finance_journal(new.id);
  return new;
end $$;


--
-- Name: prepare_payment_outbox_envelope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prepare_payment_outbox_envelope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare resolved_tenant_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended('payment-order:'||new.order_id,0));
  select orders.tenant_id into strict resolved_tenant_id
  from public.orders orders where orders.id=new.order_id;
  new.tenant_id:=resolved_tenant_id;
  new.aggregate_type:='order'; new.aggregate_id:=new.order_id;
  select coalesce(max(outbox.aggregate_version),0)+1
  into new.aggregate_version from public.payment_outbox outbox
  where outbox.aggregate_id=new.order_id;
  new.event_type:=new.topic; new.event_version:=1;
  new.headers_json:=coalesce(new.headers_json,'{}'::jsonb)
    ||jsonb_build_object('correlationId',new.event_key,
      'occurredAt',new.created_at,'schemaVersion',1,'source',new.source);
  return new;
end $$;


--
-- Name: prevent_owner_membership_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_owner_membership_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if exists (
    select 1 from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.is_owner and mr.revoked_at is null
  ) and (new.status is distinct from old.status or new.expires_at is distinct from old.expires_at) then
    raise exception 'OWNER_MEMBERSHIP_PROTECTED';
  end if;
  return new;
end;
$$;


--
-- Name: prevent_owner_role_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_owner_role_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare target_role public.roles%rowtype;
begin
  select * into target_role from public.roles where id = coalesce(new.role_id, old.role_id);
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  return coalesce(new, old);
end;
$$;


--
-- Name: process_payment_accounting_effect("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."process_payment_accounting_effect"("p_effect_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;payment public.payments%rowtype;
  intent public.payment_intents%rowtype;orders public.orders%rowtype;attempt public.wechat_payment_attempts%rowtype;journal_id uuid;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='accounting';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if event.tenant_id<>effect.tenant_id or event.order_id<>orders.id or orders.tenant_id<>effect.tenant_id then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  if event.source='wechat' then
    select * into strict payment from public.payments where id=effect.payment_id;select * into strict attempt from public.wechat_payment_attempts where id=event.attempt_id;
    if event.payment_id<>payment.id or effect.payment_intent_id is not null or payment.tenant_id<>orders.tenant_id or payment.order_id<>orders.id
      or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id or payment.status not in('succeeded','refunded') or payment.channel<>'wechat'
      or attempt.payment_id<>payment.id or attempt.order_id<>orders.id or attempt.status<>'succeeded' or attempt.transaction_id is distinct from payment.provider_trade_no
      or attempt.amount_total<>payment.amount_cents or event.topic not in('order.payment_succeeded','order.payment_reconciliation_required')
      or not exists(select 1 from public.wechat_payment_observations observation where observation.attempt_id=attempt.id and observation.trade_state='SUCCESS'
        and observation.amount_total=payment.amount_cents and observation.outcome in('applied','reconciliation_required')
        and event.event_key=observation.provider_event_key||':'||event.topic)
      or(event.topic='order.payment_succeeded' and(orders.status not in('paid','processing','shipped','completed','refund_pending','refunded')
        or orders.paid_cents<>orders.payable_cents))
      or(event.topic='order.payment_reconciliation_required' and orders.status not in('refund_pending','refunded'))
    then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  else
    select * into strict intent from public.payment_intents where id=effect.payment_intent_id;
    if event.payment_intent_id<>intent.id or effect.payment_id is not null or event.topic<>'order.payment_succeeded'
      or intent.order_id<>orders.id or not public.internal_payment_intent_valid(intent.id)
    then raise exception 'PAYMENT_ACCOUNTING_EVIDENCE_MISMATCH';end if;
  end if;
  select id into journal_id from public.finance_journals where source_effect_id=effect.id;if found then return 'journal_posted';end if;
  insert into public.finance_journals(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,journal_type,business_reference,currency,amount_cents,status,occurred_at)
  values(effect.tenant_id,orders.mall_id,orders.id,effect.payment_id,effect.payment_intent_id,effect.id,'payment_capture',
    case when event.source='wechat' then 'payment:'||payment.id else 'payment-intent:'||intent.id end,'CNY',
    case when event.source='wechat' then payment.amount_cents else intent.amount_cents end,'posted',event.created_at) returning id into journal_id;
  if event.source='wechat' then
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    values(journal_id,effect.tenant_id,orders.mall_id,orders.id,payment.id,null,'asset:wechat_receivable','debit',payment.amount_cents,'order',orders.id),
      (journal_id,effect.tenant_id,orders.mall_id,orders.id,payment.id,null,'liability:customer_payment_clearing','credit',payment.amount_cents,'order',orders.id);
  else
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    select journal_id,intent.tenant_id,intent.mall_id,intent.order_id,tender.id,null,'liability:'||tender.channel||'_balance','debit',tender.amount_cents,'order',intent.order_id
    from public.payments tender where tender.payment_intent_id=intent.id;
    insert into public.finance_journal_entries(journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,account_code,side,amount_cents,subject_type,subject_id)
    values(journal_id,intent.tenant_id,intent.mall_id,intent.order_id,null,intent.id,'liability:customer_payment_clearing','credit',intent.amount_cents,'order',intent.order_id);
  end if;return 'journal_posted';
end $$;


--
-- Name: process_payment_fulfillment_effect("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."process_payment_fulfillment_effect"("p_effect_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'inventory', 'pg_temp'
    AS $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;orders public.orders%rowtype;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='fulfillment';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if public.payment_capture_effect_superseded(effect.id) then return 'fulfillment_superseded_refunded';end if;
  if event.topic<>'order.payment_succeeded' or event.tenant_id<>orders.tenant_id or event.order_id<>orders.id
    or event.payment_id is distinct from effect.payment_id or event.payment_intent_id is distinct from effect.payment_intent_id
    or orders.status not in('paid','processing','shipped','completed') or orders.paid_cents<>orders.payable_cents
    or(event.source='wechat' and not exists(select 1 from public.payments p where p.id=effect.payment_id and p.order_id=orders.id
      and p.tenant_id=orders.tenant_id and p.mall_id=orders.mall_id and p.user_id=orders.user_id and p.status='succeeded' and p.channel='wechat'))
    or(event.source='internal' and not public.internal_payment_intent_valid(effect.payment_intent_id))
    or not exists(select 1 from inventory.reservations r where r.tenant_id=orders.tenant_id and r.mall_id=orders.mall_id and r.order_id=orders.id)
    or exists(select 1 from inventory.reservations r where r.tenant_id=orders.tenant_id and r.mall_id=orders.mall_id and r.order_id=orders.id and r.state<>'committed')
  then raise exception 'PAYMENT_FULFILLMENT_EVIDENCE_MISMATCH';end if;
  insert into public.fulfillment_orders(tenant_id,mall_id,order_id,sub_order_id,supplier_id,payment_id,payment_intent_id,source_effect_id,amount_cents,idempotency_key)
  select orders.tenant_id,orders.mall_id,orders.id,sub.id,sub.supplier_id,effect.payment_id,effect.payment_intent_id,effect.id,sub.amount_cents,
    coalesce('payment:'||effect.payment_id,'payment-intent:'||effect.payment_intent_id)||':suborder:'||sub.id
  from public.sub_orders sub where sub.parent_order_id=orders.id and sub.tenant_id=orders.tenant_id and sub.mall_id=orders.mall_id and sub.status='paid'
  on conflict(source_effect_id,sub_order_id) do nothing;
  if not exists(select 1 from public.fulfillment_orders where source_effect_id=effect.id) then raise exception 'PAYMENT_FULFILLMENT_SUBORDER_MISSING';end if;
  insert into public.fulfillment_order_items(fulfillment_order_id,order_item_id,sku_id,quantity)
  select f.id,item.id,item.sku_id,item.quantity from public.fulfillment_orders f join public.order_items item
    on item.sub_order_id=f.sub_order_id and item.order_id=orders.id where f.source_effect_id=effect.id
  on conflict(fulfillment_order_id,order_item_id) do nothing;
  if exists(select 1 from public.fulfillment_orders f where f.source_effect_id=effect.id and not exists(
    select 1 from public.fulfillment_order_items item where item.fulfillment_order_id=f.id))
  then raise exception 'PAYMENT_FULFILLMENT_ITEMS_MISSING';end if;return 'fulfillment_queued';
end $$;


--
-- Name: process_payment_notification_effect("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."process_payment_notification_effect"("p_effect_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare effect public.payment_event_effects%rowtype;event public.payment_outbox%rowtype;payment public.payments%rowtype;
  intent public.payment_intents%rowtype;orders public.orders%rowtype;template text;amount bigint;
begin
  select * into strict effect from public.payment_event_effects where id=p_effect_id and effect_type='notification';
  select * into strict event from public.payment_outbox where id=effect.outbox_id;select * into strict orders from public.orders where id=effect.order_id;
  if event.tenant_id<>orders.tenant_id or event.order_id<>orders.id or event.payment_id is distinct from effect.payment_id
    or event.payment_intent_id is distinct from effect.payment_intent_id then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
  if public.payment_capture_effect_superseded(effect.id) then return 'notification_superseded_refunded';end if;
  if event.source='internal' then select * into strict intent from public.payment_intents where id=effect.payment_intent_id;
    if event.topic<>'order.payment_succeeded' or not public.internal_payment_intent_valid(intent.id) then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
    template:='payment.succeeded';amount:=intent.amount_cents;
  else select * into strict payment from public.payments where id=effect.payment_id;
    if payment.order_id<>orders.id or payment.tenant_id<>orders.tenant_id or payment.mall_id<>orders.mall_id or payment.user_id<>orders.user_id
      or(event.topic='order.payment_succeeded' and payment.status not in('succeeded','refunded'))
      or(event.topic='order.payment_terminal' and payment.status not in('failed','closed'))
      or(event.topic='order.payment_reconciliation_required' and(payment.status not in('succeeded','refunded') or orders.status not in('refund_pending','refunded')))
    then raise exception 'PAYMENT_NOTIFICATION_EVIDENCE_MISMATCH';end if;
    template:=case event.topic when 'order.payment_succeeded' then 'payment.succeeded' when 'order.payment_terminal'
      then case when payment.status='closed' then 'payment.closed' else 'payment.failed' end else 'payment.reconciliation' end;amount:=payment.amount_cents;
  end if;
  insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,recipient_kind,recipient_id,channel,template_key,payload_json)
  values(orders.tenant_id,orders.mall_id,orders.id,effect.payment_id,effect.payment_intent_id,effect.id,'user',orders.user_id,'inapp',template,
    jsonb_strip_nulls(jsonb_build_object('orderId',orders.id,'paymentId',effect.payment_id,'paymentIntentId',effect.payment_intent_id,
      'amountCents',amount,'paymentStatus',case when event.source='internal' then intent.status else payment.status end)))
  on conflict(source_effect_id,recipient_kind,channel) do nothing;
  if event.topic='order.payment_reconciliation_required' then
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(orders.tenant_id,orders.mall_id,orders.id,effect.payment_id,null,effect.id,'operations',orders.mall_id,'inapp','payment.reconciliation.operations',
      jsonb_build_object('orderId',orders.id,'paymentId',effect.payment_id,'reasonCode',event.payload_json->>'reasonCode'))
    on conflict(source_effect_id,recipient_kind,channel) do nothing;end if;return 'notification_persisted';
end $$;


--
-- Name: process_wechat_refund_event("uuid", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."process_wechat_refund_event"("p_event_id" "uuid", "p_worker_id" "text", "p_lease_token" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare event public.wechat_refund_event_outbox%rowtype; command public.wechat_refund_commands%rowtype;
  command_snapshot public.wechat_refund_commands%rowtype;
  refund public.refunds%rowtype; after_sale public.after_sales%rowtype; order_row public.orders%rowtype;
  payment public.payments%rowtype; event_payload_digest text; total_payment_refunds bigint;
  total_order_refunds bigint;
begin
  select command_row.* into command_snapshot
  from public.wechat_refund_event_outbox event_row
  join public.wechat_refund_commands command_row on command_row.id=event_row.command_id
  where event_row.id=p_event_id and event_row.status='processing'
    and event_row.locked_by=trim(p_worker_id)
    and event_row.lease_token=p_lease_token and event_row.lease_expires_at>now();
  if not found then return 'lease_lost'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('payment-order:'||command_snapshot.order_id,0)
  );
  select * into strict order_row from public.orders
  where id=command_snapshot.order_id for update;
  select * into strict payment from public.payments
  where id=command_snapshot.payment_id and order_id=order_row.id for update;
  perform 1 from public.wechat_payment_attempts payment_attempt
  where payment_attempt.id=command_snapshot.payment_attempt_id
    and payment_attempt.order_id=order_row.id for update;
  select * into strict after_sale from public.after_sales
  where id=command_snapshot.after_sale_id and order_id=order_row.id for update;
  select * into strict refund from public.refunds
  where id=command_snapshot.refund_id and order_id=order_row.id for update;
  select * into strict command from public.wechat_refund_commands
  where id=command_snapshot.id for update;
  if command.order_id<>command_snapshot.order_id
     or command.payment_id<>command_snapshot.payment_id
     or command.payment_attempt_id<>command_snapshot.payment_attempt_id
     or command.after_sale_id<>command_snapshot.after_sale_id
     or command.refund_id<>command_snapshot.refund_id
  then raise exception 'WECHAT_REFUND_EVENT_EVIDENCE_MISMATCH'; end if;
  select * into event from public.wechat_refund_event_outbox
  where id=p_event_id and status='processing' and locked_by=trim(p_worker_id)
    and lease_token=p_lease_token and lease_expires_at>now() for update;
  if not found then return 'lease_lost'; end if;
  if event.tenant_id<>command.tenant_id or event.aggregate_id<>command.refund_id
     or event.payload_json->>'commandId'<>command.id::text
     or event.payload_json->>'refundId'<>command.refund_id
     or event.payload_json->>'afterSaleId'<>command.after_sale_id
     or event.payload_json->>'orderId'<>command.order_id
     or event.payload_json->>'paymentId'<>command.payment_id
     or event.payload_json->>'outRefundNo'<>command.out_refund_no
     or (event.payload_json->>'amountCents')::bigint<>command.amount_cents
     or event.payload_json->>'currency'<>'CNY'
     or refund.payment_id<>payment.id or refund.order_id<>order_row.id
     or after_sale.order_id<>order_row.id or command.tenant_id<>order_row.tenant_id
     or command.mall_id<>order_row.mall_id or payment.channel<>'wechat'
     or not exists(select 1 from public.finance_journals journal
       where journal.payment_id=payment.id and journal.payment_intent_id is null
         and journal.journal_type='payment_capture' and journal.status='posted'
         and journal.order_id=order_row.id and journal.amount_cents=payment.amount_cents)
  then raise exception 'WECHAT_REFUND_EVENT_EVIDENCE_MISMATCH'; end if;
  event_payload_digest:=encode(digest(jsonb_build_object(
    'eventId',event.id,'eventKey',event.event_key,'tenantId',event.tenant_id,
    'aggregateType',event.aggregate_type,'aggregateId',event.aggregate_id,
    'aggregateVersion',event.aggregate_version,'eventType',event.event_type,
    'eventVersion',event.event_version,'occurredAt',event.created_at,
    'payload',event.payload_json
  )::text,'sha256'),'hex');
  insert into public.wechat_refund_event_inbox(outbox_id,event_key,payload_digest,consumer)
  values(event.id,event.event_key,event_payload_digest,trim(p_worker_id)) on conflict do nothing;
  if not exists(select 1 from public.wechat_refund_event_inbox inbox
    where inbox.outbox_id=event.id and inbox.event_key=event.event_key
      and inbox.payload_digest=event_payload_digest)
  then raise exception 'WECHAT_REFUND_EVENT_INBOX_MISMATCH'; end if;

  if event.event_type='RefundSucceeded' then
    if command.status not in ('provider_succeeded','succeeded')
       or command.provider_status<>'SUCCESS' or command.provider_refund_id is null
       or refund.status not in ('processing','succeeded')
       or after_sale.status not in ('approved','completed')
    then raise exception 'WECHAT_REFUND_SUCCESS_STATE_MISMATCH'; end if;
    select coalesce(sum(other.amount_cents),0) into total_payment_refunds
    from public.refunds other where other.payment_id=payment.id and other.status='succeeded'
      and other.id<>refund.id;
    if total_payment_refunds+refund.amount_cents>payment.amount_cents
    then raise exception 'WECHAT_REFUND_PAYMENT_AMOUNT_EXCEEDED'; end if;
    select coalesce(sum(other.amount_cents),0) into total_order_refunds
    from public.refunds other where other.order_id=order_row.id and other.status='succeeded'
      and other.id<>refund.id;
    if total_order_refunds+refund.amount_cents>order_row.paid_cents
    then raise exception 'WECHAT_REFUND_ORDER_AMOUNT_EXCEEDED'; end if;
    update public.refunds set status='succeeded',completed_at=coalesce(completed_at,now())
    where id=refund.id and status='processing';
    update public.payments set status=case
      when total_payment_refunds+refund.amount_cents=amount_cents then 'refunded'
      else status end where id=payment.id;
    update public.after_sales set status='completed',resolved_at=coalesce(resolved_at,now()),
      updated_at=now() where id=after_sale.id;
    update public.orders set status=case
      when total_order_refunds+refund.amount_cents=paid_cents then 'refunded'
      else coalesce(after_sale.order_status_before_request,'paid') end,updated_at=now()
    where id=order_row.id;
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
      payment_intent_id,refund_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(command.tenant_id,command.mall_id,command.order_id,command.payment_id,
      null,refund.id,'user',order_row.user_id,'inapp','refund.succeeded',jsonb_build_object(
        'orderId',command.order_id,'refundId',refund.id,'amountCents',refund.amount_cents,
        'refundStatus','succeeded'))
    on conflict(refund_id,recipient_kind,channel,template_key)
      where refund_id is not null do nothing;
    update public.wechat_refund_commands set status='succeeded',completed_at=coalesce(completed_at,now()),
      updated_at=now() where id=command.id;
  else
    if command.status not in ('provider_closed','closed') or command.provider_status<>'CLOSED'
       or refund.status not in ('processing','failed')
    then raise exception 'WECHAT_REFUND_CLOSED_STATE_MISMATCH'; end if;
    update public.refunds set status='failed',completed_at=coalesce(completed_at,now())
    where id=refund.id and status='processing';
    update public.after_sales set status='closed',resolved_at=coalesce(resolved_at,now()),
      updated_at=now() where id=after_sale.id;
    update public.orders set status=coalesce(after_sale.order_status_before_request,'paid'),
      updated_at=now() where id=order_row.id and status='refund_pending';
    insert into public.notification_dispatches(tenant_id,mall_id,order_id,payment_id,
      payment_intent_id,refund_id,recipient_kind,recipient_id,channel,template_key,payload_json)
    values(command.tenant_id,command.mall_id,command.order_id,command.payment_id,
      null,refund.id,'operations',command.mall_id,'inapp','refund.closed',jsonb_build_object(
        'orderId',command.order_id,'refundId',refund.id,'amountCents',refund.amount_cents,
        'refundStatus','closed'))
    on conflict(refund_id,recipient_kind,channel,template_key)
      where refund_id is not null do nothing;
    update public.wechat_refund_commands set status='closed',completed_at=coalesce(completed_at,now()),
      updated_at=now() where id=command.id;
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,action,
    resource_type,resource_id,request_id,after_json,created_at)
  values(gen_random_uuid()::text,command.tenant_id,order_row.enterprise_id,command.mall_id,
    'system','refund.wechat.'||case when event.event_type='RefundSucceeded' then 'succeeded' else 'closed' end,
    'refund',refund.id,'wechat-refund-event:'||event.id,jsonb_build_object(
      'eventType',event.event_type,'providerStatus',command.provider_status,
      'amountCents',command.amount_cents),now());
  return case when event.event_type='RefundSucceeded' then 'refund_succeeded' else 'refund_closed' end;
end $$;


--
-- Name: queue_wechat_refund_event("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."queue_wechat_refund_event"("p_command_id" "uuid", "p_event_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare command public.wechat_refund_commands%rowtype;
begin
  select * into strict command from public.wechat_refund_commands where id=p_command_id;
  if (p_event_type='RefundSucceeded' and command.status<>'provider_succeeded')
     or (p_event_type='RefundClosed' and command.status<>'provider_closed')
     or p_event_type not in ('RefundSucceeded','RefundClosed')
  then raise exception 'WECHAT_REFUND_EVENT_STATE_INVALID'; end if;
  insert into public.wechat_refund_event_outbox(
    event_key,command_id,tenant_id,aggregate_id,event_type,payload_json
  ) values(
    'wechat-refund:'||command.id||':'||p_event_type,command.id,command.tenant_id,
    command.refund_id,p_event_type,jsonb_build_object(
      'commandId',command.id,'refundId',command.refund_id,'afterSaleId',command.after_sale_id,
      'orderId',command.order_id,'paymentId',command.payment_id,'outRefundNo',command.out_refund_no,
      'providerRefundId',command.provider_refund_id,'amountCents',command.amount_cents,
      'currency',command.currency,'providerStatus',command.provider_status
    )
  ) on conflict(command_id,event_type) do nothing;
end $$;


--
-- Name: rebuild_org_unit_closure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rebuild_org_unit_closure"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  perform pg_advisory_xact_lock(hashtext('public.org_unit_hierarchy'));
  delete from public.org_unit_closure;
  insert into public.org_unit_closure (ancestor_id, descendant_id, depth)
  with recursive ancestry as (
    select unit.id ancestor_id, unit.id descendant_id, 0 depth
    from public.org_units unit
    union all
    select ancestry.ancestor_id, child.id, ancestry.depth + 1
    from ancestry
    join public.org_units child on child.parent_id = ancestry.descendant_id
  )
  select ancestor_id, descendant_id, min(depth)
  from ancestry
  group by ancestor_id, descendant_id;
  return null;
end;
$$;


--
-- Name: reject_immutable_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_immutable_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception '%_IS_IMMUTABLE', tg_table_name;
end;
$$;


--
-- Name: reject_test_product_order_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."reject_test_product_order_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if exists (
    select 1
    from public.products p
    where p.id = new.product_id and p.is_test
  ) then
    raise exception 'TEST_PRODUCT_NOT_ORDERABLE';
  end if;
  return new;
end;
$$;


--
-- Name: repair_canonical_distributor_scopes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."repair_canonical_distributor_scopes"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  audited_count integer:=0;
  duplicate_count integer:=0;
  converted_count integer:=0;
  conflict_count integer:=0;
  suspended_count integer:=0;
  removed_scope_count integer:=0;
begin
  with binding as (
    select scope.membership_id,scope.resource_id,
      coalesce(canonical.id,legacy.id) canonical_id,
      membership.tenant_id,membership.enterprise_id,membership.mall_id,
      exists(
        select 1 from public.distributors distributor
        join public.distributor_tenants relation on relation.distributor_id=distributor.id
        where distributor.id=coalesce(canonical.id,legacy.id)
          and distributor.status='active' and relation.tenant_id=membership.tenant_id
          and relation.status='active' and relation.starts_at<=now()
          and (relation.ends_at is null or relation.ends_at>now())
      ) binding_valid
    from public.membership_scopes scope
    join public.memberships membership on membership.id=scope.membership_id
    left join public.distributors canonical on canonical.id=scope.resource_id
    left join public.distributors legacy
      on legacy.org_unit_id=scope.resource_id and canonical.id is null
    where scope.scope_kind='distributor'
  )
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,
    request_id,before_json,after_json,membership_id,granted_via,created_at
  )
  select gen_random_uuid()::text,binding.tenant_id,binding.enterprise_id,binding.mall_id,
    'system','membership.distributor_scope.canonicalized','membership',binding.membership_id,
    'migration-20260820121000',
    jsonb_build_object('kind','distributor','resourceId',binding.resource_id),
    case when binding.canonical_id is not null and binding.binding_valid then
      jsonb_build_object('kind','distributor','resourceId',binding.canonical_id,'outcome','converted')
    else jsonb_build_object('kind','distributor','resourceId',binding.resource_id,
      'outcome','retained_fail_closed') end,
    binding.membership_id,jsonb_build_object('source','repair_migration'),now()
  from binding
  where (
    binding.canonical_id is null or binding.resource_id<>binding.canonical_id
    or not binding.binding_valid
  ) and (
    binding.binding_valid or not exists(
      select 1 from public.audit_logs existing_audit
      where existing_audit.action='membership.distributor_scope.canonicalized'
        and existing_audit.request_id='migration-20260820121000'
        and existing_audit.membership_id=binding.membership_id
        and existing_audit.before_json->>'resourceId'=binding.resource_id
        and existing_audit.after_json->>'outcome'='retained_fail_closed'
    )
  );
  get diagnostics audited_count=row_count;

  delete from public.membership_scopes legacy
  using public.distributors distributor
  where legacy.scope_kind='distributor' and legacy.resource_id=distributor.org_unit_id
    and exists(
      select 1 from public.membership_scopes canonical
      where canonical.membership_id=legacy.membership_id
        and canonical.scope_kind='distributor' and canonical.resource_id=distributor.id
    );
  get diagnostics duplicate_count=row_count;

  update public.membership_scopes scope
  set resource_id=distributor.id
  from public.distributors distributor,public.memberships membership
  where scope.scope_kind='distributor' and scope.resource_id=distributor.org_unit_id
    and membership.id=scope.membership_id and distributor.status='active'
    and exists(
      select 1 from public.distributor_tenants relation
      where relation.distributor_id=distributor.id
        and relation.tenant_id=membership.tenant_id and relation.status='active'
        and relation.starts_at<=now()
        and (relation.ends_at is null or relation.ends_at>now())
    );
  get diagnostics converted_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_type,action,resource_type,resource_id,
    request_id,before_json,after_json,membership_id,granted_via,created_at
  )
  select gen_random_uuid()::text,membership.tenant_id,membership.enterprise_id,membership.mall_id,
    'system','membership.distributor_scope.ambiguous_quarantined','membership',membership.id,
    'migration-20260820121000',jsonb_build_object('bindings',(
      select jsonb_agg(scope.resource_id order by scope.resource_id)
      from public.membership_scopes scope
      where scope.membership_id=membership.id and scope.scope_kind='distributor'
    )),jsonb_build_object('outcome',case when exists(
      select 1 from public.membership_scopes platform_scope
      join public.org_units platform on platform.id=platform_scope.resource_id
      join public.membership_roles membership_role
        on membership_role.membership_id=membership.id
      join public.roles role on role.id=membership_role.role_id
      where platform_scope.membership_id=membership.id
        and platform_scope.scope_kind='platform' and platform.kind='platform'
        and platform.status='active' and role.is_owner and role.status='active'
        and membership_role.revoked_at is null
        and (membership_role.expires_at is null or membership_role.expires_at>now())
    ) then 'platform_anchor_retained' else 'membership_suspended_scopes_removed' end),
    membership.id,jsonb_build_object('source','repair_migration'),now()
  from conflict join public.memberships membership on membership.id=conflict.membership_id;
  get diagnostics conflict_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  update public.memberships membership set status='suspended'
  from conflict
  where membership.id=conflict.membership_id
    and membership.status not in ('suspended','offboarded','expired')
    and not exists(
      select 1 from public.membership_scopes platform_scope
      join public.org_units platform on platform.id=platform_scope.resource_id
      join public.membership_roles membership_role
        on membership_role.membership_id=membership.id
      join public.roles role on role.id=membership_role.role_id
      where platform_scope.membership_id=membership.id
        and platform_scope.scope_kind='platform' and platform.kind='platform'
        and platform.status='active' and role.is_owner and role.status='active'
        and membership_role.revoked_at is null
        and (membership_role.expires_at is null or membership_role.expires_at>now())
    );
  get diagnostics suspended_count=row_count;

  with conflict as (
    select scope.membership_id
    from public.membership_scopes scope
    where scope.scope_kind='distributor'
    group by scope.membership_id having count(distinct scope.resource_id)>1
  )
  delete from public.membership_scopes scope
  using conflict
  where scope.membership_id=conflict.membership_id
    and (
      scope.scope_kind='distributor'
      or not exists(
        select 1 from public.membership_scopes platform_scope
        join public.org_units platform on platform.id=platform_scope.resource_id
        join public.membership_roles membership_role
          on membership_role.membership_id=scope.membership_id
        join public.roles role on role.id=membership_role.role_id
        where platform_scope.membership_id=scope.membership_id
          and platform_scope.scope_kind='platform' and platform.kind='platform'
          and platform.status='active' and role.is_owner and role.status='active'
          and membership_role.revoked_at is null
          and (membership_role.expires_at is null or membership_role.expires_at>now())
      )
    );
  get diagnostics removed_scope_count=row_count;

  return jsonb_build_object(
    'audited',audited_count,'duplicatesRemoved',duplicate_count,
    'converted',converted_count,'conflicts',conflict_count,
    'membershipsSuspended',suspended_count,'scopesRemoved',removed_scope_count
  );
end;
$$;


--
-- Name: sync_new_member_identity_assurance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."sync_new_member_identity_assurance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.member_identity_assurances (
    member_id, account_authenticated_at, created_at, updated_at
  ) values (new.id, new.created_at, new.created_at, now())
  on conflict (member_id) do nothing;
  return new;
end;
$$;


--
-- Name: sync_phone_identity_assurance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."sync_phone_identity_assurance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare affected_member_id text;
begin
  if tg_op <> 'DELETE' and new.provider = 'local_phone' then
    insert into public.member_identity_assurances (
      member_id, account_authenticated_at, phone_verified_at,
      phone_verification_method, created_at, updated_at
    )
    select new.member_id, member.created_at, now(), 'sms_otp', now(), now()
    from public.members member where member.id = new.member_id
    on conflict (member_id) do update set
      phone_verified_at = excluded.phone_verified_at,
      phone_verification_method = excluded.phone_verification_method,
      updated_at = now();
  end if;

  if tg_op <> 'INSERT' and old.provider = 'local_phone' then
    affected_member_id := old.member_id;
    if tg_op = 'DELETE' or new.provider <> 'local_phone' or new.member_id <> old.member_id then
      update public.member_identity_assurances
      set phone_verified_at = null, phone_verification_method = null, updated_at = now()
      where member_id = affected_member_id
        and not exists (
          select 1 from public.member_login_aliases
          where provider = 'local_phone' and member_id = affected_member_id
        );
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: validate_commercial_resource_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_commercial_resource_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if tg_table_name = 'products' then
    if new.brand_id is not null and not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'supplier_brand_bindings' then
    if not exists (select 1 from public.suppliers where id = new.supplier_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'brand_store_bindings' then
    if not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.stores where id = new.store_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_supplier_agreements' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.suppliers where id = new.supplier_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_brand_authorizations' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'store_org_unit_bindings' then
    if not exists (select 1 from public.stores where id = new.store_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.org_units where id = new.org_unit_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'catalog_pool_items' then
    if not exists (select 1 from public.catalog_pools where id = new.pool_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.skus where id = new.sku_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_catalog_pool_bindings' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.catalog_pools where id = new.pool_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name in ('employee_qualification_profiles','employee_qualification_tags') then
    if not exists (select 1 from public.users where id = new.user_id and tenant_id = new.tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'city_zone_catalog_items' then
    if not exists (select 1 from public.city_zones where id = new.zone_id and tenant_id = new.tenant_id)
      or (new.product_id is not null and not exists (select 1 from public.products where id = new.product_id and tenant_id = new.tenant_id))
      or (new.sku_id is not null and not exists (select 1 from public.skus where id = new.sku_id and tenant_id = new.tenant_id)) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;


--
-- Name: validate_membership_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_membership_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare membership_row public.memberships%rowtype; is_valid boolean:=false;
begin
  select * into membership_row from public.memberships where id=new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if new.scope_kind='platform' then
    select exists(
      select 1 from public.org_units platform
      where platform.id=new.resource_id and platform.kind='platform' and platform.status='active'
        and exists(
          select 1 from public.membership_roles membership_role
          join public.roles role on role.id=membership_role.role_id
          where membership_role.membership_id=membership_row.id
            and membership_role.revoked_at is null
            and (membership_role.expires_at is null or membership_role.expires_at>now())
            and role.is_owner and role.status='active'
        )
    ) into is_valid;
    if not is_valid then raise exception 'PLATFORM_SCOPE_REQUIRES_OWNER'; end if;
  elsif new.scope_kind='distributor' then
    select exists(
      select 1 from public.distributors distributor
      join public.distributor_tenants relation on relation.distributor_id=distributor.id
      where distributor.id=new.resource_id and distributor.status='active'
        and relation.tenant_id=membership_row.tenant_id and relation.status='active'
        and relation.starts_at<=now() and (relation.ends_at is null or relation.ends_at>now())
    ) into is_valid;
  elsif new.scope_kind='tenant' then is_valid:=new.resource_id=membership_row.tenant_id;
  elsif new.scope_kind='enterprise' then select exists(select 1 from public.enterprises e where e.id=new.resource_id and e.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='mall' then select exists(select 1 from public.malls m where m.id=new.resource_id and m.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='supplier' then select exists(select 1 from public.suppliers s where s.id=new.resource_id and s.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='brand' then select exists(select 1 from public.brands b where b.id=new.resource_id and b.tenant_id=membership_row.tenant_id and b.status<>'disabled') into is_valid;
  elsif new.scope_kind='store' then select exists(select 1 from public.stores s where s.id=new.resource_id and s.tenant_id=membership_row.tenant_id and s.status<>'disabled') into is_valid;
  elsif new.scope_kind='department' then select exists(select 1 from public.departments d where d.id=new.resource_id and d.tenant_id=membership_row.tenant_id and d.enterprise_id=membership_row.enterprise_id) into is_valid;
  elsif new.scope_kind='self' then is_valid:=new.resource_id=membership_row.context_user_id;
  end if;
  if not coalesce(is_valid,false) then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  return new;
end;
$$;


--
-- Name: validate_org_unit_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_org_unit_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  parent_row public.org_units%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('public.org_unit_hierarchy'));
  if new.kind = 'platform' then
    if new.parent_id is not null or new.tenant_id is not null then raise exception 'PLATFORM_ORG_UNIT_MUST_BE_GLOBAL_ROOT'; end if;
    return new;
  end if;

  if new.parent_id is null then raise exception 'ORG_UNIT_PARENT_REQUIRED'; end if;
  if new.parent_id = new.id then raise exception 'ORG_UNIT_CYCLE'; end if;
  select * into parent_row from public.org_units where id = new.parent_id;
  if not found then raise exception 'ORG_UNIT_PARENT_NOT_FOUND'; end if;

  if exists (
    select 1 from public.org_unit_closure
    where ancestor_id = new.id and descendant_id = new.parent_id
  ) then raise exception 'ORG_UNIT_CYCLE'; end if;

  if new.kind = 'tenant' and parent_row.kind not in ('platform','distributor') then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'distributor' and parent_row.kind <> 'platform' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'enterprise' and parent_row.kind <> 'tenant' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'mall' and parent_row.kind <> 'enterprise' then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;
  if new.kind = 'department' and parent_row.kind not in ('enterprise','department') then raise exception 'ORG_UNIT_PARENT_KIND_INVALID'; end if;

  if new.kind <> 'distributor' and new.tenant_id is null then raise exception 'ORG_UNIT_TENANT_REQUIRED'; end if;
  if parent_row.tenant_id is not null and parent_row.tenant_id <> new.tenant_id then raise exception 'ORG_UNIT_TENANT_MISMATCH'; end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: validate_qualification_selector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."validate_qualification_selector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_tenant_id text; v_kind text; v_id text;
begin
  if tg_table_name like 'entitlement_policy_%' then
    select tenant_id into v_tenant_id from public.entitlement_policies where id = new.policy_id;
  else
    select tenant_id into v_tenant_id from public.purchase_limit_templates where id = new.template_id;
  end if;
  if v_tenant_id is null then raise exception 'QUALIFICATION_PARENT_NOT_FOUND'; end if;
  if tg_table_name in ('entitlement_policy_subjects','purchase_limit_subjects') then
    v_kind := new.subject_kind; v_id := new.subject_id;
    if v_kind = 'all' then return new; end if;
    if v_kind = 'enterprise' and not exists (select 1 from public.enterprises where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'department' and not exists (select 1 from public.departments where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'user' and not exists (select 1 from public.users where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'membership' and not exists (select 1 from public.memberships where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'tag' and trim(v_id) = '' then raise exception 'QUALIFICATION_SUBJECT_INVALID'; end if;
  else
    v_kind := new.resource_kind; v_id := new.resource_id;
    if v_kind = 'all' then return new; end if;
    if v_kind = 'catalog_pool' and not exists (select 1 from public.catalog_pools where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'product' and not exists (select 1 from public.products where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'sku' and not exists (select 1 from public.skus where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'city_zone' and not exists (select 1 from public.city_zones where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;


--
-- Name: cockpit("text"); Type: FUNCTION; Schema: reporting; Owner: -
--

CREATE FUNCTION "reporting"."cockpit"("p_scope" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'reporting', 'organization', 'catalog', 'inventory', 'ordering'
    AS $$
  with descendants as(
    select descendant_id id from organization.unitclosure where ancestor_id=p_scope
  ), scoped_facts as(
    select fact.metric_id,fact.period_start,fact.period_end,fact.timezone,fact.dimensions,fact.value_numeric,fact.watermark
    from reporting.fact fact where fact.scope_id=p_scope
  ), totals as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders,
      coalesce(sum(value_numeric) filter(where metric_id='refund.amount'),0)::float8 refunds,
      coalesce(sum(value_numeric) filter(where metric_id='refund.orders'),0)::float8 refundorders,
      coalesce(max(watermark),clock_timestamp()) watermark
    from scoped_facts
  ), period as(
    select coalesce(sum(value_numeric) filter(where metric_id='sales.amount'),0)::float8 sales,
      coalesce(sum(value_numeric) filter(where metric_id='sales.orders'),0)::float8 orders
    from scoped_facts where period_start>=date_trunc('day',clock_timestamp())-interval '29 days'
  ), active as(
    select count(distinct listing.sku_id)::integer count from catalog.listing listing join descendants on descendants.id=listing.scope_id
    where listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
      and (listing.expires_at is null or listing.expires_at>clock_timestamp())
  ), sold as(
    select count(distinct dimensions->>'product')::integer count from scoped_facts where metric_id='product.amount'
  ), trend as(
    select jsonb_agg(jsonb_build_object('date',day::date,'salesCents',coalesce(amount,0)::float8,
      'orderCount',coalesce(orders,0)::float8) order by day) value
    from generate_series(date_trunc('day',clock_timestamp())-interval '6 days',date_trunc('day',clock_timestamp()),interval '1 day') day
    left join lateral(
      select sum(value_numeric) filter(where metric_id='sales.amount') amount,
        sum(value_numeric) filter(where metric_id='sales.orders') orders from scoped_facts
      where (period_start at time zone timezone)::date=day::date
    ) metric on true
  ), categories as(
    select coalesce(jsonb_agg(jsonb_build_object('name',category,'salesCents',amount,'share',
      case when total>0 then amount/total else 0 end) order by amount desc,category),'[]'::jsonb) value from(
      select dimensions->>'category' category,sum(value_numeric)::float8 amount,
        sum(sum(value_numeric)) over()::float8 total from scoped_facts
      where metric_id='category.amount' and period_start>=date_trunc('day',clock_timestamp())-interval '29 days'
      group by dimensions->>'category' order by amount desc limit 5
    ) ranked
  )
  select jsonb_build_object(
    'catalogCount',(select count(*)::integer from catalog.listing listing join descendants on descendants.id=listing.scope_id),
    'availableStock',(select coalesce(sum(stock.onhand-stock.safety-coalesce(reserved.quantity,0)),0)::float8
      from inventory.stockitem stock join descendants on descendants.id=stock.scope_id
      left join lateral(select sum(reservation.quantity) quantity from inventory.reservation reservation
        where reservation.stockitem_id=stock.id and reservation.state='active' and reservation.expires_at>clock_timestamp()) reserved on true),
    'orderCount',(select count(*)::integer from ordering.orderrecord orders join descendants on descendants.id=orders.mall_id),
    'afterSaleCount',(select count(*)::integer from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join descendants on descendants.id=orders.mall_id where aftersale.state not in('completed','cancelled','rejected')),
    'sales',jsonb_build_object('asOf',(select watermark from totals),
      'cumulativeSalesCents',greatest((select sales-refunds from totals),0),
      'paidOrderCount',greatest((select orders-refundorders from totals),0),
      'averageOrderValueCents',case when (select orders-refundorders from totals)>0
        then round(greatest((select sales-refunds from totals),0)/(select orders-refundorders from totals)) else 0 end,
      'periodSalesCents',(select sales from period),'periodPaidOrderCount',(select orders from period),
      'refundedCents',(select refunds from totals),'activeProductCount',(select count from active),
      'soldProductCount',(select count from sold),'unsoldActiveProductCount',greatest((select count from active)-(select count from sold),0),
      'trend',(select value from trend),'categories',(select value from categories),'topProducts','[]'::jsonb)
  )
$$;


--
-- Name: enforce_watermark(); Type: FUNCTION; Schema: reporting; Owner: -
--

CREATE FUNCTION "reporting"."enforce_watermark"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'reporting', 'pg_temp'
    AS $$
begin
  if tg_op='UPDATE' and (new.occurred_at<old.occurred_at or new.version<=old.version) then
    raise exception 'REPORTING_WATERMARK_REGRESSION';
  end if;
  return new;
end $$;


--
-- Name: resource_scope("text"); Type: FUNCTION; Schema: reporting; Owner: -
--

CREATE FUNCTION "reporting"."resource_scope"("p_resource" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'reporting', 'pg_temp'
    AS $$
  select scope_id from reporting.export where id=p_resource
$$;


--
-- Name: resource_scope("text"); Type: FUNCTION; Schema: risk; Owner: -
--

CREATE FUNCTION "risk"."resource_scope"("p_resource" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'risk', 'pg_temp'
    AS $$
  select scope_id from (
    select scope_id,1 priority from risk.policy where id=p_resource
    union all select scope_id,2 priority from risk.case where id=p_resource
  ) candidate order by priority limit 1
$$;


--
-- Name: scope_allowed("text"); Type: FUNCTION; Schema: risk; Owner: -
--

CREATE FUNCTION "risk"."scope_allowed"("p_scope" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'risk', 'access', 'pg_temp'
    AS $$
  select access.scope_allowed(p_scope) or (p_scope='identity' and nullif(current_setting('app.scope_id',true),'')='organization-platform-root')
$$;


--
-- Name: accept_inbox("text", "text", "text", "text", integer, "text", "jsonb"); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."accept_inbox"("p_provider" "text", "p_event_id" "text", "p_operation" "text", "p_event_type" "text", "p_event_version" integer, "p_trace_id" "text", "p_payload" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
begin
  if p_provider is null or p_operation is null then raise exception 'INBOX_IDENTITY_REQUIRED'; end if;
  insert into runtime.inbox(provider,event_id,operation,consumer,event_type,event_version,trace_id,payload,received_at)
  values(p_provider,p_event_id,p_operation,p_operation,p_event_type,p_event_version,p_trace_id,p_payload,clock_timestamp())
  on conflict(provider,event_id,operation) do nothing;
  return found;
end $$;


--
-- Name: accept_provider_webhook("text", "text", "text", "jsonb", "text", "text", "text", integer, "jsonb"); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."accept_provider_webhook"("p_provider" "text", "p_external_id" "text", "p_sha256" "text", "p_headers" "jsonb", "p_payload" "text", "p_trace_id" "text", "p_event_type" "text", "p_event_version" integer, "p_event_payload" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
begin
  insert into runtime.rawenvelope(provider,external_id,sha256,headers,payload,trace_id,received_at)
  values(p_provider,p_external_id,p_sha256,p_headers,p_payload,p_trace_id,clock_timestamp()) on conflict(provider,external_id) do nothing;
  if not found then
    if not exists(select 1 from runtime.rawenvelope where provider=p_provider and external_id=p_external_id and sha256=p_sha256) then raise exception 'PROVIDER_EVENT_ID_COLLISION'; end if;
    return 'replayed';
  end if;
  perform runtime.accept_inbox(p_provider,p_provider||':'||p_external_id,'webhook:'||p_event_type,p_event_type,p_event_version,p_trace_id,p_event_payload);
  return 'accepted';
end $$;


--
-- Name: acquire_lease("text", "text", integer); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."acquire_lease"("p_resource" "text", "p_owner" "text", "p_seconds" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
declare lease_token text;
begin
  if p_seconds not between 5 and 900 then raise exception 'LEASE_DURATION_INVALID'; end if;
  lease_token=encode(gen_random_bytes(24),'hex');
  insert into runtime.lease(resource,owner,token,acquired_at,deadline,version)
  values(p_resource,p_owner,lease_token,clock_timestamp(),clock_timestamp()+make_interval(secs=>p_seconds),0)
  on conflict(resource) do update set owner=excluded.owner,token=excluded.token,acquired_at=excluded.acquired_at,deadline=excluded.deadline,version=runtime.lease.version+1
  where runtime.lease.deadline<=clock_timestamp();
  if not found then return null; end if;
  return lease_token;
end $$;


--
-- Name: assign_outbox_aggregate_version(); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."assign_outbox_aggregate_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
begin
  if new.aggregate_version is null then
    perform pg_advisory_xact_lock(hashtextextended(new.aggregate_id,0));
    select coalesce(max(aggregate_version),0)+1 into new.aggregate_version from runtime.outbox where aggregate_id=new.aggregate_id;
  end if;
  return new;
end $$;


--
-- Name: job; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."job" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "scope_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "state" "text" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "available_at" timestamp with time zone NOT NULL,
    "lease_owner" "text",
    "lease_deadline" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "fencing_token" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "job_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "job_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "runtime_job_fencing_token" CHECK (("fencing_token" >= 0))
);


--
-- Name: claim_job("text", "text", integer, integer); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."claim_job"("p_kind" "text", "p_owner" "text", "p_limit" integer, "p_lease_seconds" integer) RETURNS SETOF "runtime"."job"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
begin
  if p_limit not between 1 and 1000 or p_lease_seconds not between 5 and 900 then raise exception 'JOB_CLAIM_ARGUMENT_INVALID'; end if;
  return query with candidates as(
    select id from runtime.job where kind=p_kind and ((state='queued' and available_at<=clock_timestamp())
      or (state='running' and lease_deadline<=clock_timestamp())) order by priority,available_at,id for update skip locked limit p_limit
  ) update runtime.job target set state='running',lease_owner=p_owner,
    lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
    fencing_token=target.fencing_token+1,updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*;
end $$;


--
-- Name: record_migration_evidence("text", bigint, bigint, numeric, numeric, "text", "text"); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."record_migration_evidence"("p_migration" "text", "p_source_rows" bigint, "p_target_rows" bigint, "p_source_minor" numeric, "p_target_minor" numeric, "p_concurrent_index_sql" "text", "p_recovery_sql" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
begin
  if p_source_rows<>p_target_rows or p_source_minor<>p_target_minor then
    raise exception 'MIGRATION_RECONCILIATION_FAILED:%',p_migration;
  end if;
  insert into runtime.migrationevidence(migration,source_rows,target_rows,source_minor,target_minor,concurrent_index_sql,recovery_sql)
  values(p_migration,p_source_rows,p_target_rows,p_source_minor,p_target_minor,p_concurrent_index_sql,p_recovery_sql);
end $$;


--
-- Name: reject_receipt_mutation(); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."reject_receipt_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'pg_temp'
    AS $$
begin raise exception 'RECEIPT_APPEND_ONLY:%',tg_table_schema||'.'||tg_table_name; end $$;


--
-- Name: release_lease("text", "text", "text"); Type: FUNCTION; Schema: runtime; Owner: -
--

CREATE FUNCTION "runtime"."release_lease"("p_resource" "text", "p_owner" "text", "p_token" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'runtime', 'pg_temp'
    AS $$
  delete from runtime.lease where resource=p_resource and owner=p_owner and token=p_token returning true
$$;


--
-- Name: reject_mutation(); Type: FUNCTION; Schema: support; Owner: -
--

CREATE FUNCTION "support"."reject_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'support', 'pg_temp'
    AS $$ begin raise exception 'SUPPORT_APPEND_ONLY'; end $$;


--
-- Name: resource_scope("text"); Type: FUNCTION; Schema: support; Owner: -
--

CREATE FUNCTION "support"."resource_scope"("p_resource" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'support', 'pg_temp'
    AS $$
  select coalesce(
    (select scope_id from support.ticket where id=p_resource),
    (select scope_id from support.conversation where id=p_resource),
    (select scope_id from support.agent where id=p_resource),
    (select scope_id from support.account where id=p_resource),
    (select scope_id from support.assignmentrule where id=p_resource),
    (select scope_id from support.sla where id=p_resource),
    (select scope_id from support.assignment where id=p_resource),
    (select scope_id from support.evidence where id=p_resource),
    (select scope_id from support.escalation where id=p_resource)
  )
$$;


--
-- Name: actionproof; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."actionproof" (
    "id" "uuid" NOT NULL,
    "token_hash" "bytea" NOT NULL,
    "operation_id" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "request_hash" character(64) NOT NULL,
    "expected_version" bigint,
    "target" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "maker_membership_id" "text" NOT NULL,
    "checker_membership_id" "text" NOT NULL,
    "checker_access_version" bigint NOT NULL,
    "permission_code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "actionproof_check" CHECK (("maker_membership_id" <> "checker_membership_id")),
    CONSTRAINT "actionproof_check1" CHECK ((("expires_at" > "created_at") AND ("expires_at" <= ("created_at" + '00:15:00'::interval)))),
    CONSTRAINT "actionproof_check2" CHECK ((("consumed_at" IS NULL) OR ("consumed_at" >= "created_at"))),
    CONSTRAINT "actionproof_checker_access_version_check" CHECK (("checker_access_version" > 0)),
    CONSTRAINT "actionproof_target_check" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text"])))
);

ALTER TABLE ONLY "access"."actionproof" FORCE ROW LEVEL SECURITY;


--
-- Name: decisionaudit; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."decisionaudit" (
    "id" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "resource_id" "text",
    "scope_id" "text",
    "decision" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "policy_version" "text" NOT NULL,
    "trace_id" "text" NOT NULL,
    "decided_at" timestamp with time zone NOT NULL,
    CONSTRAINT "decisionaudit_decision_check" CHECK (("decision" = ANY (ARRAY['allow'::"text", 'deny'::"text", 'challenge'::"text", 'review'::"text"])))
);


--
-- Name: membership; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."membership" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "client" "text" NOT NULL,
    "employee_no" "text",
    "status" "text" NOT NULL,
    "access_version" bigint DEFAULT 1 NOT NULL,
    "joined_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    "principal_id" "text" NOT NULL,
    CONSTRAINT "membership_access_version_check" CHECK (("access_version" > 0)),
    CONSTRAINT "membership_client_check" CHECK (("client" = ANY (ARRAY['storefront'::"text", 'operator'::"text", 'store'::"text", 'supplier'::"text"]))),
    CONSTRAINT "membership_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text", 'suspended'::"text", 'left'::"text"])))
);


--
-- Name: membershipoverride; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."membershipoverride" (
    "membership_id" "text" NOT NULL,
    "permission_id" "text" NOT NULL,
    "effect" "text" NOT NULL,
    "granted_by" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "membershipoverride_effect_check" CHECK (("effect" = ANY (ARRAY['allow'::"text", 'deny'::"text"])))
);


--
-- Name: membershiprole; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."membershiprole" (
    "membership_id" "text" NOT NULL,
    "role_id" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "delegated_by" "text"
);


--
-- Name: ownership; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."ownership" (
    "scope_id" "text" NOT NULL,
    "role_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "ownership_version_check" CHECK (("version" > 0))
);


--
-- Name: permission; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."permission" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "risk" "text" NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "permission_code_check" CHECK (("code" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'::"text")),
    CONSTRAINT "permission_risk_check" CHECK (("risk" = ANY (ARRAY['low'::"text", 'elevated'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "permission_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'retired'::"text"])))
);


--
-- Name: role; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."role" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "kind" "text" DEFAULT 'custom'::"text" NOT NULL,
    CONSTRAINT "role_kind_valid" CHECK (("kind" = ANY (ARRAY['custom'::"text", 'system'::"text", 'owner'::"text"]))),
    CONSTRAINT "role_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "role_version_check" CHECK (("version" >= 0))
);


--
-- Name: rolepermission; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."rolepermission" (
    "role_id" "text" NOT NULL,
    "permission_id" "text" NOT NULL,
    "effect" "text" NOT NULL,
    CONSTRAINT "rolepermission_effect_check" CHECK (("effect" = ANY (ARRAY['allow'::"text", 'deny'::"text"])))
);


--
-- Name: scopegrant; Type: TABLE; Schema: access; Owner: -
--

CREATE TABLE "access"."scopegrant" (
    "id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "scope_kind" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "scope_path" "text" NOT NULL,
    "effect" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "access_version" bigint NOT NULL,
    CONSTRAINT "scopegrant_effect_check" CHECK (("effect" = ANY (ARRAY['allow'::"text", 'deny'::"text"]))),
    CONSTRAINT "scopegrant_scope_kind_check" CHECK (("scope_kind" = ANY (ARRAY['platform'::"text", 'distributor'::"text", 'tenant'::"text", 'enterprise'::"text", 'mall'::"text", 'department'::"text", 'supplier'::"text", 'brand'::"text", 'store'::"text", 'owner'::"text", 'self'::"text"])))
);


--
-- Name: accessrecord; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."accessrecord" (
    "id" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "fields" "jsonb" NOT NULL,
    "purpose" "text" NOT NULL,
    "trace_id" "text" NOT NULL,
    "accessed_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "actor_type" "text" NOT NULL,
    "previous_hash" character(64),
    "record_hash" character(64) NOT NULL,
    "signature_version" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "audit_access_fields" CHECK ((("jsonb_typeof"("fields") = 'object'::"text") AND ("pg_column_size"("fields") <= 65536))),
    CONSTRAINT "audit_access_signature_version" CHECK ((("signature_version" >= 1) AND ("signature_version" <= 16)))
);


--
-- Name: archiveitem; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."archiveitem" (
    "archive_id" "text" NOT NULL,
    "record_kind" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "record_hash" character(64) NOT NULL,
    "archived_at" timestamp with time zone NOT NULL,
    CONSTRAINT "archiveitem_record_hash_check" CHECK (("record_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "archiveitem_record_kind_check" CHECK (("record_kind" = ANY (ARRAY['command'::"text", 'access'::"text"])))
);


--
-- Name: archiveref; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."archiveref" (
    "id" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "record_count" bigint NOT NULL,
    "archived_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "object_size" bigint NOT NULL,
    "key_version" "text" NOT NULL,
    "first_record_hash" character(64) NOT NULL,
    "last_record_hash" character(64) NOT NULL,
    "through_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "archiveref_record_count_check" CHECK (("record_count" >= 0)),
    CONSTRAINT "audit_archive_objectsize" CHECK ((("object_size" > 0) AND ("object_size" <= 67108864))),
    CONSTRAINT "audit_archive_period" CHECK ((("period_start" <= "period_end") AND ("through_at" <= "archived_at") AND ("expires_at" > "through_at")))
);


--
-- Name: record; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."record" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "actor_id" "text",
    "actor_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "before_hash" character(64),
    "after_hash" character(64),
    "evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "previous_hash" character(64),
    "record_hash" character(64) NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    "signature_version" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "audit_record_evidence" CHECK ((("jsonb_typeof"("evidence") = 'object'::"text") AND ("pg_column_size"("evidence") <= 262144))),
    CONSTRAINT "audit_record_signature_version" CHECK ((("signature_version" >= 1) AND ("signature_version" <= 16)))
)
PARTITION BY RANGE ("recorded_at");


--
-- Name: recorddefault; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."recorddefault" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "actor_id" "text",
    "actor_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text",
    "before_hash" character(64),
    "after_hash" character(64),
    "evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "previous_hash" character(64),
    "record_hash" character(64) NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    "signature_version" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "audit_record_evidence" CHECK ((("jsonb_typeof"("evidence") = 'object'::"text") AND ("pg_column_size"("evidence") <= 262144))),
    CONSTRAINT "audit_record_signature_version" CHECK ((("signature_version" >= 1) AND ("signature_version" <= 16)))
);


--
-- Name: retention; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE "audit"."retention" (
    "scope_id" "text" NOT NULL,
    "hot_days" integer NOT NULL,
    "archive_years" integer NOT NULL,
    "legal_hold" boolean NOT NULL,
    "reason" "text",
    "configured_by" "text" NOT NULL,
    "configured_at" timestamp with time zone NOT NULL,
    "version" bigint NOT NULL,
    CONSTRAINT "retention_archive_years_check" CHECK ((("archive_years" >= 1) AND ("archive_years" <= 30))),
    CONSTRAINT "retention_check" CHECK (((NOT "legal_hold") OR ("reason" IS NOT NULL))),
    CONSTRAINT "retention_hot_days_check" CHECK ((("hot_days" >= 1) AND ("hot_days" <= 3650))),
    CONSTRAINT "retention_version_check" CHECK (("version" >= 0))
);


--
-- Name: account; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."account" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "finance_account_id" "text" NOT NULL,
    CONSTRAINT "account_kind_check" CHECK (("kind" = ANY (ARRAY['welfare'::"text", 'meal'::"text", 'allowance'::"text"]))),
    CONSTRAINT "account_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'frozen'::"text", 'closed'::"text"])))
);


--
-- Name: action; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."action" (
    "id" "text" NOT NULL,
    "batch_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "action_action_check" CHECK (("action" = ANY (ARRAY['pause'::"text", 'resume'::"text", 'cancel'::"text", 'revoke'::"text"]))),
    CONSTRAINT "action_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text"))
);


--
-- Name: entry; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."entry" (
    "id" "text" NOT NULL,
    "journal_id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "side" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "entry_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "entry_side_check" CHECK (("side" = ANY (ARRAY['debit'::"text", 'credit'::"text"])))
);


--
-- Name: journal; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."journal" (
    "id" "text" NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "period" "text" NOT NULL,
    "state" "text" NOT NULL,
    "description" "text" NOT NULL,
    "posted_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    "scope_id" "text" NOT NULL,
    CONSTRAINT "journal_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'posted'::"text", 'reversed'::"text"])))
);


--
-- Name: balance; Type: VIEW; Schema: benefit; Owner: -
--

CREATE VIEW "benefit"."balance" WITH ("security_invoker"='true') AS
 SELECT "account"."id" AS "account_id",
    (COALESCE("sum"(
        CASE
            WHEN ("entry"."side" = 'credit'::"text") THEN "entry"."amount_minor"
            ELSE (- "entry"."amount_minor")
        END) FILTER (WHERE ("journal"."state" = 'posted'::"text")), (0)::numeric))::bigint AS "balance_minor"
   FROM (("benefit"."account" "account"
     LEFT JOIN "finance"."entry" "entry" ON (("entry"."account_id" = "account"."finance_account_id")))
     LEFT JOIN "finance"."journal" "journal" ON (("journal"."id" = "entry"."journal_id")))
  GROUP BY "account"."id";


--
-- Name: budget; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."budget" (
    "id" "text" NOT NULL,
    "plan_id" "text" NOT NULL,
    "period" "text" NOT NULL,
    "total_minor" bigint NOT NULL,
    "granted_minor" bigint DEFAULT 0 NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "reserved_minor" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "benefit_budget_reserved_check" CHECK ((("reserved_minor" >= 0) AND ("granted_minor" >= 0) AND (("reserved_minor" + "granted_minor") <= "total_minor"))),
    CONSTRAINT "budget_check" CHECK ((("granted_minor" >= 0) AND ("granted_minor" <= "total_minor"))),
    CONSTRAINT "budget_total_minor_check" CHECK (("total_minor" >= 0))
);


--
-- Name: grantbatch; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."grantbatch" (
    "id" "text" NOT NULL,
    "plan_id" "text" NOT NULL,
    "budget_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "approved_by" "text",
    "requested_count" integer NOT NULL,
    "amount_minor" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "plan_version" bigint NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "timezone" "text" NOT NULL,
    "snapshot_hash" character(64) NOT NULL,
    "pause_reason" "text",
    CONSTRAINT "grantbatch_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "grantbatch_check" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "grantbatch_check1" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at"))),
    CONSTRAINT "grantbatch_requested_count_check" CHECK (("requested_count" > 0)),
    CONSTRAINT "grantbatch_state_check" CHECK (("state" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'rejected'::"text", 'scheduled'::"text", 'running'::"text", 'paused'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text", 'revoking'::"text", 'revoked'::"text"])))
);


--
-- Name: grantdecision; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."grantdecision" (
    "batch_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "decision" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "grantdecision_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "grantdecision_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text"))
);


--
-- Name: grantitem; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."grantitem" (
    "batch_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "error_code" "text",
    CONSTRAINT "grantitem_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "grantitem_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'scheduled'::"text", 'granted'::"text", 'failed'::"text", 'skipped'::"text", 'revoking'::"text", 'revoked'::"text", 'expired'::"text"])))
);


--
-- Name: lot; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."lot" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "batch_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "total_minor" bigint NOT NULL,
    "remaining_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "origin" "text" DEFAULT 'grant'::"text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "lot_check" CHECK ((("remaining_minor" >= 0) AND ("remaining_minor" <= "total_minor"))),
    CONSTRAINT "lot_check1" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at"))),
    CONSTRAINT "lot_origin_check" CHECK (("origin" = ANY (ARRAY['grant'::"text", 'refund'::"text"]))),
    CONSTRAINT "lot_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'active'::"text", 'consumed'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "lot_total_minor_check" CHECK (("total_minor" > 0))
);


--
-- Name: lotmovement; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."lotmovement" (
    "id" "text" NOT NULL,
    "lot_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "source_id" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "lotmovement_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "lotmovement_kind_check" CHECK (("kind" = ANY (ARRAY['grant'::"text", 'consume'::"text", 'refund'::"text", 'expire'::"text", 'revoke'::"text"])))
);


--
-- Name: plan; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."plan" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "plan_kind_check" CHECK (("kind" = ANY (ARRAY['welfare'::"text", 'meal'::"text", 'allowance'::"text"]))),
    CONSTRAINT "plan_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'retired'::"text"])))
);


--
-- Name: planversion; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."planversion" (
    "plan_id" "text" NOT NULL,
    "version" bigint NOT NULL,
    "name" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "state" "text" NOT NULL,
    "changed_by" "text" NOT NULL,
    "changed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "planversion_kind_check" CHECK (("kind" = ANY (ARRAY['welfare'::"text", 'meal'::"text", 'allowance'::"text"]))),
    CONSTRAINT "planversion_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'retired'::"text"]))),
    CONSTRAINT "planversion_version_check" CHECK (("version" >= 0))
);


--
-- Name: reminder; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."reminder" (
    "id" "text" NOT NULL,
    "lot_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reminder_kind_check" CHECK (("kind" = 'expiry'::"text"))
);


--
-- Name: reservation; Type: TABLE; Schema: benefit; Owner: -
--

CREATE TABLE "benefit"."reservation" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reservation_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "reservation_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'consumed'::"text", 'released'::"text", 'expired'::"text"])))
);


--
-- Name: capability; Type: TABLE; Schema: capability; Owner: -
--

CREATE TABLE "capability"."capability" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "version" integer NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "capability_kind_check" CHECK (("kind" = ANY (ARRAY['operation'::"text", 'feature'::"text", 'uiblock'::"text", 'quota'::"text", 'entitlement'::"text"]))),
    CONSTRAINT "capability_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'retired'::"text"]))),
    CONSTRAINT "capability_version_check" CHECK (("version" > 0))
);


--
-- Name: dependency; Type: TABLE; Schema: capability; Owner: -
--

CREATE TABLE "capability"."dependency" (
    "capability_id" "text" NOT NULL,
    "depends_on_id" "text" NOT NULL,
    CONSTRAINT "dependency_check" CHECK (("capability_id" <> "depends_on_id"))
);


--
-- Name: entitlement; Type: TABLE; Schema: capability; Owner: -
--

CREATE TABLE "capability"."entitlement" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "capability_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "quota" bigint,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "entitlement_quota_check" CHECK ((("quota" IS NULL) OR ("quota" >= 0))),
    CONSTRAINT "entitlement_state_check" CHECK (("state" = ANY (ARRAY['enabled'::"text", 'disabled'::"text"])))
);


--
-- Name: operation; Type: TABLE; Schema: capability; Owner: -
--

CREATE TABLE "capability"."operation" (
    "operation_id" "text" NOT NULL,
    "capability_id" "text" NOT NULL,
    "permission_code" "text",
    "audience" "text" NOT NULL,
    CONSTRAINT "operation_audience_check" CHECK (("audience" = ANY (ARRAY['public'::"text", 'console'::"text", 'storefront'::"text", 'system'::"text", 'webhook'::"text"])))
);


--
-- Name: cart; Type: TABLE; Schema: cart; Owner: -
--

CREATE TABLE "cart"."cart" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "application_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "cart_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'converted'::"text", 'abandoned'::"text"])))
);


--
-- Name: item; Type: TABLE; Schema: cart; Owner: -
--

CREATE TABLE "cart"."item" (
    "cart_id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "sku_id" "text" NOT NULL,
    "quantity" bigint NOT NULL,
    "listing_version" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "item_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: availabilitycity; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."availabilitycity" (
    "zone_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "city_key" "text" NOT NULL
);


--
-- Name: availabilityitem; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."availabilityitem" (
    "zone_id" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "availabilityitem_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['product'::"text", 'sku'::"text"])))
);


--
-- Name: availabilityzone; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."availabilityzone" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "mall_id" "text",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "applies_to" "text" NOT NULL,
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "attributes" "jsonb" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "availabilityzone_applies_to_check" CHECK (("applies_to" = ANY (ARRAY['visible'::"text", 'purchasable'::"text", 'both'::"text"]))),
    CONSTRAINT "availabilityzone_attributes_check" CHECK (("jsonb_typeof"("attributes") = 'object'::"text")),
    CONSTRAINT "availabilityzone_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'disabled'::"text"])))
);


--
-- Name: category; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."category" (
    "id" "text" NOT NULL,
    "parent_id" "text",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "category_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: classificationrule; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."classificationrule" (
    "id" "text" NOT NULL,
    "taxonomy_version" "text" NOT NULL,
    "name" "text" NOT NULL,
    "source_field" "text" NOT NULL,
    "match_pattern" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "priority" integer NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "classificationrule_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: importerror; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."importerror" (
    "job_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "reason_code" "text" NOT NULL,
    "field" "text",
    "detail" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    CONSTRAINT "importerror_row_number_check" CHECK (("row_number" > 0))
);


--
-- Name: importjob; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."importjob" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "success_count" integer DEFAULT 0 NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "cursor_value" integer DEFAULT 0 NOT NULL,
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "report_object_ref" "text",
    "report_sha256" character(64),
    "report_size" bigint,
    CONSTRAINT "catalog_import_last_error" CHECK ((("last_error" IS NULL) OR ("length"("last_error") <= 500))),
    CONSTRAINT "catalog_import_progress" CHECK (((("total_count" >= 0) AND ("total_count" <= 100000)) AND (("cursor_value" >= 0) AND ("cursor_value" <= "total_count")) AND (("success_count" + "failure_count") <= "cursor_value") AND ("jsonb_typeof"("validation_summary") = 'object'::"text"))),
    CONSTRAINT "catalog_import_report" CHECK (((("report_object_ref" IS NULL) AND ("report_sha256" IS NULL) AND ("report_size" IS NULL)) OR (("report_object_ref" IS NOT NULL) AND ("report_sha256" ~ '^[0-9a-f]{64}$'::"text") AND ("report_size" > 0)))),
    CONSTRAINT "catalog_import_state" CHECK (("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "importjob_failure_count_check" CHECK (("failure_count" >= 0)),
    CONSTRAINT "importjob_success_count_check" CHECK (("success_count" >= 0)),
    CONSTRAINT "importjob_total_count_check" CHECK (("total_count" >= 0))
);


--
-- Name: importrow; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."importrow" (
    "job_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "payload" "jsonb" NOT NULL,
    CONSTRAINT "importrow_payload_check" CHECK ((("jsonb_typeof"("payload") = 'object'::"text") AND ("pg_column_size"("payload") <= 65536))),
    CONSTRAINT "importrow_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: listing; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."listing" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "pool_id" "text",
    "sku_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "listing_check" CHECK ((("expires_at" IS NULL) OR ("effective_at" IS NULL) OR ("expires_at" > "effective_at"))),
    CONSTRAINT "listing_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'unpublished'::"text", 'retired'::"text"])))
);


--
-- Name: pool; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."pool" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "pool_kind_check" CHECK (("kind" = ANY (ARRAY['global'::"text", 'channel'::"text", 'private'::"text", 'markup'::"text"]))),
    CONSTRAINT "pool_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'disabled'::"text"])))
);


--
-- Name: poolbinding; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."poolbinding" (
    "mall_id" "text" NOT NULL,
    "pool_id" "text" NOT NULL,
    "listing_kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "poolbinding_listing_kind_check" CHECK (("listing_kind" = ANY (ARRAY['selected'::"text", 'combined'::"text"]))),
    CONSTRAINT "poolbinding_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: poolitem; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."poolitem" (
    "pool_id" "text" NOT NULL,
    "sku_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "source_version" "text" NOT NULL,
    "added_at" timestamp with time zone NOT NULL,
    CONSTRAINT "poolitem_state_check" CHECK (("state" = ANY (ARRAY['included'::"text", 'excluded'::"text", 'unpublished'::"text"])))
);


--
-- Name: product; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."product" (
    "id" "text" NOT NULL,
    "owner_partner_id" "text",
    "brand_id" "text",
    "category_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "product_type" "text" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "product_attributes_check" CHECK (("jsonb_typeof"("attributes") = 'object'::"text")),
    CONSTRAINT "product_product_type_check" CHECK (("product_type" = ANY (ARRAY['physical'::"text", 'virtual'::"text", 'service'::"text", 'voucher'::"text"]))),
    CONSTRAINT "product_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'review'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "product_version_check" CHECK (("version" >= 0))
);


--
-- Name: review; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."review" (
    "id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text",
    "reviewer_id" "text",
    "decided_at" timestamp with time zone,
    CONSTRAINT "review_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: sku; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."sku" (
    "id" "text" NOT NULL,
    "product_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "specifications" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "sku_specifications_check" CHECK (("jsonb_typeof"("specifications") = 'object'::"text")),
    CONSTRAINT "sku_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


--
-- Name: sourcelisting; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."sourcelisting" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "object_type" "text" NOT NULL,
    "sku_id" "text",
    "scope_id" "text" NOT NULL,
    "source_version" "text" NOT NULL,
    "source_payload" "jsonb" NOT NULL,
    "source_hash" character(64) NOT NULL,
    "status" "text" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "sourcelisting_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'mapped'::"text", 'rejected'::"text", 'retired'::"text"])))
);


--
-- Name: suppliercategory; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE "catalog"."suppliercategory" (
    "id" "text" NOT NULL,
    "supplier_id" "text" NOT NULL,
    "source_code" "text",
    "source_name" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "confidence" numeric(4,3) NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "suppliercategory_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "suppliercategory_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'reviewed'::"text", 'disabled'::"text"])))
);


--
-- Name: connection; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."connection" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "contract_version" "text" NOT NULL,
    "secret_ref" "text",
    "configuration" "jsonb" NOT NULL,
    "connection_timeout_ms" integer NOT NULL,
    "response_timeout_ms" integer NOT NULL,
    "total_deadline_ms" integer NOT NULL,
    "max_concurrency" integer NOT NULL,
    "requests_per_second" numeric(12,3) NOT NULL,
    "max_attempts" integer NOT NULL,
    "failure_threshold" integer NOT NULL,
    "recovery_ms" integer NOT NULL,
    "region" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "connection_configuration_check" CHECK (("jsonb_typeof"("configuration") = 'object'::"text")),
    CONSTRAINT "connection_connection_timeout_ms_check" CHECK ((("connection_timeout_ms" >= 1) AND ("connection_timeout_ms" <= 30000))),
    CONSTRAINT "connection_failure_threshold_check" CHECK ((("failure_threshold" >= 1) AND ("failure_threshold" <= 100))),
    CONSTRAINT "connection_max_attempts_check" CHECK ((("max_attempts" >= 1) AND ("max_attempts" <= 5))),
    CONSTRAINT "connection_max_concurrency_check" CHECK ((("max_concurrency" >= 1) AND ("max_concurrency" <= 64))),
    CONSTRAINT "connection_recovery_ms_check" CHECK ((("recovery_ms" >= 100) AND ("recovery_ms" <= 3600000))),
    CONSTRAINT "connection_requests_per_second_check" CHECK (("requests_per_second" > (0)::numeric)),
    CONSTRAINT "connection_response_timeout_ms_check" CHECK ((("response_timeout_ms" >= 1) AND ("response_timeout_ms" <= 120000))),
    CONSTRAINT "connection_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'testing'::"text", 'enabled'::"text", 'degraded'::"text", 'disabled'::"text"]))),
    CONSTRAINT "connection_total_deadline_ms_check" CHECK ((("total_deadline_ms" >= 1) AND ("total_deadline_ms" <= 300000)))
);


--
-- Name: distributor; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."distributor" (
    "id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "contact_ciphertext" "text",
    "contact_token" character(64),
    "contact_key_version" "text",
    "settlement_mode" "text" NOT NULL,
    "metadata" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "distributor_check" CHECK ((("contact_ciphertext" IS NULL) = ("contact_token" IS NULL))),
    CONSTRAINT "distributor_check1" CHECK ((("contact_ciphertext" IS NULL) = ("contact_key_version" IS NULL))),
    CONSTRAINT "distributor_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "distributor_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'suspended'::"text", 'terminated'::"text"])))
);


--
-- Name: externalobject; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."externalobject" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "objecttype" "text" NOT NULL,
    "externalid" "text" NOT NULL,
    "internaltype" "text" NOT NULL,
    "internalid" "text" NOT NULL,
    "sourceversion" "text" NOT NULL,
    "mapped_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL
);


--
-- Name: provideroperation; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."provideroperation" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "internal_reference" "text" NOT NULL,
    "external_reference" "text",
    "state" "text" NOT NULL,
    "request_hash" character(64) NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "provideroperation_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'submitted'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'unknown'::"text"])))
);


--
-- Name: sourcerecord; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."sourcerecord" (
    "id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "objecttype" "text" NOT NULL,
    "externalid" "text" NOT NULL,
    "sourceversion" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "payload_hash" character(64) NOT NULL,
    "disposition" "text" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "sourcerecord_disposition_check" CHECK (("disposition" = ANY (ARRAY['received'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "sourcerecord_payload_check" CHECK (("jsonb_typeof"("payload") = 'object'::"text"))
);


--
-- Name: statement; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."statement" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "partner_id" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "timezone" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "generated_at" timestamp with time zone NOT NULL
);


--
-- Name: syncrun; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."syncrun" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "cursor_value" "text",
    "input_hash" character(64) NOT NULL,
    "input" "jsonb" NOT NULL,
    "error_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "watermark" timestamp with time zone,
    "pulled_count" bigint DEFAULT 0 NOT NULL,
    "accepted_count" bigint DEFAULT 0 NOT NULL,
    "rejected_count" bigint DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "syncrun_error_summary_check" CHECK (("jsonb_typeof"("error_summary") = 'array'::"text")),
    CONSTRAINT "syncrun_input_check" CHECK (("jsonb_typeof"("input") = 'object'::"text")),
    CONSTRAINT "syncrun_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: tenantbinding; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."tenantbinding" (
    "id" "text" NOT NULL,
    "distributor_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "tenantbinding_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "tenantbinding_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'active'::"text", 'expired'::"text", 'terminated'::"text"])))
);


--
-- Name: webhookinbox; Type: TABLE; Schema: channel; Owner: -
--

CREATE TABLE "channel"."webhookinbox" (
    "id" "text" NOT NULL,
    "connection_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "external_reference" "text",
    "normalized" "jsonb" NOT NULL,
    "raw_ciphertext" "text" NOT NULL,
    "raw_key_version" "text" NOT NULL,
    "raw_hash" character(64) NOT NULL,
    "signature_hash" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "error_code" "text",
    "received_at" timestamp with time zone NOT NULL,
    "processed_at" timestamp with time zone,
    "trace_id" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "webhookinbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "webhookinbox_normalized_check" CHECK (("jsonb_typeof"("normalized") = 'object'::"text")),
    CONSTRAINT "webhookinbox_state_check" CHECK (("state" = ANY (ARRAY['received'::"text", 'processing'::"text", 'applied'::"text", 'ignored'::"text", 'failed'::"text"])))
);


--
-- Name: address; Type: TABLE; Schema: checkout; Owner: -
--

CREATE TABLE "checkout"."address" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "recipient_ciphertext" "text" NOT NULL,
    "mobile_ciphertext" "text" NOT NULL,
    "address_ciphertext" "text" NOT NULL,
    "region_token" character(64) NOT NULL,
    "address_token" character(64) NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "recipient_masked" "text" DEFAULT '***'::"text" NOT NULL,
    "mobile_masked" "text" DEFAULT '***'::"text" NOT NULL,
    "address_masked" "text" DEFAULT '***'::"text" NOT NULL,
    "region_code" "text" DEFAULT 'unknown'::"text" NOT NULL,
    CONSTRAINT "address_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deleted'::"text"])))
);


--
-- Name: evidence; Type: TABLE; Schema: checkout; Owner: -
--

CREATE TABLE "checkout"."evidence" (
    "checkout_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "version" "text" NOT NULL,
    "payload_hash" character(64) NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "evidence_kind_check" CHECK (("kind" = ANY (ARRAY['cart'::"text", 'profile'::"text", 'address'::"text", 'invoice'::"text", 'experience'::"text", 'qualification'::"text", 'pricing'::"text", 'marketing'::"text", 'vouchers'::"text", 'benefits'::"text", 'inventory'::"text", 'delivery'::"text"])))
);


--
-- Name: session; Type: TABLE; Schema: checkout; Owner: -
--

CREATE TABLE "checkout"."session" (
    "id" "text" NOT NULL,
    "cart_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "application_id" "text" NOT NULL,
    "quote_id" "text" NOT NULL,
    "quote_hash" character(64) NOT NULL,
    "address_id" "text",
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "input" "jsonb" NOT NULL,
    CONSTRAINT "session_input_check" CHECK (("jsonb_typeof"("input") = 'object'::"text")),
    CONSTRAINT "session_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'quoted'::"text", 'confirmed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


--
-- Name: application; Type: TABLE; Schema: experience; Owner: -
--

CREATE TABLE "experience"."application" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "head_version_id" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "code" "text" NOT NULL,
    "public_slug" "text" NOT NULL,
    CONSTRAINT "application_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "experience_application_code_format" CHECK (("code" ~ '^[A-Z][A-Z0-9_]{2,31}$'::"text")),
    CONSTRAINT "experience_application_public_slug_format" CHECK (("public_slug" ~ '^[a-z0-9][a-z0-9-]{2,47}$'::"text"))
);


--
-- Name: binding; Type: TABLE; Schema: experience; Owner: -
--

CREATE TABLE "experience"."binding" (
    "application_id" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "pool_id" "text" NOT NULL
);


--
-- Name: publication; Type: TABLE; Schema: experience; Owner: -
--

CREATE TABLE "experience"."publication" (
    "id" "text" NOT NULL,
    "release_id" "text" NOT NULL,
    "application_id" "text" NOT NULL,
    "version_id" "text" NOT NULL,
    "content_hash" character(64) NOT NULL,
    "object_key" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "object_hash" character(64) NOT NULL,
    "object_size" bigint NOT NULL,
    "state" "text" NOT NULL,
    "staged_at" timestamp with time zone NOT NULL,
    "published_at" timestamp with time zone,
    "failure_code" "text",
    CONSTRAINT "publication_check" CHECK ((("object_hash" ~ '^[0-9a-f]{64}$'::"text") AND ("object_hash" = "content_hash"))),
    CONSTRAINT "publication_check1" CHECK (((("state" = 'active'::"text") AND ("published_at" IS NOT NULL) AND ("failure_code" IS NULL)) OR ("state" <> 'active'::"text"))),
    CONSTRAINT "publication_content_hash_check" CHECK (("content_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "publication_object_key_check" CHECK (("object_key" ~ '^experience/[A-Za-z0-9:.-]+/[0-9a-f]{64}\.json$'::"text")),
    CONSTRAINT "publication_object_size_check" CHECK (("object_size" > 0)),
    CONSTRAINT "publication_state_check" CHECK (("state" = ANY (ARRAY['staged'::"text", 'active'::"text", 'retired'::"text", 'failed'::"text"])))
);


--
-- Name: release; Type: TABLE; Schema: experience; Owner: -
--

CREATE TABLE "experience"."release" (
    "id" "text" NOT NULL,
    "application_id" "text" NOT NULL,
    "version_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "retired_at" timestamp with time zone,
    "published_by" "text" NOT NULL,
    CONSTRAINT "release_state_check" CHECK (("state" = ANY (ARRAY['scheduled'::"text", 'active'::"text", 'retired'::"text", 'failed'::"text"])))
);


--
-- Name: version; Type: TABLE; Schema: experience; Owner: -
--

CREATE TABLE "experience"."version" (
    "id" "text" NOT NULL,
    "application_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "schema_version" "text" NOT NULL,
    "configuration" "jsonb" NOT NULL,
    "configuration_hash" character(64) NOT NULL,
    "validation_state" "text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "reason" "text",
    CONSTRAINT "version_configuration_check" CHECK (("jsonb_typeof"("configuration") = 'object'::"text")),
    CONSTRAINT "version_sequence_check" CHECK (("sequence" > 0)),
    CONSTRAINT "version_validation_state_check" CHECK (("validation_state" = ANY (ARRAY['pending'::"text", 'valid'::"text", 'invalid'::"text"])))
);


--
-- Name: activationhistory; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."activationhistory" (
    "installation_id" "text" NOT NULL,
    "sequence" bigint NOT NULL,
    "previous_state" "text",
    "next_state" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "extension_activation_evidence" CHECK (("pg_column_size"("evidence") <= 65536))
);


--
-- Name: contractversion; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."contractversion" (
    "extension_id" "text" NOT NULL,
    "contract_version" "text" NOT NULL,
    "schema_hash" character(64) NOT NULL,
    "sandbox_evidence_ref" "text",
    "status" "text" NOT NULL,
    CONSTRAINT "contractversion_status_check" CHECK (("status" = ANY (ARRAY['designed'::"text", 'verified'::"text", 'retired'::"text"]))),
    CONSTRAINT "extension_contract_hash" CHECK (("schema_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


--
-- Name: health; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."health" (
    "installation_id" "text" NOT NULL,
    "checked_at" timestamp with time zone NOT NULL,
    "connection_version" bigint NOT NULL,
    "state" "text" NOT NULL,
    "latency_ms" integer,
    "reason" "text",
    CONSTRAINT "extension_health_reason" CHECK ((("reason" IS NULL) OR ("length"("reason") <= 500))),
    CONSTRAINT "health_connection_version_check" CHECK (("connection_version" >= 0)),
    CONSTRAINT "health_latency_ms_check" CHECK ((("latency_ms" IS NULL) OR ("latency_ms" >= 0))),
    CONSTRAINT "health_state_check" CHECK (("state" = ANY (ARRAY['healthy'::"text", 'degraded'::"text", 'unavailable'::"text"])))
);


--
-- Name: manifest; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."manifest" (
    "id" "text" NOT NULL,
    "version" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "contract_version" "text" NOT NULL,
    "manifest" "jsonb" NOT NULL,
    "manifest_hash" character(64) NOT NULL,
    "signature" "text" NOT NULL,
    "registered_at" timestamp with time zone NOT NULL,
    CONSTRAINT "extension_manifest_hash" CHECK (("manifest_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "extension_manifest_identity" CHECK ((("id" ~ '^[a-z][a-z0-9]{1,63}$'::"text") AND ("version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::"text") AND (("length"("contract_version") >= 1) AND ("length"("contract_version") <= 128)))),
    CONSTRAINT "extension_manifest_signature" CHECK (((("length"("signature") >= 8) AND ("length"("signature") <= 1024)) AND ("signature" ~ '^[A-Za-z0-9+/]+={0,2}$'::"text"))),
    CONSTRAINT "extension_manifest_size" CHECK (("pg_column_size"("manifest") <= 65536)),
    CONSTRAINT "manifest_manifest_check" CHECK (("jsonb_typeof"("manifest") = 'object'::"text"))
);


--
-- Name: registry; Type: TABLE; Schema: extension; Owner: -
--

CREATE TABLE "extension"."registry" (
    "extension_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "installation_id" "text" NOT NULL,
    "extension_version" "text" NOT NULL,
    "installation_version" bigint NOT NULL,
    "state" "text" NOT NULL,
    "generation" bigint NOT NULL,
    "activated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "extension_registry_version" CHECK (("extension_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::"text")),
    CONSTRAINT "registry_generation_check" CHECK (("generation" > 0)),
    CONSTRAINT "registry_installation_version_check" CHECK (("installation_version" >= 0)),
    CONSTRAINT "registry_state_check" CHECK (("state" = ANY (ARRAY['enabled'::"text", 'degraded'::"text"])))
);


--
-- Name: account; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."account" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "account_kind_check" CHECK (("kind" = ANY (ARRAY['asset'::"text", 'liability'::"text", 'equity'::"text", 'income'::"text", 'expense'::"text"]))),
    CONSTRAINT "account_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))
);


--
-- Name: backfill; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."backfill" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "source_hash" character(64) NOT NULL,
    "target_hash" character(64) NOT NULL,
    "source_count" bigint NOT NULL,
    "target_count" bigint NOT NULL,
    "source_minor" bigint NOT NULL,
    "target_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "prepared_by" "text" NOT NULL,
    "signed_by" "text",
    "evidence" "jsonb" NOT NULL,
    "prepared_at" timestamp with time zone NOT NULL,
    "signed_at" timestamp with time zone,
    CONSTRAINT "backfill_check" CHECK ((("signed_by" IS NULL) OR ("signed_by" <> "prepared_by"))),
    CONSTRAINT "backfill_check1" CHECK (((("state" = 'pending'::"text") AND ("signed_by" IS NULL) AND ("signed_at" IS NULL)) OR (("state" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("signed_by" IS NOT NULL) AND ("signed_at" IS NOT NULL)))),
    CONSTRAINT "backfill_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "backfill_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: economicleg; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."economicleg" (
    "owner_event_id" "text" NOT NULL,
    "economic_leg_id" "text" NOT NULL,
    "journal_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "amount_minor" bigint NOT NULL,
    "posted_at" timestamp with time zone NOT NULL,
    CONSTRAINT "finance_economic_leg_amount" CHECK (("amount_minor" > 0))
);


--
-- Name: hold; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."hold" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "hold_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "hold_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'captured'::"text", 'released'::"text", 'expired'::"text"])))
);


--
-- Name: period; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."period" (
    "scope_id" "text" NOT NULL,
    "period" "text" NOT NULL,
    "state" "text" NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by" "text",
    CONSTRAINT "period_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'closing'::"text", 'closed'::"text"])))
);


--
-- Name: periodclose; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."periodclose" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "period" "text" NOT NULL,
    "state" "text" NOT NULL,
    "source_hash" character(64) NOT NULL,
    "requested_by" "text" NOT NULL,
    "approved_by" "text",
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "requested_at" timestamp with time zone NOT NULL,
    "decided_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "periodclose_check" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "periodclose_check1" CHECK (((("state" = 'pending'::"text") AND ("approved_by" IS NULL) AND ("decided_at" IS NULL)) OR (("state" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("approved_by" IS NOT NULL) AND ("decided_at" IS NOT NULL)))),
    CONSTRAINT "periodclose_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "periodclose_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: policy; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."policy" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "rule" "jsonb" NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "policy_rule_check" CHECK (("jsonb_typeof"("rule") = 'object'::"text")),
    CONSTRAINT "policy_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"])))
);


--
-- Name: reconciliation; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."reconciliation" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "partner_id" "text" NOT NULL,
    "period" "text" NOT NULL,
    "statement_ref" "text" NOT NULL,
    "statement_hash" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "debit_minor" bigint DEFAULT 0 NOT NULL,
    "credit_minor" bigint DEFAULT 0 NOT NULL,
    "difference_minor" bigint DEFAULT 0 NOT NULL,
    "created_by" "text" NOT NULL,
    "approved_by" "text",
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "reconciliation_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "reconciliation_state_check" CHECK (("state" = ANY (ARRAY['received'::"text", 'matching'::"text", 'balanced'::"text", 'difference'::"text", 'resolved'::"text", 'approved'::"text"])))
);


--
-- Name: reconciliationitem; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."reconciliationitem" (
    "id" "text" NOT NULL,
    "reconciliation_id" "text" NOT NULL,
    "statement_line_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "internal_type" "text",
    "internal_id" "text",
    "external_minor" bigint NOT NULL,
    "internal_minor" bigint NOT NULL,
    "difference_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "reason_code" "text",
    "evidence" "jsonb" NOT NULL,
    "resolution" "jsonb",
    "resolved_by" "text",
    "approved_by" "text",
    "resolved_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "reconciliationitem_check" CHECK (((("state" = ANY (ARRAY['matched'::"text", 'difference'::"text"])) AND ("resolution" IS NULL) AND ("resolved_by" IS NULL) AND ("resolved_at" IS NULL) AND ("approved_by" IS NULL) AND ("approved_at" IS NULL)) OR (("state" = 'resolutionpending'::"text") AND ("jsonb_typeof"("resolution") = 'object'::"text") AND ("resolved_by" IS NOT NULL) AND ("resolved_at" IS NOT NULL) AND ("approved_by" IS NULL) AND ("approved_at" IS NULL)) OR (("state" = 'resolved'::"text") AND ("jsonb_typeof"("resolution") = 'object'::"text") AND ("resolved_by" IS NOT NULL) AND ("approved_by" IS NOT NULL) AND ("resolved_by" <> "approved_by") AND ("resolved_at" IS NOT NULL) AND ("approved_at" IS NOT NULL)))),
    CONSTRAINT "reconciliationitem_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "reconciliationitem_state_check" CHECK (("state" = ANY (ARRAY['matched'::"text", 'difference'::"text", 'resolutionpending'::"text", 'resolved'::"text"])))
);


--
-- Name: settlement; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."settlement" (
    "id" "text" NOT NULL,
    "partner_id" "text" NOT NULL,
    "period" "text" NOT NULL,
    "reconciliation_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "state" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "requested_by" "text",
    "approved_by" "text",
    "frozen_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "gross_minor" bigint NOT NULL,
    "fee_minor" bigint DEFAULT 0 NOT NULL,
    "invoice_basis" "text" DEFAULT 'gross'::"text" NOT NULL,
    CONSTRAINT "settlement_check" CHECK ((("amount_minor" = ("gross_minor" - "fee_minor")) AND ("amount_minor" > 0))),
    CONSTRAINT "settlement_check1" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "settlement_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "settlement_fee_minor_check" CHECK (("fee_minor" >= 0)),
    CONSTRAINT "settlement_invoice_basis_check" CHECK (("invoice_basis" = ANY (ARRAY['gross'::"text", 'net'::"text"]))),
    CONSTRAINT "settlement_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'payable'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


--
-- Name: settlementadjustment; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."settlementadjustment" (
    "id" "text" NOT NULL,
    "settlement_id" "text" NOT NULL,
    "settlement_line_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "tax_minor" bigint DEFAULT 0 NOT NULL,
    "state" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "approved_by" "text",
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "decided_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "settlementadjustment_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "settlementadjustment_check" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "settlementadjustment_check1" CHECK (((("state" = 'pending'::"text") AND ("approved_by" IS NULL) AND ("decided_at" IS NULL)) OR (("state" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("approved_by" IS NOT NULL) AND ("decided_at" IS NOT NULL)))),
    CONSTRAINT "settlementadjustment_direction_check" CHECK (("direction" = ANY (ARRAY['increase'::"text", 'decrease'::"text"]))),
    CONSTRAINT "settlementadjustment_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "settlementadjustment_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "settlementadjustment_tax_minor_check" CHECK (("tax_minor" >= 0))
);


--
-- Name: settlementline; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."settlementline" (
    "id" "text" NOT NULL,
    "settlement_id" "text" NOT NULL,
    "reconciliation_item_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "invoice_minor" bigint NOT NULL,
    "tax_minor" bigint DEFAULT 0 NOT NULL,
    "direction" "text" DEFAULT 'increase'::"text" NOT NULL,
    "state" "text" NOT NULL,
    "adjustment_of" "text",
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "settlementline_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "settlementline_direction_check" CHECK (("direction" = ANY (ARRAY['increase'::"text", 'decrease'::"text"]))),
    CONSTRAINT "settlementline_invoice_minor_check" CHECK (("invoice_minor" >= 0)),
    CONSTRAINT "settlementline_state_check" CHECK (("state" = ANY (ARRAY['frozen'::"text", 'adjusted'::"text"]))),
    CONSTRAINT "settlementline_tax_minor_check" CHECK (("tax_minor" >= 0))
);


--
-- Name: split; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."split" (
    "id" "text" NOT NULL,
    "settlement_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "beneficiary_type" "text" NOT NULL,
    "beneficiary_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "basis_points" integer NOT NULL,
    "state" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "split_amount_minor_check" CHECK (("amount_minor" >= 0)),
    CONSTRAINT "split_basis_points_check" CHECK ((("basis_points" >= 0) AND ("basis_points" <= 10000))),
    CONSTRAINT "split_beneficiary_type_check" CHECK (("beneficiary_type" = ANY (ARRAY['partner'::"text", 'platform'::"text"]))),
    CONSTRAINT "split_state_check" CHECK (("state" = ANY (ARRAY['frozen'::"text", 'paid'::"text"])))
);


--
-- Name: statement; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."statement" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "currency" character(3) NOT NULL,
    "opening_minor" bigint NOT NULL,
    "debit_minor" bigint NOT NULL,
    "credit_minor" bigint NOT NULL,
    "closing_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "object_ref" "text",
    "sha256" character(64),
    "generated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "statement_credit_minor_check" CHECK (("credit_minor" >= 0)),
    CONSTRAINT "statement_debit_minor_check" CHECK (("debit_minor" >= 0)),
    CONSTRAINT "statement_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'final'::"text", 'replaced'::"text"])))
);


--
-- Name: statementline; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."statementline" (
    "id" "text" NOT NULL,
    "reconciliation_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "external_reference" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "tax_minor" bigint DEFAULT 0 NOT NULL,
    "currency" character(3) NOT NULL,
    "occurred_at" timestamp with time zone,
    "raw_hash" character(64) NOT NULL,
    CONSTRAINT "statementline_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "statementline_kind_check" CHECK (("kind" = ANY (ARRAY['payment'::"text", 'refund'::"text", 'fulfillment'::"text", 'fee'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "statementline_sequence_check" CHECK (("sequence" > 0)),
    CONSTRAINT "statementline_tax_minor_check" CHECK (("tax_minor" >= 0))
);


--
-- Name: withdrawal; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE "finance"."withdrawal" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "settlement_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "destination_ref" "text" NOT NULL,
    "state" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "approved_by" "text",
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "provider_reference" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "paid_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "withdrawal_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "withdrawal_check" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "withdrawal_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "withdrawal_state_check" CHECK (("state" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'processing'::"text", 'paid'::"text", 'rejected'::"text", 'failed'::"text", 'uncertain'::"text", 'cancelled'::"text"])))
);


--
-- Name: fulfillmentorder; Type: TABLE; Schema: fulfillment; Owner: -
--

CREATE TABLE "fulfillment"."fulfillmentorder" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "suborder_id" "text" NOT NULL,
    "provider" "text",
    "partner_id" "text",
    "store_id" "text",
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "external_reference" "text",
    "payment_id" "text",
    "source_effect_id" "text",
    "amount_minor" bigint,
    "idempotency_key" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "fulfillmentorder_amount_minor_check" CHECK ((("amount_minor" IS NULL) OR ("amount_minor" >= 0))),
    CONSTRAINT "fulfillmentorder_kind_check" CHECK (("kind" = ANY (ARRAY['shipment'::"text", 'delivery'::"text", 'pickup'::"text", 'service'::"text", 'digital'::"text"]))),
    CONSTRAINT "fulfillmentorder_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'submitted'::"text", 'accepted'::"text", 'processing'::"text", 'ready'::"text", 'completed'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


--
-- Name: line; Type: TABLE; Schema: fulfillment; Owner: -
--

CREATE TABLE "fulfillment"."line" (
    "fulfillment_id" "text" NOT NULL,
    "order_line_id" "text" NOT NULL,
    "quantity" bigint NOT NULL,
    CONSTRAINT "line_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: milestone; Type: TABLE; Schema: fulfillment; Owner: -
--

CREATE TABLE "fulfillment"."milestone" (
    "id" "text" NOT NULL,
    "fulfillment_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "external_id" "text",
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL
);


--
-- Name: returnrecord; Type: TABLE; Schema: fulfillment; Owner: -
--

CREATE TABLE "fulfillment"."returnrecord" (
    "id" "text" NOT NULL,
    "aftersale_id" "text" NOT NULL,
    "fulfillment_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "tracking_number" "text",
    "inspection" "jsonb",
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "returnrecord_state_check" CHECK (("state" = ANY (ARRAY['authorized'::"text", 'intransit'::"text", 'received'::"text", 'inspected'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


--
-- Name: assurance; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."assurance" (
    "id" "text" NOT NULL,
    "principal_id" "text" NOT NULL,
    "method" "text" NOT NULL,
    "level" smallint NOT NULL,
    "evidence_hash" character(64) NOT NULL,
    "verified_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "assurance_level_check" CHECK ((("level" >= 1) AND ("level" <= 3)))
);


--
-- Name: authticket; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."authticket" (
    "id" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "token_hash" character(64) NOT NULL,
    "state_hash" character(64) NOT NULL,
    "nonce_hash" character(64) NOT NULL,
    "pkce_challenge" "text" NOT NULL,
    "target" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "authticket_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "authticket_check1" CHECK ((("consumed_at" IS NULL) OR ("consumed_at" >= "created_at"))),
    CONSTRAINT "authticket_nonce_hash_check" CHECK (("nonce_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "authticket_pkce_challenge_check" CHECK (("pkce_challenge" ~ '^[A-Za-z0-9_-]{43}$'::"text")),
    CONSTRAINT "authticket_state_hash_check" CHECK (("state_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "authticket_target_check" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text", 'store'::"text", 'supplier'::"text"]))),
    CONSTRAINT "authticket_token_hash_check" CHECK (("token_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


--
-- Name: challenge; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."challenge" (
    "id" "text" NOT NULL,
    "principal_id" "text",
    "purpose" "text" NOT NULL,
    "destination_hash" character(64) NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "challenge_attempts_check" CHECK ((("attempts" >= 0) AND ("attempts" <= 10)))
);


--
-- Name: challengedelivery; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."challengedelivery" (
    "challenge_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text",
    "state" "text" NOT NULL,
    "error_code" "text",
    "attempted_at" timestamp with time zone NOT NULL,
    CONSTRAINT "challengedelivery_state_check" CHECK (("state" = ANY (ARRAY['sending'::"text", 'sent'::"text", 'failed'::"text", 'ambiguous'::"text"])))
);


--
-- Name: challengesecret; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."challengesecret" (
    "challenge_id" "text" NOT NULL,
    "code_ciphertext" "text" NOT NULL,
    "code_key_version" "text" NOT NULL,
    "destination_ciphertext" "text" NOT NULL,
    "destination_key_version" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL
);


--
-- Name: credential; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."credential" (
    "id" "text" NOT NULL,
    "principal_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "subject_hash" character(64) NOT NULL,
    "subject_ciphertext" "text",
    "subject_key_version" "text",
    "secret_hash" "text",
    "encrypted_secret" "text",
    "status" "text" NOT NULL,
    "rotated_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "credential_check" CHECK ((("subject_ciphertext" IS NULL) = ("subject_key_version" IS NULL))),
    CONSTRAINT "credential_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text"])))
);


--
-- Name: federatedidentity; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."federatedidentity" (
    "id" "text" NOT NULL,
    "principal_id" "text",
    "membership_id" "text",
    "provider" "text" NOT NULL,
    "subject_ciphertext" "text" NOT NULL,
    "subject_key_version" "text" NOT NULL,
    "status" "text" NOT NULL,
    "bound_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "provider_instance_id" "uuid" NOT NULL,
    "provider_tenant_hash" "bytea" NOT NULL,
    "normalized_subject_hash" "bytea" NOT NULL,
    "linked_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "source" "text" DEFAULT 'migration'::"text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "federatedidentity_check" CHECK (((("status" = 'unbound'::"text") AND ("principal_id" IS NULL) AND ("membership_id" IS NULL) AND ("bound_at" IS NULL)) OR (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text"])) AND ("principal_id" IS NOT NULL) AND ("membership_id" IS NOT NULL) AND ("bound_at" IS NOT NULL)))),
    CONSTRAINT "federatedidentity_check1" CHECK ((("status" = 'revoked'::"text") = ("revoked_at" IS NOT NULL))),
    CONSTRAINT "federatedidentity_source_check" CHECK (("source" = ANY (ARRAY['login'::"text", 'directory'::"text", 'manual'::"text", 'migration'::"text"]))),
    CONSTRAINT "federatedidentity_status_check" CHECK (("status" = ANY (ARRAY['unbound'::"text", 'active'::"text", 'revoked'::"text"]))),
    CONSTRAINT "federatedidentity_version_check" CHECK (("version" >= 0)),
    CONSTRAINT "identity_federated_normalized_subject" CHECK (("octet_length"("normalized_subject_hash") = 32)),
    CONSTRAINT "identity_federated_provider_tenant" CHECK (("octet_length"("provider_tenant_hash") = 32))
);


--
-- Name: federationtransaction; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."federationtransaction" (
    "id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "state_hash" "bytea" NOT NULL,
    "nonce_hash" "bytea" NOT NULL,
    "pkce_challenge" "text" NOT NULL,
    "verifier_ciphertext" "text" NOT NULL,
    "browser_hash" "bytea" NOT NULL,
    "return_target_hash" "bytea" NOT NULL,
    "return_target_ref" "text" NOT NULL,
    "target" "text" NOT NULL,
    "risk_hash" "bytea" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "auth_state_hash" character(64) NOT NULL,
    "auth_nonce_hash" character(64) NOT NULL,
    "auth_pkce_challenge" character(43) NOT NULL,
    "purpose" "text" NOT NULL,
    "link_principal_id" "text",
    "link_membership_id" "text",
    CONSTRAINT "federation_auth_nonce_hash_valid" CHECK (("auth_nonce_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "federation_auth_pkce_valid" CHECK (("auth_pkce_challenge" ~ '^[A-Za-z0-9_-]{43}$'::"text")),
    CONSTRAINT "federation_auth_state_hash_valid" CHECK (("auth_state_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "federation_link_binding_complete" CHECK (((("purpose" = 'signin'::"text") AND ("link_principal_id" IS NULL) AND ("link_membership_id" IS NULL)) OR (("purpose" = 'link'::"text") AND ("link_principal_id" IS NOT NULL) AND ("link_membership_id" IS NOT NULL)))),
    CONSTRAINT "federation_transaction_purpose_valid" CHECK (("purpose" = ANY (ARRAY['signin'::"text", 'link'::"text"]))),
    CONSTRAINT "federationtransaction_check" CHECK ((("expires_at" > "created_at") AND ("expires_at" <= ("created_at" + '00:10:00'::interval)))),
    CONSTRAINT "federationtransaction_check1" CHECK ((("consumed_at" IS NULL) OR ("consumed_at" >= "created_at"))),
    CONSTRAINT "federationtransaction_pkce_challenge_check" CHECK ((("length"("pkce_challenge") >= 43) AND ("length"("pkce_challenge") <= 128))),
    CONSTRAINT "federationtransaction_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'redirected'::"text", 'callbackreceived'::"text", 'verified'::"text", 'selectionrequired'::"text", 'linkrequired'::"text", 'completed'::"text", 'expired'::"text", 'rejected'::"text"]))),
    CONSTRAINT "federationtransaction_target_check" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text"]))),
    CONSTRAINT "federationtransaction_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."federationtransaction" FORCE ROW LEVEL SECURITY;


--
-- Name: invitation; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."invitation" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "target" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "membership_id" "text",
    "principal_id" "text",
    "recipient_hash" "bytea",
    "token_hash" "bytea" NOT NULL,
    "token_key_version" "text" NOT NULL,
    "issuer_membership_id" "text" NOT NULL,
    "issuer_access_version" bigint NOT NULL,
    "grant_digest" character(64) NOT NULL,
    "minimum_assurance" smallint NOT NULL,
    "max_uses" integer NOT NULL,
    "use_count" integer DEFAULT 0 NOT NULL,
    "not_before" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "policy_id" "text",
    "terms_hash" character(64),
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "text",
    "revoke_reason" "text",
    "version" bigint DEFAULT 1 NOT NULL,
    "created_by" "text" NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "invitation_active_capacity_valid" CHECK ((("status" <> 'active'::"text") OR ("use_count" < "max_uses"))),
    CONSTRAINT "invitation_check" CHECK (("use_count" <= "max_uses")),
    CONSTRAINT "invitation_check1" CHECK ((("expires_at" > "not_before") AND ("expires_at" <= ("created_at" + '90 days'::interval)))),
    CONSTRAINT "invitation_check2" CHECK (((("kind" = 'signin'::"text") AND ("membership_id" IS NOT NULL) AND ("principal_id" IS NOT NULL) AND ("max_uses" = 1) AND ("policy_id" IS NULL) AND ("terms_hash" IS NULL)) OR (("kind" = 'enrollment'::"text") AND ("membership_id" IS NOT NULL) AND ("principal_id" IS NULL) AND ("recipient_hash" IS NOT NULL) AND ("max_uses" = 1) AND ("policy_id" IS NOT NULL) AND ("terms_hash" IS NOT NULL)) OR (("kind" = 'campaign'::"text") AND ("membership_id" IS NULL) AND ("principal_id" IS NULL) AND ("target" = 'storefront'::"text") AND ("policy_id" IS NOT NULL) AND ("terms_hash" IS NOT NULL)))),
    CONSTRAINT "invitation_check3" CHECK ((("target" <> 'console'::"text") OR (("kind" = 'signin'::"text") AND ("recipient_hash" IS NOT NULL) AND ("max_uses" = 1) AND ("minimum_assurance" >= 2)))),
    CONSTRAINT "invitation_check4" CHECK ((("status" = 'revoked'::"text") = ("revoked_at" IS NOT NULL))),
    CONSTRAINT "invitation_check5" CHECK (((("revoked_at" IS NULL) AND ("revoked_by" IS NULL) AND ("revoke_reason" IS NULL)) OR (("revoked_at" IS NOT NULL) AND ("revoked_by" IS NOT NULL) AND (("length"(TRIM(BOTH FROM "revoke_reason")) >= 4) AND ("length"(TRIM(BOTH FROM "revoke_reason")) <= 1000))))),
    CONSTRAINT "invitation_exhausted_capacity_valid" CHECK ((("status" <> 'exhausted'::"text") OR ("use_count" = "max_uses"))),
    CONSTRAINT "invitation_grant_digest_check" CHECK (("grant_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "invitation_issuer_access_version_check" CHECK (("issuer_access_version" > 0)),
    CONSTRAINT "invitation_kind_check" CHECK (("kind" = ANY (ARRAY['signin'::"text", 'enrollment'::"text", 'campaign'::"text"]))),
    CONSTRAINT "invitation_max_uses_check" CHECK (("max_uses" > 0)),
    CONSTRAINT "invitation_minimum_assurance_check" CHECK ((("minimum_assurance" >= 1) AND ("minimum_assurance" <= 3))),
    CONSTRAINT "invitation_reason_check" CHECK ((("length"(TRIM(BOTH FROM "reason")) >= 4) AND ("length"(TRIM(BOTH FROM "reason")) <= 1000))),
    CONSTRAINT "invitation_status_valid" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'exhausted'::"text", 'revoked'::"text", 'expired'::"text"]))),
    CONSTRAINT "invitation_target_check" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text"]))),
    CONSTRAINT "invitation_token_hash_check" CHECK (("octet_length"("token_hash") = 32)),
    CONSTRAINT "invitation_token_key_version_check" CHECK ((("length"("token_key_version") >= 1) AND ("length"("token_key_version") <= 128))),
    CONSTRAINT "invitation_use_count_check" CHECK (("use_count" >= 0)),
    CONSTRAINT "invitation_version_valid" CHECK (("version" >= 1))
);

ALTER TABLE ONLY "identity"."invitation" FORCE ROW LEVEL SECURITY;


--
-- Name: invitationclaim; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."invitationclaim" (
    "id" "uuid" NOT NULL,
    "invitation_id" "text" NOT NULL,
    "browser_hash" "bytea" NOT NULL,
    "device_hash" "bytea" NOT NULL,
    "target" "text" NOT NULL,
    "recipient_hash" "bytea",
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "proof_method" "text",
    "proved_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "kind" "text" NOT NULL,
    CONSTRAINT "invitationclaim_browser_hash_check" CHECK (("octet_length"("browser_hash") = 32)),
    CONSTRAINT "invitationclaim_check" CHECK ((("expires_at" > "created_at") AND ("expires_at" <= ("created_at" + '00:10:00'::interval)))),
    CONSTRAINT "invitationclaim_device_hash_check" CHECK (("octet_length"("device_hash") = 32)),
    CONSTRAINT "invitationclaim_kind_valid" CHECK (("kind" = ANY (ARRAY['signin'::"text", 'enrollment'::"text", 'campaign'::"text"]))),
    CONSTRAINT "invitationclaim_lifecycle_valid" CHECK (((("state" = 'consumed'::"text") AND ("consumed_at" IS NOT NULL) AND ("proved_at" IS NOT NULL)) OR (("state" = 'proved'::"text") AND ("consumed_at" IS NULL) AND ("proved_at" IS NOT NULL)) OR (("state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text", 'expired'::"text", 'revoked'::"text"])) AND ("consumed_at" IS NULL)))),
    CONSTRAINT "invitationclaim_pending_proof_valid" CHECK ((("state" <> 'proofpending'::"text") OR ("proof_method" IS NOT NULL))),
    CONSTRAINT "invitationclaim_proof_valid" CHECK ((("proof_method" IS NULL) OR ("proof_method" = ANY (ARRAY['otp'::"text", 'sso'::"text", 'terms'::"text"])))),
    CONSTRAINT "invitationclaim_state_valid" CHECK (("state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text", 'proved'::"text", 'consumed'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "invitationclaim_target_check" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text"]))),
    CONSTRAINT "invitationclaim_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."invitationclaim" FORCE ROW LEVEL SECURITY;


--
-- Name: invitationreceipt; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."invitationreceipt" (
    "id" "uuid" NOT NULL,
    "invitation_id" "text" NOT NULL,
    "principal_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "session_id" "text",
    "assurance" smallint NOT NULL,
    "issuer_access_version" bigint NOT NULL,
    "grant_digest" character(64) NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "trace_id" "text" NOT NULL,
    CONSTRAINT "invitationreceipt_assurance_check" CHECK ((("assurance" >= 1) AND ("assurance" <= 3))),
    CONSTRAINT "invitationreceipt_grant_digest_check" CHECK (("grant_digest" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "invitationreceipt_issuer_access_version_check" CHECK (("issuer_access_version" > 0))
);

ALTER TABLE ONLY "identity"."invitationreceipt" FORCE ROW LEVEL SECURITY;


--
-- Name: linkcase; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."linkcase" (
    "id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "transaction_id" "uuid",
    "tenant_id" "uuid",
    "subject_hash" "bytea" NOT NULL,
    "candidate_principal_id" "text",
    "candidate_membership_id" "text",
    "reason" "text" NOT NULL,
    "evidence_ciphertext" "text",
    "status" "text" NOT NULL,
    "decision_by" "text",
    "checked_by" "text",
    "audit_id" "text",
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "decided_at" timestamp with time zone,
    "organization_id" "text",
    "reference_id" "text",
    "source" "text" DEFAULT 'federation'::"text" NOT NULL,
    CONSTRAINT "linkcase_check" CHECK (((("status" = 'open'::"text") AND ("decided_at" IS NULL)) OR (("status" <> 'open'::"text") AND ("decided_at" IS NOT NULL)))),
    CONSTRAINT "linkcase_check1" CHECK ((("checked_by" IS NULL) OR ("checked_by" <> "decision_by"))),
    CONSTRAINT "linkcase_reason_check" CHECK (("reason" = ANY (ARRAY['unlinked'::"text", 'ambiguous'::"text", 'principalconflict'::"text", 'tenantunknown'::"text", 'subjectconflict'::"text"]))),
    CONSTRAINT "linkcase_source_shape_valid" CHECK (((("source" = 'federation'::"text") AND ("provider_id" IS NOT NULL) AND ("tenant_id" IS NOT NULL) AND ("organization_id" IS NULL) AND ("reference_id" IS NULL)) OR (("source" = 'enrollment'::"text") AND ("provider_id" IS NULL) AND ("transaction_id" IS NULL) AND ("tenant_id" IS NULL) AND ("organization_id" IS NOT NULL) AND ("reference_id" IS NOT NULL) AND ("reason" = 'subjectconflict'::"text")))),
    CONSTRAINT "linkcase_source_valid" CHECK (("source" = ANY (ARRAY['federation'::"text", 'enrollment'::"text"]))),
    CONSTRAINT "linkcase_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'verified'::"text", 'rejected'::"text", 'expired'::"text"]))),
    CONSTRAINT "linkcase_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."linkcase" FORCE ROW LEVEL SECURITY;


--
-- Name: loginattempt; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."loginattempt" (
    "subject_hash" character(64) NOT NULL,
    "client_hash" character(64) NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "failures" integer NOT NULL,
    "locked_until" timestamp with time zone,
    CONSTRAINT "loginattempt_failures_check" CHECK (("failures" >= 0))
);


--
-- Name: preauth; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."preauth" (
    "id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "principal_id" "text",
    "token_hash" "bytea" NOT NULL,
    "candidate_hash" "bytea",
    "candidate_memberships" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "browser_hash" "bytea" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "purpose" "text" DEFAULT 'federationselection'::"text" NOT NULL,
    "target" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "device_hash" "bytea" NOT NULL,
    "state" "text" DEFAULT 'active'::"text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "auth_state_hash" character(64),
    "auth_nonce_hash" character(64),
    "auth_pkce_challenge" character(43),
    "assurance" smallint,
    CONSTRAINT "preauth_candidate_memberships_check" CHECK (("jsonb_typeof"("candidate_memberships") = 'array'::"text")),
    CONSTRAINT "preauth_check" CHECK ((("expires_at" > "created_at") AND ("expires_at" <= ("created_at" + '00:05:00'::interval)))),
    CONSTRAINT "preauth_check1" CHECK ((("consumed_at" IS NULL) OR ("consumed_at" >= "created_at"))),
    CONSTRAINT "preauth_consumption_state_valid" CHECK (((("state" = 'consumed'::"text") AND ("consumed_at" IS NOT NULL)) OR (("state" <> 'consumed'::"text") AND ("consumed_at" IS NULL)))),
    CONSTRAINT "preauth_purpose_shape_valid" CHECK (((("purpose" = 'federationselection'::"text") AND ("principal_id" IS NOT NULL) AND ("candidate_hash" IS NOT NULL) AND (
CASE
    WHEN ("jsonb_typeof"("candidate_memberships") = 'array'::"text") THEN "jsonb_array_length"("candidate_memberships")
    ELSE '-1'::integer
END >= 2) AND ("auth_state_hash" ~ '^[0-9a-f]{64}$'::"text") AND ("auth_nonce_hash" ~ '^[0-9a-f]{64}$'::"text") AND ("auth_pkce_challenge" ~ '^[A-Za-z0-9_-]{43}$'::"text") AND (("assurance" >= 1) AND ("assurance" <= 3))) OR (("purpose" = 'invitationproof'::"text") AND ("target" = 'console'::"text") AND ("transaction_id" IS NULL) AND ("principal_id" IS NOT NULL) AND ("candidate_hash" IS NULL) AND ("candidate_memberships" = '[]'::"jsonb") AND ("auth_state_hash" IS NULL) AND ("auth_nonce_hash" IS NULL) AND ("auth_pkce_challenge" IS NULL) AND ("assurance" IS NULL)) OR (("purpose" = 'enrollment'::"text") AND ("target" = 'storefront'::"text") AND ("transaction_id" IS NULL) AND ("candidate_hash" IS NULL) AND ("candidate_memberships" = '[]'::"jsonb") AND ("auth_state_hash" IS NULL) AND ("auth_nonce_hash" IS NULL) AND ("auth_pkce_challenge" IS NULL) AND ("assurance" IS NULL)))),
    CONSTRAINT "preauth_purpose_valid" CHECK (("purpose" = ANY (ARRAY['federationselection'::"text", 'invitationproof'::"text", 'enrollment'::"text"]))),
    CONSTRAINT "preauth_selection_shape_valid" CHECK ((("purpose" <> 'federationselection'::"text") OR (("principal_id" IS NOT NULL) AND ("candidate_hash" IS NOT NULL) AND ("jsonb_array_length"("candidate_memberships") >= 2) AND ("auth_state_hash" ~ '^[0-9a-f]{64}$'::"text") AND ("auth_nonce_hash" ~ '^[0-9a-f]{64}$'::"text") AND ("auth_pkce_challenge" ~ '^[A-Za-z0-9_-]{43}$'::"text") AND (("assurance" >= 1) AND ("assurance" <= 3))))),
    CONSTRAINT "preauth_state_valid" CHECK (("state" = ANY (ARRAY['active'::"text", 'consumed'::"text", 'revoked'::"text", 'expired'::"text"]))),
    CONSTRAINT "preauth_target_valid" CHECK (("target" = ANY (ARRAY['console'::"text", 'storefront'::"text"]))),
    CONSTRAINT "preauth_version_valid" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."preauth" FORCE ROW LEVEL SECURITY;


--
-- Name: principal; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."principal" (
    "id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "credential_version" bigint DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "principal_credential_version_check" CHECK (("credential_version" > 0)),
    CONSTRAINT "principal_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'locked'::"text", 'disabled'::"text"]))),
    CONSTRAINT "principal_version_check" CHECK (("version" >= 0))
);


--
-- Name: provider; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."provider" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "provider_tenant_hash" "bytea" NOT NULL,
    "issuer_hash" "bytea",
    "client_id_hash" "bytea" NOT NULL,
    "secret_ref" "text" NOT NULL,
    "redirect_uri" "text" NOT NULL,
    "scopes" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "provider_redirect_uri_check" CHECK (("redirect_uri" ~ '^https://'::"text")),
    CONSTRAINT "provider_scopes_check" CHECK (("cardinality"("scopes") <= 32)),
    CONSTRAINT "provider_secret_ref_check" CHECK (("secret_ref" ~ '^[a-z][a-z0-9./]{2,127}$'::"text")),
    CONSTRAINT "provider_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'enabled'::"text", 'disabled'::"text", 'revoked'::"text"]))),
    CONSTRAINT "provider_type_check" CHECK (("type" = ANY (ARRAY['wechat'::"text", 'wecomcorp'::"text", 'wecomsuite'::"text", 'oidc'::"text"]))),
    CONSTRAINT "provider_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."provider" FORCE ROW LEVEL SECURITY;


--
-- Name: providerhealth; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."providerhealth" (
    "provider_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "latency_ms" integer NOT NULL,
    "error_code" "text",
    "checked_at" timestamp with time zone NOT NULL,
    "version" bigint NOT NULL,
    CONSTRAINT "providerhealth_latency_ms_check" CHECK ((("latency_ms" >= 0) AND ("latency_ms" <= 30000))),
    CONSTRAINT "providerhealth_status_check" CHECK (("status" = ANY (ARRAY['healthy'::"text", 'degraded'::"text", 'unavailable'::"text"]))),
    CONSTRAINT "providerhealth_version_check" CHECK (("version" > 0))
);

ALTER TABLE ONLY "identity"."providerhealth" FORCE ROW LEVEL SECURITY;


--
-- Name: providersecretrotation; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."providersecretrotation" (
    "id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "old_ref" "text" NOT NULL,
    "new_ref" "text" NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "activated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "providersecretrotation_check" CHECK (("old_ref" <> "new_ref")),
    CONSTRAINT "providersecretrotation_new_ref_check" CHECK (("new_ref" ~ '^[a-z][a-z0-9./]{2,127}$'::"text")),
    CONSTRAINT "providersecretrotation_old_ref_check" CHECK (("old_ref" ~ '^[a-z][a-z0-9./]{2,127}$'::"text")),
    CONSTRAINT "providersecretrotation_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'active'::"text", 'failed'::"text", 'retired'::"text"]))),
    CONSTRAINT "providersecretrotation_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "identity"."providersecretrotation" FORCE ROW LEVEL SECURITY;


--
-- Name: registrationpolicy; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."registrationpolicy" (
    "id" "text" NOT NULL,
    "version" integer NOT NULL,
    "terms_version" "text" NOT NULL,
    "terms_title" "text" NOT NULL,
    "terms_body" "text" NOT NULL,
    "privacy_title" "text" NOT NULL,
    "privacy_body" "text" NOT NULL,
    "terms_hash" character(64) NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "retired_at" timestamp with time zone,
    CONSTRAINT "registrationpolicy_version_check" CHECK (("version" > 0))
);


--
-- Name: session; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."session" (
    "id" "text" NOT NULL,
    "principal_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "token_hash" character(64) NOT NULL,
    "credential_version" bigint NOT NULL,
    "access_version" bigint NOT NULL,
    "client" "text" NOT NULL,
    "ip_hash" character(64) NOT NULL,
    "user_agent" "text" NOT NULL,
    "device_label" "text" NOT NULL,
    "assurance_level" smallint NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    "last_seen_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "session_assurance_level_check" CHECK ((("assurance_level" >= 0) AND ("assurance_level" <= 3))),
    CONSTRAINT "session_check" CHECK (("expires_at" > "created_at"))
);


--
-- Name: wechatgrant; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE "identity"."wechatgrant" (
    "id" "text" NOT NULL,
    "identity_id" "text" NOT NULL,
    "token_hash" character(64) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "wechatgrant_check" CHECK (("expires_at" > "created_at"))
);


--
-- Name: command; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."command" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "request" "jsonb" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "command_check" CHECK ((("response" IS NULL) = ("completed_at" IS NULL))),
    CONSTRAINT "command_operation_check" CHECK (("operation" = ANY (ARRAY['reserve'::"text", 'commit'::"text", 'release'::"text", 'expire'::"text", 'restock'::"text"]))),
    CONSTRAINT "command_request_check" CHECK (("jsonb_typeof"("request") = 'object'::"text"))
);


--
-- Name: cutoverreview; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."cutoverreview" (
    "id" "text" NOT NULL,
    "stockitem_id" "text" NOT NULL,
    "source_relation" "text" NOT NULL,
    "legacy_available" bigint NOT NULL,
    "legacy_reserved" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "state" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "captured_at" timestamp with time zone NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    CONSTRAINT "cutoverreview_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "cutoverreview_legacy_available_check" CHECK (("legacy_available" >= 0)),
    CONSTRAINT "cutoverreview_legacy_reserved_check" CHECK (("legacy_reserved" >= 0)),
    CONSTRAINT "cutoverreview_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: importerror; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."importerror" (
    "job_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "reason_code" "text" NOT NULL,
    "field" "text",
    "detail" "text" NOT NULL,
    CONSTRAINT "importerror_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: importjob; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."importjob" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "cursor_value" integer DEFAULT 0 NOT NULL,
    "success_count" integer DEFAULT 0 NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "report_object_ref" "text",
    "report_sha256" character(64),
    "report_size" bigint,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "importjob_check" CHECK (((("cursor_value" >= 0) AND ("cursor_value" <= "total_count")) AND (("success_count" + "failure_count") <= "cursor_value"))),
    CONSTRAINT "importjob_check1" CHECK (((("report_object_ref" IS NULL) AND ("report_sha256" IS NULL) AND ("report_size" IS NULL)) OR (("report_object_ref" IS NOT NULL) AND ("report_sha256" ~ '^[0-9a-f]{64}$'::"text") AND ("report_size" > 0)))),
    CONSTRAINT "importjob_failure_count_check" CHECK (("failure_count" >= 0)),
    CONSTRAINT "importjob_last_error_check" CHECK ((("last_error" IS NULL) OR ("length"("last_error") <= 500))),
    CONSTRAINT "importjob_sha256_check" CHECK (("sha256" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "importjob_state_check" CHECK (("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "importjob_success_count_check" CHECK (("success_count" >= 0)),
    CONSTRAINT "importjob_total_count_check" CHECK ((("total_count" >= 0) AND ("total_count" <= 100000))),
    CONSTRAINT "importjob_validation_summary_check" CHECK (("jsonb_typeof"("validation_summary") = 'object'::"text"))
);


--
-- Name: importrow; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."importrow" (
    "job_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "payload" "jsonb" NOT NULL,
    CONSTRAINT "importrow_payload_check" CHECK ((("jsonb_typeof"("payload") = 'object'::"text") AND ("pg_column_size"("payload") <= 65536))),
    CONSTRAINT "importrow_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: movement; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."movement" (
    "id" "text" NOT NULL,
    "stockitem_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "quantity_delta" bigint NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "movement_kind_check" CHECK (("kind" = ANY (ARRAY['receive'::"text", 'reserve'::"text", 'release'::"text", 'commit'::"text", 'adjust'::"text", 'return'::"text"]))),
    CONSTRAINT "movement_quantity_delta_check" CHECK (("quantity_delta" <> 0))
);


--
-- Name: observation; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."observation" (
    "id" "text" NOT NULL,
    "stockitem_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_reference" "text" NOT NULL,
    "observed_onhand" bigint,
    "observed_quantity" bigint,
    "disposition" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    CONSTRAINT "observation_check" CHECK (((("kind" = 'stock'::"text") AND ("observed_onhand" IS NOT NULL) AND ("observed_quantity" IS NULL)) OR (("kind" = 'return'::"text") AND ("observed_onhand" IS NULL) AND ("observed_quantity" IS NOT NULL)))),
    CONSTRAINT "observation_disposition_check" CHECK (("disposition" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "observation_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "observation_kind_check" CHECK (("kind" = ANY (ARRAY['stock'::"text", 'return'::"text"]))),
    CONSTRAINT "observation_observed_onhand_check" CHECK ((("observed_onhand" IS NULL) OR ("observed_onhand" >= 0))),
    CONSTRAINT "observation_observed_quantity_check" CHECK ((("observed_quantity" IS NULL) OR ("observed_quantity" > 0)))
);


--
-- Name: reservation; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."reservation" (
    "id" "text" NOT NULL,
    "stockitem_id" "text" NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "quantity" bigint NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "reservation_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "reservation_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'committed'::"text", 'released'::"text", 'expired'::"text"])))
);


--
-- Name: snapshot; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."snapshot" (
    "stockitem_id" "text" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "source" "text" NOT NULL,
    "onhand" bigint NOT NULL,
    "source_version" "text" NOT NULL,
    CONSTRAINT "snapshot_onhand_check" CHECK (("onhand" >= 0))
);


--
-- Name: stockitem; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."stockitem" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "sku_id" "text" NOT NULL,
    "location_id" "text" NOT NULL,
    "onhand" bigint NOT NULL,
    "safety" bigint DEFAULT 0 NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "stockitem_onhand_check" CHECK (("onhand" >= 0)),
    CONSTRAINT "stockitem_safety_check" CHECK (("safety" >= 0)),
    CONSTRAINT "stockitem_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'blocked'::"text", 'retired'::"text"]))),
    CONSTRAINT "stockitem_version_check" CHECK (("version" >= 0))
);


--
-- Name: syncstate; Type: TABLE; Schema: inventory; Owner: -
--

CREATE TABLE "inventory"."syncstate" (
    "scope_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_reference" "text" NOT NULL,
    "location_id" "text" NOT NULL,
    "cursor_value" "text",
    "state" "text" NOT NULL,
    "observed_count" bigint NOT NULL,
    "applied_count" bigint NOT NULL,
    "failed_count" bigint NOT NULL,
    "last_error" "text",
    "version" bigint NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "syncstate_applied_count_check" CHECK (("applied_count" >= 0)),
    CONSTRAINT "syncstate_check" CHECK ((("applied_count" + "failed_count") <= "observed_count")),
    CONSTRAINT "syncstate_failed_count_check" CHECK (("failed_count" >= 0)),
    CONSTRAINT "syncstate_observed_count_check" CHECK (("observed_count" >= 0)),
    CONSTRAINT "syncstate_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'partial'::"text", 'failed'::"text", 'dead'::"text"])))
);


--
-- Name: document; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."document" (
    "id" "text" NOT NULL,
    "request_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "issued_at" timestamp with time zone NOT NULL,
    "kind" "text" DEFAULT 'original'::"text" NOT NULL,
    "red_of_id" "text",
    CONSTRAINT "document_check" CHECK (((("kind" = 'original'::"text") AND ("red_of_id" IS NULL)) OR (("kind" = 'red'::"text") AND ("red_of_id" IS NOT NULL)))),
    CONSTRAINT "document_kind_check" CHECK (("kind" = ANY (ARRAY['original'::"text", 'red'::"text"])))
);


--
-- Name: line; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."line" (
    "request_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "description" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "tax_minor" bigint NOT NULL,
    "source_line_id" "text",
    CONSTRAINT "line_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "line_tax_minor_check" CHECK (("tax_minor" >= 0))
);


--
-- Name: profile; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."profile" (
    "id" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "title_ciphertext" "text" NOT NULL,
    "title_key_version" "text" NOT NULL,
    "taxid_ciphertext" "text" NOT NULL,
    "taxid_token" character(64) NOT NULL,
    "taxid_key_version" "text" NOT NULL,
    "address_ciphertext" "text",
    "address_key_version" "text",
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "profile_check" CHECK ((("address_ciphertext" IS NULL) = ("address_key_version" IS NULL))),
    CONSTRAINT "profile_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deleted'::"text"])))
);


--
-- Name: request; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."request" (
    "id" "text" NOT NULL,
    "profile_id" "text" NOT NULL,
    "settlement_id" "text",
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "state" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "requested_by" "text",
    "approved_by" "text",
    "reason" "text",
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_hash" character(64),
    "kind" "text" DEFAULT 'original'::"text" NOT NULL,
    "red_of_request_id" "text",
    CONSTRAINT "request_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "request_check" CHECK ((("approved_by" IS NULL) OR ("approved_by" <> "requested_by"))),
    CONSTRAINT "request_check1" CHECK (((("kind" = 'original'::"text") AND ("red_of_request_id" IS NULL)) OR (("kind" = 'red'::"text") AND ("red_of_request_id" IS NOT NULL)))),
    CONSTRAINT "request_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "request_kind_check" CHECK (("kind" = ANY (ARRAY['original'::"text", 'red'::"text"]))),
    CONSTRAINT "request_state_check" CHECK (("state" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'issuing'::"text", 'issued'::"text", 'rejected'::"text", 'cancelled'::"text", 'failed'::"text", 'red'::"text"])))
);


--
-- Name: requestline; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."requestline" (
    "id" "text" NOT NULL,
    "request_id" "text" NOT NULL,
    "settlement_line_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "tax_minor" bigint NOT NULL,
    "source_hash" character(64) NOT NULL,
    CONSTRAINT "requestline_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "requestline_kind_check" CHECK (("kind" = ANY (ARRAY['original'::"text", 'red'::"text"]))),
    CONSTRAINT "requestline_tax_minor_check" CHECK (("tax_minor" >= 0))
);


--
-- Name: requestprofile; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."requestprofile" (
    "request_id" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "title_ciphertext" "text" NOT NULL,
    "title_key_version" "text" NOT NULL,
    "taxid_ciphertext" "text" NOT NULL,
    "taxid_token" character(64) NOT NULL,
    "taxid_key_version" "text" NOT NULL,
    "address_ciphertext" "text",
    "address_key_version" "text",
    "profile_version" bigint NOT NULL,
    CONSTRAINT "requestprofile_check" CHECK ((("address_ciphertext" IS NULL) = ("address_key_version" IS NULL)))
);


--
-- Name: statusevent; Type: TABLE; Schema: invoice; Owner: -
--

CREATE TABLE "invoice"."statusevent" (
    "request_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text",
    "occurred_at" timestamp with time zone NOT NULL
);


--
-- Name: campaign; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE "marketing"."campaign" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "state" "text" NOT NULL,
    "budget_minor" bigint NOT NULL,
    "spent_minor" bigint DEFAULT 0 NOT NULL,
    "currency" character(3) NOT NULL,
    "rule" "jsonb" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "campaign_budget_minor_check" CHECK (("budget_minor" >= 0)),
    CONSTRAINT "campaign_check" CHECK ((("spent_minor" >= 0) AND ("spent_minor" <= "budget_minor"))),
    CONSTRAINT "campaign_check1" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at"))),
    CONSTRAINT "campaign_kind_check" CHECK (("kind" = ANY (ARRAY['discount'::"text", 'coupon'::"text", 'lottery'::"text", 'affiliate'::"text"]))),
    CONSTRAINT "campaign_rule_check" CHECK (("jsonb_typeof"("rule") = 'object'::"text")),
    CONSTRAINT "campaign_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


--
-- Name: redemption; Type: TABLE; Schema: marketing; Owner: -
--

CREATE TABLE "marketing"."redemption" (
    "id" "text" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "order_id" "text",
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "redemption_amount_minor_check" CHECK (("amount_minor" >= 0)),
    CONSTRAINT "redemption_state_check" CHECK (("state" = ANY (ARRAY['reserved'::"text", 'committed'::"text", 'released'::"text"])))
);


--
-- Name: importerror; Type: TABLE; Schema: member; Owner: -
--

CREATE TABLE "member"."importerror" (
    "job_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "reason_code" "text" NOT NULL,
    "field" "text",
    "detail" "text" NOT NULL,
    CONSTRAINT "importerror_row_number_check" CHECK (("row_number" > 0))
);


--
-- Name: importjob; Type: TABLE; Schema: member; Owner: -
--

CREATE TABLE "member"."importjob" (
    "id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "cursor_value" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "success_count" integer DEFAULT 0 NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "report_object_ref" "text",
    "report_sha256" character(64),
    "report_size" bigint,
    CONSTRAINT "importjob_failure_count_check" CHECK (("failure_count" >= 0)),
    CONSTRAINT "importjob_success_count_check" CHECK (("success_count" >= 0)),
    CONSTRAINT "importjob_total_count_check" CHECK (("total_count" >= 0)),
    CONSTRAINT "member_import_last_error" CHECK ((("last_error" IS NULL) OR ("length"("last_error") <= 500))),
    CONSTRAINT "member_import_progress" CHECK (((("total_count" >= 0) AND ("total_count" <= 100000)) AND (("cursor_value" >= 0) AND ("cursor_value" <= "total_count")) AND (("success_count" + "failure_count") <= "cursor_value") AND ("jsonb_typeof"("validation_summary") = 'object'::"text"))),
    CONSTRAINT "member_import_report" CHECK (((("report_object_ref" IS NULL) AND ("report_sha256" IS NULL) AND ("report_size" IS NULL)) OR (("report_object_ref" IS NOT NULL) AND ("report_sha256" ~ '^[0-9a-f]{64}$'::"text") AND ("report_size" > 0)))),
    CONSTRAINT "member_import_state" CHECK (("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: importrow; Type: TABLE; Schema: member; Owner: -
--

CREATE TABLE "member"."importrow" (
    "job_id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "payload" "jsonb" NOT NULL,
    CONSTRAINT "importrow_payload_check" CHECK ((("jsonb_typeof"("payload") = 'object'::"text") AND ("pg_column_size"("payload") <= 8192))),
    CONSTRAINT "importrow_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: profile; Type: TABLE; Schema: member; Owner: -
--

CREATE TABLE "member"."profile" (
    "id" "text" NOT NULL,
    "principal_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "mobile_ciphertext" "text",
    "mobile_token" character(64),
    "email_ciphertext" "text",
    "email_token" character(64),
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "mobile_masked" "text" DEFAULT '***'::"text" NOT NULL,
    CONSTRAINT "profile_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'disabled'::"text"])))
);


--
-- Name: announcement; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."announcement" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "audience" "jsonb" NOT NULL,
    "state" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "announcement_audience_check" CHECK ((("jsonb_typeof"("audience") = 'object'::"text") AND (("audience" ->> 'kind'::"text") = ANY (ARRAY['all'::"text", 'members'::"text"])))),
    CONSTRAINT "announcement_audience_check1" CHECK ((((("audience" ->> 'kind'::"text") = 'all'::"text") AND ("audience" = "jsonb_build_object"('kind', 'all'))) OR ((("audience" ->> 'kind'::"text") = 'members'::"text") AND ("jsonb_typeof"(("audience" -> 'members'::"text")) = 'array'::"text") AND (("jsonb_array_length"(("audience" -> 'members'::"text")) >= 1) AND ("jsonb_array_length"(("audience" -> 'members'::"text")) <= 1000))))),
    CONSTRAINT "announcement_body_check" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 20000))),
    CONSTRAINT "announcement_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "announcement_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'published'::"text", 'retired'::"text"]))),
    CONSTRAINT "announcement_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 500))),
    CONSTRAINT "announcement_version_check" CHECK (("version" >= 0))
);


--
-- Name: attempt; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."attempt" (
    "id" "text" NOT NULL,
    "dispatch_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text",
    "state" "text" NOT NULL,
    "error_code" "text",
    "attempted_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "member_id" "text"
)
PARTITION BY RANGE ("attempted_at");


--
-- Name: attemptdefault; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."attemptdefault" (
    "id" "text" NOT NULL,
    "dispatch_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_id" "text",
    "state" "text" NOT NULL,
    "error_code" "text",
    "attempted_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "member_id" "text"
);


--
-- Name: dispatch; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."dispatch" (
    "id" "text" NOT NULL,
    "template_id" "text" NOT NULL,
    "recipient_token" character(64) NOT NULL,
    "recipient_ciphertext" "text",
    "recipient_key_version" "text",
    "recipient_ref" "text",
    "payload" "jsonb" NOT NULL,
    "state" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "available_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "member_id" "text",
    "channel" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    CONSTRAINT "dispatch_check" CHECK ((("recipient_ciphertext" IS NOT NULL) <> ("recipient_ref" IS NOT NULL))),
    CONSTRAINT "dispatch_check1" CHECK ((("recipient_ciphertext" IS NULL) = ("recipient_key_version" IS NULL))),
    CONSTRAINT "dispatch_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "notification_dispatch_channel" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'email'::"text", 'wechat'::"text", 'inapp'::"text"])))
);


--
-- Name: endpoint; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."endpoint" (
    "member_id" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "address_ciphertext" "text" NOT NULL,
    "address_token" character(64) NOT NULL,
    "address_key_version" "text" NOT NULL,
    "consent_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "endpoint_channel_check" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'email'::"text", 'wechat'::"text"])))
);


--
-- Name: preference; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."preference" (
    "member_id" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "enabled" boolean NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authorization_state" "text" NOT NULL,
    "authorized_at" timestamp with time zone,
    CONSTRAINT "notification_preference_authorization" CHECK ((("authorization_state" = 'accepted'::"text") = ("authorized_at" IS NOT NULL))),
    CONSTRAINT "preference_authorization_state_check" CHECK (("authorization_state" = ANY (ARRAY['unknown'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


--
-- Name: template; Type: TABLE; Schema: notification; Owner: -
--

CREATE TABLE "notification"."template" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "version" integer NOT NULL,
    "variable_schema" "jsonb" NOT NULL,
    "provider_template" "text",
    "subject" "text",
    "body" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "template_channel_check" CHECK (("channel" = ANY (ARRAY['sms'::"text", 'email'::"text", 'wechat'::"text", 'inapp'::"text"]))),
    CONSTRAINT "template_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"]))),
    CONSTRAINT "template_variable_schema_check" CHECK (("jsonb_typeof"("variable_schema") = 'object'::"text")),
    CONSTRAINT "template_version_check" CHECK (("version" > 0))
);


--
-- Name: aftersale; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."aftersale" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "line_id" "text",
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "quantity" bigint,
    "amount_minor" bigint,
    "reason" "text" NOT NULL,
    "requested_by" "text",
    "requested_membership_id" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "aftersale_amount_minor_check" CHECK ((("amount_minor" IS NULL) OR ("amount_minor" >= 0))),
    CONSTRAINT "aftersale_kind_check" CHECK (("kind" = ANY (ARRAY['cancel'::"text", 'return'::"text", 'refund'::"text", 'exchange'::"text", 'claim'::"text"]))),
    CONSTRAINT "aftersale_quantity_check" CHECK ((("quantity" IS NULL) OR ("quantity" > 0))),
    CONSTRAINT "aftersale_state_check" CHECK (("state" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'processing'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


--
-- Name: line; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."line" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "sku_id" "text" NOT NULL,
    "listing_id" "text" NOT NULL,
    "title_snapshot" "text" NOT NULL,
    "quantity" bigint NOT NULL,
    "unit_minor" bigint NOT NULL,
    "total_minor" bigint NOT NULL,
    "qualification_evidence_id" "text",
    "provider" "text",
    "partner_id" "text",
    "discount_minor" bigint DEFAULT 0 NOT NULL,
    "payable_minor" bigint GENERATED ALWAYS AS (("total_minor" - "discount_minor")) STORED,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "line_check" CHECK (("total_minor" = ("unit_minor" * "quantity"))),
    CONSTRAINT "line_check1" CHECK ((("discount_minor" >= 0) AND ("discount_minor" <= "total_minor"))),
    CONSTRAINT "line_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "line_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "line_unit_minor_check" CHECK (("unit_minor" >= 0))
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: ordering; Owner: -
--

CREATE SEQUENCE "ordering"."order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orderrecord; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."orderrecord" (
    "id" "text" NOT NULL,
    "order_number" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "checkout_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "total_minor" bigint NOT NULL,
    "payment_state" "text" NOT NULL,
    "fulfillment_state" "text" NOT NULL,
    "aftersale_state" "text" NOT NULL,
    "lifecycle_state" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "address_snapshot" "jsonb" DEFAULT 'null'::"jsonb" NOT NULL,
    "invoice_snapshot" "jsonb" DEFAULT 'null'::"jsonb" NOT NULL,
    "delivery_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "experience_version" "text",
    CONSTRAINT "orderrecord_aftersale_state_check" CHECK (("aftersale_state" = ANY (ARRAY['none'::"text", 'requested'::"text", 'processing'::"text", 'resolved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "orderrecord_delivery_snapshot_check" CHECK (("jsonb_typeof"("delivery_snapshot") = 'object'::"text")),
    CONSTRAINT "orderrecord_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "orderrecord_fulfillment_state_check" CHECK (("fulfillment_state" = ANY (ARRAY['unallocated'::"text", 'allocated'::"text", 'processing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text", 'returned'::"text"]))),
    CONSTRAINT "orderrecord_lifecycle_state_check" CHECK (("lifecycle_state" = ANY (ARRAY['created'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text", 'closed'::"text"]))),
    CONSTRAINT "orderrecord_payment_state_check" CHECK (("payment_state" = ANY (ARRAY['unpaid'::"text", 'authorizing'::"text", 'paid'::"text", 'partially_refunded'::"text", 'refunded'::"text", 'failed'::"text"]))),
    CONSTRAINT "orderrecord_total_minor_check" CHECK (("total_minor" >= 0))
);


--
-- Name: reminder; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."reminder" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reminder_kind_check" CHECK (("kind" = 'fulfillment'::"text")),
    CONSTRAINT "reminder_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'delivered'::"text", 'failed'::"text"])))
);


--
-- Name: reviewaction; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."reviewaction" (
    "id" "text" NOT NULL,
    "aftersale_id" "text" NOT NULL,
    "previous_state" "text" NOT NULL,
    "next_state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "text",
    "actor_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "grant_evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reviewaction_grant_evidence_check" CHECK (("jsonb_typeof"("grant_evidence") = 'object'::"text"))
);


--
-- Name: stateevent; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."stateevent" (
    "order_id" "text" NOT NULL,
    "sequence" bigint NOT NULL,
    "dimension" "text" NOT NULL,
    "previous_state" "text",
    "next_state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL
);


--
-- Name: suborder; Type: TABLE; Schema: ordering; Owner: -
--

CREATE TABLE "ordering"."suborder" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "partner_id" "text",
    "provider" "text",
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL
);


--
-- Name: assignment; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."assignment" (
    "parent_id" "text" NOT NULL,
    "child_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "assignment_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "assignment_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'expired'::"text", 'terminated'::"text"])))
);


--
-- Name: change; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."change" (
    "id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "before_value" "jsonb" NOT NULL,
    "after_value" "jsonb" NOT NULL,
    "actor_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL
);


--
-- Name: directoryconnection; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."directoryconnection" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "organization_id" "text" NOT NULL,
    "provider_instance_id" "uuid" NOT NULL,
    "secret_ref" "text" NOT NULL,
    "cursor_ciphertext" "text",
    "successful_version" bigint DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_status" "text" NOT NULL,
    CONSTRAINT "directoryconnection_provider_status" CHECK (("provider_status" = ANY (ARRAY['draft'::"text", 'enabled'::"text", 'disabled'::"text", 'revoked'::"text"]))),
    CONSTRAINT "directoryconnection_provider_type" CHECK (("provider_type" = ANY (ARRAY['wecomcorp'::"text", 'wecomsuite'::"text"]))),
    CONSTRAINT "directoryconnection_secret_ref_check" CHECK (("secret_ref" ~ '^[a-z][a-z0-9./]{2,127}$'::"text")),
    CONSTRAINT "directoryconnection_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'enabled'::"text", 'paused'::"text", 'disabled'::"text", 'revoked'::"text"]))),
    CONSTRAINT "directoryconnection_successful_version_check" CHECK (("successful_version" >= 0)),
    CONSTRAINT "directoryconnection_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "organization"."directoryconnection" FORCE ROW LEVEL SECURITY;


--
-- Name: directoryinbox; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."directoryinbox" (
    "connection_id" "uuid" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "provider_version" bigint NOT NULL,
    "body_hash" character(64) NOT NULL,
    "envelope_ciphertext" "text",
    "state" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "directoryinbox_body_hash_check" CHECK (("body_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "directoryinbox_provider_version_check" CHECK (("provider_version" >= 0)),
    CONSTRAINT "directoryinbox_state_check" CHECK (("state" = ANY (ARRAY['received'::"text", 'processed'::"text", 'failed'::"text", 'stale'::"text"])))
);

ALTER TABLE ONLY "organization"."directoryinbox" FORCE ROW LEVEL SECURITY;


--
-- Name: directorymembership; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."directorymembership" (
    "id" "uuid" NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "organization_id" "text" NOT NULL,
    "membership_id" "text",
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "source_version" bigint NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "directorymembership_check" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at"))),
    CONSTRAINT "directorymembership_source_version_check" CHECK (("source_version" >= 0)),
    CONSTRAINT "directorymembership_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'pending'::"text", 'conflict'::"text"]))),
    CONSTRAINT "directorymembership_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "organization"."directorymembership" FORCE ROW LEVEL SECURITY;


--
-- Name: directorysubject; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."directorysubject" (
    "id" "uuid" NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "subject_hash" "bytea" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "attributes_ciphertext" "text",
    "source_version" bigint NOT NULL,
    "missing_count" smallint DEFAULT 0 NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "directorysubject_missing_count_check" CHECK ((("missing_count" >= 0) AND ("missing_count" <= 2))),
    CONSTRAINT "directorysubject_source_version_check" CHECK (("source_version" >= 0)),
    CONSTRAINT "directorysubject_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'deleted'::"text", 'conflict'::"text"]))),
    CONSTRAINT "directorysubject_type_check" CHECK (("type" = ANY (ARRAY['user'::"text", 'department'::"text"]))),
    CONSTRAINT "directorysubject_version_check" CHECK (("version" >= 0))
);

ALTER TABLE ONLY "organization"."directorysubject" FORCE ROW LEVEL SECURITY;


--
-- Name: organization; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."organization" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "parent_id" "text",
    "name" "text" NOT NULL,
    "timezone" "text" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "organization_check" CHECK ((("parent_id" IS NOT NULL) OR ("kind" = 'platform'::"text"))),
    CONSTRAINT "organization_kind_check" CHECK (("kind" = ANY (ARRAY['platform'::"text", 'distributor'::"text", 'tenant'::"text", 'enterprise'::"text", 'mall'::"text", 'department'::"text"]))),
    CONSTRAINT "organization_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "organization_version_check" CHECK (("version" >= 0))
);


--
-- Name: sourcebinding; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."sourcebinding" (
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "source_code" "text" NOT NULL
);


--
-- Name: syncrun; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."syncrun" (
    "id" "uuid" NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "provider_run_id" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "state" "text" NOT NULL,
    "cursor_ciphertext" "text",
    "checksum" character(64),
    "read_count" bigint DEFAULT 0 NOT NULL,
    "applied_count" bigint DEFAULT 0 NOT NULL,
    "conflict_count" bigint DEFAULT 0 NOT NULL,
    "ignored_count" bigint DEFAULT 0 NOT NULL,
    "error_summary" "text",
    "watermark" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "organization_syncrun_completed_checksum" CHECK ((("state" <> 'completed'::"text") OR ("checksum" IS NOT NULL))),
    CONSTRAINT "syncrun_applied_count_check" CHECK (("applied_count" >= 0)),
    CONSTRAINT "syncrun_check" CHECK (((("applied_count" + "conflict_count") + "ignored_count") <= "read_count")),
    CONSTRAINT "syncrun_conflict_count_check" CHECK (("conflict_count" >= 0)),
    CONSTRAINT "syncrun_ignored_count_check" CHECK (("ignored_count" >= 0)),
    CONSTRAINT "syncrun_mode_check" CHECK (("mode" = ANY (ARRAY['full'::"text", 'incremental'::"text", 'event'::"text", 'reconcile'::"text"]))),
    CONSTRAINT "syncrun_read_count_check" CHECK (("read_count" >= 0)),
    CONSTRAINT "syncrun_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "organization"."syncrun" FORCE ROW LEVEL SECURITY;


--
-- Name: unitclosure; Type: TABLE; Schema: organization; Owner: -
--

CREATE TABLE "organization"."unitclosure" (
    "ancestor_id" "text" NOT NULL,
    "descendant_id" "text" NOT NULL,
    "depth" integer NOT NULL,
    CONSTRAINT "unitclosure_check" CHECK ((("depth" = 0) = ("ancestor_id" = "descendant_id"))),
    CONSTRAINT "unitclosure_depth_check" CHECK (("depth" >= 0))
);


--
-- Name: agreement; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."agreement" (
    "id" "text" NOT NULL,
    "partner_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "contract_ref" "text" NOT NULL,
    "contract_hash" character(64) NOT NULL,
    "capabilities" "jsonb" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "status" "text" NOT NULL,
    CONSTRAINT "agreement_capabilities_check" CHECK (("jsonb_typeof"("capabilities") = 'array'::"text")),
    CONSTRAINT "agreement_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'expired'::"text", 'terminated'::"text"])))
);


--
-- Name: brand; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."brand" (
    "id" "text" NOT NULL,
    "owner_partner_id" "text",
    "code" "text" NOT NULL
);


--
-- Name: partner; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."partner" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "partner_kind_check" CHECK (("kind" = ANY (ARRAY['supplier'::"text", 'store'::"text", 'brand'::"text"]))),
    CONSTRAINT "partner_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'terminated'::"text"]))),
    CONSTRAINT "partner_version_check" CHECK (("version" >= 0))
);


--
-- Name: qualificationdocument; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."qualificationdocument" (
    "id" "text" NOT NULL,
    "partner_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "expires_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "status" "text" NOT NULL,
    CONSTRAINT "qualificationdocument_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'valid'::"text", 'rejected'::"text", 'expired'::"text"])))
);


--
-- Name: relationship; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."relationship" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "left_partner_id" "text" NOT NULL,
    "right_partner_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "relationship_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "relationship_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'expired'::"text", 'terminated'::"text"])))
);


--
-- Name: servicebinding; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."servicebinding" (
    "store_id" "text" NOT NULL,
    "organization_id" "text" NOT NULL,
    "service" "text" NOT NULL,
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "servicebinding_service_check" CHECK (("service" = ANY (ARRAY['fulfillment'::"text", 'verification'::"text", 'service'::"text"]))),
    CONSTRAINT "servicebinding_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: store; Type: TABLE; Schema: partner; Owner: -
--

CREATE TABLE "partner"."store" (
    "id" "text" NOT NULL,
    "mall_id" "text",
    "region_code" "text" NOT NULL,
    "address_ciphertext" "text",
    "address_token" character(64),
    "address_key_version" "text",
    "service_radius_meters" integer,
    CONSTRAINT "store_check" CHECK ((("address_ciphertext" IS NULL) = ("address_token" IS NULL))),
    CONSTRAINT "store_check1" CHECK ((("address_ciphertext" IS NULL) = ("address_key_version" IS NULL))),
    CONSTRAINT "store_service_radius_meters_check" CHECK ((("service_radius_meters" IS NULL) OR ("service_radius_meters" > 0)))
);


--
-- Name: allocation; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."allocation" (
    "payment_id" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    CONSTRAINT "allocation_amount_minor_check" CHECK (("amount_minor" > 0))
);


--
-- Name: attempt; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."attempt" (
    "id" "text" NOT NULL,
    "intent_id" "text" NOT NULL,
    "tender_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "external_transaction" "text",
    "state" "text" NOT NULL,
    "requested_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "payer_hash" character(64),
    "scene" "text",
    "application_hash" character(64),
    CONSTRAINT "attempt_application_hash_check" CHECK ((("application_hash" IS NULL) OR ("application_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "attempt_payer_hash_check" CHECK ((("payer_hash" IS NULL) OR ("payer_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "attempt_scene_check" CHECK (("scene" = ANY (ARRAY['miniapp'::"text", 'jsapi'::"text"]))),
    CONSTRAINT "attempt_state_check" CHECK (("state" = ANY (ARRAY['started'::"text", 'pending'::"text", 'succeeded'::"text", 'failed'::"text", 'unknown'::"text"]))),
    CONSTRAINT "payment_attempt_application_required" CHECK (((("scene" IS NOT NULL) AND ("application_hash" IS NOT NULL)) OR (("scene" IS NULL) AND ("application_hash" IS NULL) AND ("state" = ANY (ARRAY['succeeded'::"text", 'failed'::"text"])))))
);


--
-- Name: COLUMN "attempt"."scene"; Type: COMMENT; Schema: payment; Owner: -
--

COMMENT ON COLUMN "payment"."attempt"."scene" IS 'miniapp or Official Account JSAPI application used for the provider order';


--
-- Name: COLUMN "attempt"."application_hash"; Type: COMMENT; Schema: payment; Owner: -
--

COMMENT ON COLUMN "payment"."attempt"."application_hash" IS 'SHA-256 of the immutable WeChat AppID, never the AppID itself';


--
-- Name: capture; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."capture" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "completed_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "capture_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "capture_state_check" CHECK (("state" = 'succeeded'::"text"))
);


--
-- Name: deadletterreview; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."deadletterreview" (
    "id" "text" NOT NULL,
    "deadletter_id" "text" NOT NULL,
    "payment_id" "text",
    "refund_id" "text",
    "decision" "text",
    "evidence" "jsonb" NOT NULL,
    "reviewed_by" "text",
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "deadletterreview_decision_check" CHECK (("decision" = ANY (ARRAY['replay'::"text", 'ignore'::"text", 'repair'::"text"])))
);


--
-- Name: effect; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."effect" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "payment_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "state" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "available_at" timestamp with time zone NOT NULL,
    "attempts" integer NOT NULL,
    "error_code" "text",
    "completed_at" timestamp with time zone,
    "deadlettered_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "effect_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "effect_kind_check" CHECK (("kind" = ANY (ARRAY['accounting'::"text", 'fulfillment'::"text", 'notification'::"text"]))),
    CONSTRAINT "effect_payload_check" CHECK (("jsonb_typeof"("payload") = 'object'::"text")),
    CONSTRAINT "effect_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'succeeded'::"text", 'deadletter'::"text", 'ignored'::"text"])))
);


--
-- Name: intent; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."intent" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "provider_reference" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "intent_amount_minor_check" CHECK (("amount_minor" >= 0)),
    CONSTRAINT "intent_state_check" CHECK (("state" = ANY (ARRAY['created'::"text", 'authorizing'::"text", 'authorized'::"text", 'captured'::"text", 'failed'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


--
-- Name: intenttender; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."intenttender" (
    "intent_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "kind" "text" NOT NULL,
    "reference_id" "text",
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    CONSTRAINT "intenttender_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "intenttender_check" CHECK (((("kind" = 'wechat'::"text") AND ("reference_id" IS NULL)) OR (("kind" <> 'wechat'::"text") AND ("reference_id" IS NOT NULL)))),
    CONSTRAINT "intenttender_kind_check" CHECK (("kind" = ANY (ARRAY['wechat'::"text", 'benefit'::"text", 'voucher'::"text"]))),
    CONSTRAINT "intenttender_sequence_check" CHECK (("sequence" > 0)),
    CONSTRAINT "intenttender_state_check" CHECK (("state" = ANY (ARRAY['planned'::"text", 'held'::"text", 'captured'::"text", 'released'::"text"])))
);


--
-- Name: observation; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."observation" (
    "id" "text" NOT NULL,
    "attempt_id" "text" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "payload_hash" character(64) NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "observation_amount_minor_check" CHECK (("amount_minor" >= 0))
);


--
-- Name: payment; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."payment" (
    "id" "text" NOT NULL,
    "intent_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "captured_minor" bigint DEFAULT 0 NOT NULL,
    "refunded_minor" bigint DEFAULT 0 NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "payment_amount_minor_check" CHECK (("amount_minor" >= 0)),
    CONSTRAINT "payment_check" CHECK ((("captured_minor" >= 0) AND ("captured_minor" <= "amount_minor"))),
    CONSTRAINT "payment_check1" CHECK ((("refunded_minor" >= 0) AND ("refunded_minor" <= "captured_minor"))),
    CONSTRAINT "payment_state_check" CHECK (("state" = ANY (ARRAY['authorized'::"text", 'captured'::"text", 'partially_refunded'::"text", 'refunded'::"text", 'cancelled'::"text"])))
);


--
-- Name: prepay; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."prepay" (
    "intent_id" "text" NOT NULL,
    "parameters" "jsonb" NOT NULL,
    "provider_request_id" "text",
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "prepay_parameters_check" CHECK (("jsonb_typeof"("parameters") = 'object'::"text"))
);


--
-- Name: providerattempt; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."providerattempt" (
    "id" "text" NOT NULL,
    "refund_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "operation" "text" NOT NULL,
    "worker_id" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "provider_state" "text",
    "provider_reference" "text",
    "request_id" "text",
    "error_code" "text",
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "providerattempt_sequence_check" CHECK (("sequence" > 0))
);


--
-- Name: recoverycase; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."recoverycase" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "order_id" "text",
    "resource_type" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "state" "text" NOT NULL,
    "error_code" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "occurrence_count" integer NOT NULL,
    "opened_at" timestamp with time zone NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_request_id" "text",
    CONSTRAINT "recoverycase_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text")),
    CONSTRAINT "recoverycase_occurrence_count_check" CHECK (("occurrence_count" > 0)),
    CONSTRAINT "recoverycase_severity_check" CHECK (("severity" = ANY (ARRAY['high'::"text", 'critical'::"text"]))),
    CONSTRAINT "recoverycase_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


--
-- Name: recoveryrequest; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."recoveryrequest" (
    "id" "text" NOT NULL,
    "case_id" "text",
    "scope_id" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence_hash" character(64) NOT NULL,
    "trace_id" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL
);


--
-- Name: refund; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."refund" (
    "id" "text" NOT NULL,
    "payment_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_reference" "text" NOT NULL,
    "external_transaction" "text",
    "idempotency_key" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "aftersale_id" "text",
    CONSTRAINT "refund_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "refund_state_check" CHECK (("state" = ANY (ARRAY['requested'::"text", 'submitted'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: refundcommand; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."refundcommand" (
    "id" "text" NOT NULL,
    "refund_id" "text" NOT NULL,
    "aftersale_id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "attempt_id" "text" NOT NULL,
    "external_refund_number" "text" NOT NULL,
    "external_trade_number" "text" NOT NULL,
    "transaction_id" "text" NOT NULL,
    "payment_total_minor" bigint NOT NULL,
    "next_operation" "text" NOT NULL,
    "provider_state" "text",
    "provider_refund_id" "text",
    "provider_request_id" "text",
    "attempts" integer NOT NULL,
    "state" "text" NOT NULL,
    "available_at" timestamp with time zone NOT NULL,
    "error_code" "text",
    "completed_at" timestamp with time zone,
    "idempotency_key" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "refundcommand_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "refundcommand_next_operation_check" CHECK (("next_operation" = ANY (ARRAY['apply'::"text", 'query'::"text"]))),
    CONSTRAINT "refundcommand_payment_total_minor_check" CHECK (("payment_total_minor" > 0))
);


--
-- Name: refundreceipt; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."refundreceipt" (
    "id" "text" NOT NULL,
    "refund_id" "text" NOT NULL,
    "provider_attempt_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "provider_state" "text",
    "provider_reference" "text",
    "error_code" "text",
    "receipt_hash" character(64) NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL,
    CONSTRAINT "refundreceipt_outcome_check" CHECK (("outcome" = ANY (ARRAY['succeeded'::"text", 'unknown'::"text"]))),
    CONSTRAINT "refundreceipt_receipt_hash_check" CHECK (("receipt_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


--
-- Name: refundtender; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."refundtender" (
    "refund_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "kind" "text" NOT NULL,
    "reference_id" "text",
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "provider_reference" "text",
    CONSTRAINT "refundtender_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "refundtender_check" CHECK (((("kind" = 'wechat'::"text") AND ("reference_id" IS NULL)) OR (("kind" <> 'wechat'::"text") AND ("reference_id" IS NOT NULL)))),
    CONSTRAINT "refundtender_kind_check" CHECK (("kind" = ANY (ARRAY['wechat'::"text", 'benefit'::"text", 'voucher'::"text"]))),
    CONSTRAINT "refundtender_sequence_check" CHECK (("sequence" > 0)),
    CONSTRAINT "refundtender_state_check" CHECK (("state" = ANY (ARRAY['planned'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


--
-- Name: tender; Type: TABLE; Schema: payment; Owner: -
--

CREATE TABLE "payment"."tender" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "provider" "text",
    "currency" character(3) NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "tender_kind_check" CHECK (("kind" = ANY (ARRAY['wechat'::"text", 'benefit'::"text", 'voucher'::"text", 'external'::"text"]))),
    CONSTRAINT "tender_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: price; Type: TABLE; Schema: pricing; Owner: -
--

CREATE TABLE "pricing"."price" (
    "id" "text" NOT NULL,
    "book_id" "text" NOT NULL,
    "sku_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "compare_minor" bigint,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "price_amount_minor_check" CHECK (("amount_minor" >= 0)),
    CONSTRAINT "price_check" CHECK ((("compare_minor" IS NULL) OR ("compare_minor" >= "amount_minor")))
);


--
-- Name: pricebook; Type: TABLE; Schema: pricing; Owner: -
--

CREATE TABLE "pricing"."pricebook" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "pricebook_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"])))
);


--
-- Name: quote; Type: TABLE; Schema: pricing; Owner: -
--

CREATE TABLE "pricing"."quote" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "mall_id" "text" NOT NULL,
    "currency" character(3) NOT NULL,
    "subtotal_minor" bigint NOT NULL,
    "discount_minor" bigint NOT NULL,
    "payable_minor" bigint NOT NULL,
    "lines" "jsonb" NOT NULL,
    "evidence_hash" character(64) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "dependencies" "jsonb" NOT NULL,
    "signed_payload" "jsonb" NOT NULL,
    "signature" character(64) NOT NULL,
    CONSTRAINT "quote_check" CHECK ((("payable_minor" = ("subtotal_minor" - "discount_minor")) AND ("payable_minor" >= 0))),
    CONSTRAINT "quote_dependencies_check" CHECK (("jsonb_typeof"("dependencies") = 'object'::"text")),
    CONSTRAINT "quote_discount_minor_check" CHECK (("discount_minor" >= 0)),
    CONSTRAINT "quote_lines_check" CHECK (("jsonb_typeof"("lines") = 'array'::"text")),
    CONSTRAINT "quote_signature_check" CHECK (("signature" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "quote_signed_payload_check" CHECK (("jsonb_typeof"("signed_payload") = 'object'::"text")),
    CONSTRAINT "quote_subtotal_minor_check" CHECK (("subtotal_minor" >= 0))
);


--
-- Name: rule; Type: TABLE; Schema: pricing; Owner: -
--

CREATE TABLE "pricing"."rule" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "priority" integer NOT NULL,
    "kind" "text" NOT NULL,
    "condition" "jsonb" NOT NULL,
    "effect" "jsonb" NOT NULL,
    "version" integer NOT NULL,
    "status" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    CONSTRAINT "rule_condition_check" CHECK (("jsonb_typeof"("condition") = 'object'::"text")),
    CONSTRAINT "rule_effect_check" CHECK (("jsonb_typeof"("effect") = 'object'::"text")),
    CONSTRAINT "rule_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'retired'::"text"]))),
    CONSTRAINT "rule_version_check" CHECK (("version" > 0))
);


--
-- Name: changerequest; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."changerequest" (
    "id" "text" NOT NULL,
    "policy_id" "text",
    "target_kind" "text" NOT NULL,
    "target_id" "text",
    "proposed_version" integer NOT NULL,
    "state" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "decided_by" "text",
    "requested_at" timestamp with time zone NOT NULL,
    "decided_at" timestamp with time zone,
    "reason" "text" NOT NULL,
    "risk" "text" NOT NULL,
    "proposal" "jsonb" NOT NULL,
    "preview" "jsonb" NOT NULL,
    "decision_reason" "text",
    "applied_result" "jsonb",
    "idempotency_key" "text" NOT NULL,
    "request_hash" character(64) NOT NULL,
    CONSTRAINT "changerequest_preview_check" CHECK (("jsonb_typeof"("preview") = 'object'::"text")),
    CONSTRAINT "changerequest_proposal_check" CHECK (("jsonb_typeof"("proposal") = 'object'::"text")),
    CONSTRAINT "changerequest_risk_check" CHECK (("risk" = ANY (ARRAY['high'::"text", 'critical'::"text"]))),
    CONSTRAINT "changerequest_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text", 'applied'::"text"])))
);


--
-- Name: evidence; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."evidence" (
    "id" "text" NOT NULL,
    "member_id" "text" NOT NULL,
    "resource_id" "text" NOT NULL,
    "policy_id" "text" NOT NULL,
    "policy_version" integer NOT NULL,
    "decision" "text" NOT NULL,
    "facts" "jsonb" NOT NULL,
    "facts_hash" character(64) NOT NULL,
    "decided_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "evidence_decision_check" CHECK (("decision" = ANY (ARRAY['eligible'::"text", 'ineligible'::"text", 'review'::"text"])))
);


--
-- Name: policy; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."policy" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "active_version" integer,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "policy_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'retired'::"text"])))
);


--
-- Name: policyversion; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."policyversion" (
    "policy_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "rule" "jsonb" NOT NULL,
    "rule_hash" character(64) NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" "text" NOT NULL,
    CONSTRAINT "policyversion_rule_check" CHECK (("jsonb_typeof"("rule") = 'object'::"text")),
    CONSTRAINT "policyversion_version_check" CHECK (("version" > 0))
);


--
-- Name: profile; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."profile" (
    "member_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "city_code" "text",
    "city_name" "text",
    "attributes" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "version" bigint NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "profile_attributes_check" CHECK (("jsonb_typeof"("attributes") = 'object'::"text")),
    CONSTRAINT "profile_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "profile_version_check" CHECK (("version" > 0))
);


--
-- Name: purchaselimit; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."purchaselimit" (
    "policy_id" "text" NOT NULL,
    "policy_version" integer NOT NULL,
    "period" "text" NOT NULL,
    "quantity" bigint,
    "amount_minor" bigint,
    "currency" character(3),
    CONSTRAINT "purchaselimit_check" CHECK ((("quantity" IS NOT NULL) OR ("amount_minor" IS NOT NULL))),
    CONSTRAINT "purchaselimit_check1" CHECK ((("amount_minor" IS NULL) OR ("currency" IS NOT NULL))),
    CONSTRAINT "purchaselimit_period_check" CHECK (("period" = ANY (ARRAY['order'::"text", 'day'::"text", 'week'::"text", 'month'::"text", 'lifetime'::"text"])))
);


--
-- Name: resource; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."resource" (
    "policy_id" "text" NOT NULL,
    "policy_version" integer NOT NULL,
    "kind" "text" NOT NULL,
    "resource_id" "text" NOT NULL
);


--
-- Name: subject; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."subject" (
    "policy_id" "text" NOT NULL,
    "policy_version" integer NOT NULL,
    "kind" "text" NOT NULL,
    "selector" "jsonb" NOT NULL
);


--
-- Name: tag; Type: TABLE; Schema: qualification; Owner: -
--

CREATE TABLE "qualification"."tag" (
    "member_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "source" "text" NOT NULL,
    "effective_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL
);


--
-- Name: export; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."export" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "report" "text" NOT NULL,
    "filter" "jsonb" NOT NULL,
    "state" "text" NOT NULL,
    "object_ref" "text",
    "sha256" character(64),
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL,
    "authorization_snapshot" "jsonb" NOT NULL,
    "cursor" "text",
    "record_count" bigint NOT NULL,
    "object_size" bigint,
    "scan_state" "text",
    "started_at" timestamp with time zone,
    "generated_at" timestamp with time zone,
    "error_code" "text",
    CONSTRAINT "export_object_size_check" CHECK (("object_size" > 0)),
    CONSTRAINT "export_record_count_check" CHECK (("record_count" >= 0)),
    CONSTRAINT "export_scan_state_check" CHECK (("scan_state" = ANY (ARRAY['pending'::"text", 'clean'::"text", 'rejected'::"text"]))),
    CONSTRAINT "export_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'expired'::"text"]))),
    CONSTRAINT "reporting_export_authorization" CHECK ((("jsonb_typeof"("authorization_snapshot") = 'object'::"text") AND ("authorization_snapshot" ? 'scope'::"text"))),
    CONSTRAINT "reporting_export_filter" CHECK ((("jsonb_typeof"("filter") = 'object'::"text") AND ("pg_column_size"("filter") <= 16384))),
    CONSTRAINT "reporting_export_object" CHECK ((("state" = 'completed'::"text") = (("object_ref" IS NOT NULL) AND ("sha256" IS NOT NULL) AND ("object_size" IS NOT NULL) AND ("scan_state" = 'clean'::"text") AND ("generated_at" IS NOT NULL) AND ("expires_at" IS NOT NULL)))),
    CONSTRAINT "reporting_export_report" CHECK (("report" = ANY (ARRAY['metrics'::"text", 'orders'::"text", 'finance.statement'::"text"])))
);


--
-- Name: fact; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."fact" (
    "metric_id" "text" NOT NULL,
    "metric_version" integer NOT NULL,
    "scope_id" "text" NOT NULL,
    "dimensions" "jsonb" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "timezone" "text" NOT NULL,
    "value_numeric" numeric(30,6) NOT NULL,
    "currency" character(3),
    "watermark" timestamp with time zone NOT NULL,
    "projection_version" bigint NOT NULL
);


--
-- Name: financeprojection; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."financeprojection" (
    "statement_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "currency" character(3) NOT NULL,
    "opening_minor" bigint NOT NULL,
    "debit_minor" bigint NOT NULL,
    "credit_minor" bigint NOT NULL,
    "closing_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "watermark" timestamp with time zone NOT NULL,
    "projection_version" bigint NOT NULL
);


--
-- Name: metric; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."metric" (
    "id" "text" NOT NULL,
    "version" integer NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "definition_link" "text" NOT NULL,
    "dimensions" "jsonb" NOT NULL,
    CONSTRAINT "metric_dimensions_check" CHECK (("jsonb_typeof"("dimensions") = 'array'::"text")),
    CONSTRAINT "metric_version_check" CHECK (("version" > 0))
);


--
-- Name: orderprojection; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."orderprojection" (
    "order_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "order_number" "text" NOT NULL,
    "payment_state" "text" NOT NULL,
    "fulfillment_state" "text" NOT NULL,
    "aftersale_state" "text" NOT NULL,
    "lifecycle_state" "text" NOT NULL,
    "total_minor" bigint NOT NULL,
    "currency" character(3) NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "watermark" timestamp with time zone NOT NULL,
    "projection_version" bigint NOT NULL,
    CONSTRAINT "orderprojection_snapshot_check" CHECK (("jsonb_typeof"("snapshot") = 'object'::"text"))
);


--
-- Name: projectionevent; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."projectionevent" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_version" integer NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "projected_at" timestamp with time zone NOT NULL,
    CONSTRAINT "projectionevent_event_version_check" CHECK (("event_version" > 0))
);


--
-- Name: watermark; Type: TABLE; Schema: reporting; Owner: -
--

CREATE TABLE "reporting"."watermark" (
    "projection" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "version" bigint NOT NULL,
    "stale_after" interval DEFAULT '00:02:00'::interval NOT NULL,
    "advanced_at" timestamp with time zone NOT NULL,
    CONSTRAINT "reporting_watermark_event" CHECK ((("length"("event_id") >= 1) AND ("length"("event_id") <= 255))),
    CONSTRAINT "watermark_stale_after_check" CHECK ((("stale_after" >= '00:00:01'::interval) AND ("stale_after" <= '24:00:00'::interval))),
    CONSTRAINT "watermark_version_check" CHECK (("version" > 0))
);


--
-- Name: case; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."case" (
    "id" "text" NOT NULL,
    "decision_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "assigned_to" "text",
    "created_at" timestamp with time zone NOT NULL,
    "closed_at" timestamp with time zone,
    "scope_id" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "safe_reason" "text" NOT NULL,
    "reviewed_by" "text",
    "review_reason" "text",
    "review_evidence" "jsonb" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "resolution" "text",
    CONSTRAINT "case_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'reviewing'::"text", 'cleared'::"text", 'confirmed'::"text", 'closed'::"text"]))),
    CONSTRAINT "risk_case_outcome" CHECK (("outcome" = ANY (ARRAY['review'::"text", 'deny'::"text"]))),
    CONSTRAINT "risk_case_resolution" CHECK (("resolution" = ANY (ARRAY['cleared'::"text", 'confirmed'::"text"]))),
    CONSTRAINT "risk_case_resolution_state" CHECK ((("state" <> ALL (ARRAY['cleared'::"text", 'confirmed'::"text", 'closed'::"text"])) OR ("resolution" IS NOT NULL))),
    CONSTRAINT "risk_case_review_complete" CHECK (((("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL) AND ("review_reason" IS NULL)) OR (("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL) AND ("review_reason" IS NOT NULL)))),
    CONSTRAINT "risk_case_reviewevidence" CHECK ((("jsonb_typeof"("review_evidence") = 'object'::"text") AND ("pg_column_size"("review_evidence") <= 16384)))
);


--
-- Name: decision; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."decision" (
    "id" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "actor_id" "text",
    "resource_id" "text",
    "policy_id" "text" NOT NULL,
    "policy_version" integer NOT NULL,
    "outcome" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "decided_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "score" integer NOT NULL,
    "safe_reason" "text" NOT NULL,
    CONSTRAINT "decision_outcome_check" CHECK (("outcome" = ANY (ARRAY['allow'::"text", 'challenge'::"text", 'review'::"text", 'deny'::"text"]))),
    CONSTRAINT "risk_decision_evidence" CHECK ((("jsonb_typeof"("evidence") = 'object'::"text") AND ("pg_column_size"("evidence") <= 262144))),
    CONSTRAINT "risk_decision_reason" CHECK (("safe_reason" = ANY (ARRAY['policy'::"text", 'amount'::"text", 'velocity'::"text", 'signal'::"text", 'list'::"text"]))),
    CONSTRAINT "risk_decision_score" CHECK (("score" >= 0))
);


--
-- Name: listentry; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."listentry" (
    "id" "text" NOT NULL,
    "list_type" "text" NOT NULL,
    "token" character(64) NOT NULL,
    "reason" "text" NOT NULL,
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "scope_id" "text" NOT NULL
);


--
-- Name: policy; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."policy" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "active_version" integer,
    "status" "text" NOT NULL,
    "baseline_version" integer,
    "updated_at" timestamp with time zone NOT NULL,
    "next_version" integer NOT NULL,
    CONSTRAINT "policy_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'retired'::"text"]))),
    CONSTRAINT "risk_policy_nextversion" CHECK (("next_version" > 0))
);


--
-- Name: policyversion; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."policyversion" (
    "policy_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "rule" "jsonb" NOT NULL,
    "rule_hash" character(64) NOT NULL,
    "rollout_percent" integer NOT NULL,
    "status" "text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    CONSTRAINT "risk_policyversion_rollout" CHECK ((("rollout_percent" >= 0) AND ("rollout_percent" <= 100))),
    CONSTRAINT "risk_policyversion_rule" CHECK ((("jsonb_typeof"("rule") = 'object'::"text") AND ("pg_column_size"("rule") <= 65536))),
    CONSTRAINT "risk_policyversion_status" CHECK (("status" = ANY (ARRAY['candidate'::"text", 'active'::"text", 'baseline'::"text", 'retired'::"text"])))
);


--
-- Name: replay; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."replay" (
    "policy_id" "text" NOT NULL,
    "candidate_version" integer NOT NULL,
    "state" "text" NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "changed_count" integer DEFAULT 0 NOT NULL,
    "outcome_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "false_positive_rate" numeric(9,8),
    "preview" "jsonb",
    CONSTRAINT "replay_changed_count_check" CHECK (("changed_count" >= 0)),
    CONSTRAINT "replay_outcome_counts_check" CHECK (("jsonb_typeof"("outcome_counts") = 'object'::"text")),
    CONSTRAINT "replay_sample_count_check" CHECK (("sample_count" >= 0)),
    CONSTRAINT "replay_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'passed'::"text", 'review'::"text", 'failed'::"text"]))),
    CONSTRAINT "risk_replay_falsepositive" CHECK ((("false_positive_rate" >= (0)::numeric) AND ("false_positive_rate" <= (1)::numeric))),
    CONSTRAINT "risk_replay_preview" CHECK ((("preview" IS NULL) OR (("jsonb_typeof"("preview") = 'object'::"text") AND ("pg_column_size"("preview") <= 65536))))
);


--
-- Name: signal; Type: TABLE; Schema: risk; Owner: -
--

CREATE TABLE "risk"."signal" (
    "id" "text" NOT NULL,
    "actor_id" "text",
    "scope_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "observed_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone
);


--
-- Name: contractcatalog; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."contractcatalog" (
    "artifact" "text" NOT NULL,
    "version" "text" NOT NULL,
    "checksum" character(64) NOT NULL,
    "operation_count" integer NOT NULL,
    "event_count" integer NOT NULL,
    "status" "text" NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    CONSTRAINT "contractcatalog_checksum_check" CHECK (("checksum" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "contractcatalog_event_count_check" CHECK (("event_count" > 0)),
    CONSTRAINT "contractcatalog_operation_count_check" CHECK (("operation_count" > 0)),
    CONSTRAINT "contractcatalog_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'retired'::"text"])))
);


--
-- Name: deadletter; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."deadletter" (
    "id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "error_code" "text" NOT NULL,
    "attempts" integer NOT NULL,
    "failed_at" timestamp with time zone NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "deadletter_attempts_check" CHECK (("attempts" > 0))
);


--
-- Name: errorcontract; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."errorcontract" (
    "code" "text" NOT NULL,
    "status" smallint NOT NULL,
    "retryable" boolean NOT NULL,
    "audit" boolean NOT NULL,
    "client" "text" NOT NULL,
    "contract_version" "text" NOT NULL,
    CONSTRAINT "errorcontract_client_check" CHECK (("client" = ANY (ARRAY['message'::"text", 'retry'::"text", 'hidden'::"text"]))),
    CONSTRAINT "errorcontract_status_check" CHECK ((("status" >= 400) AND ("status" <= 599)))
);

ALTER TABLE ONLY "runtime"."errorcontract" FORCE ROW LEVEL SECURITY;


--
-- Name: event; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."event" (
    "type" "text" NOT NULL,
    "version" integer NOT NULL,
    "owner" "text" NOT NULL,
    "schema_ref" "text" NOT NULL,
    CONSTRAINT "event_version_check" CHECK (("version" > 0))
);


--
-- Name: idempotency; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."idempotency" (
    "scope" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "key" "text" NOT NULL,
    "request_hash" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "operation" "text" NOT NULL,
    CONSTRAINT "idempotency_state_check" CHECK (("state" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "runtime_idempotency_operation" CHECK (("operation" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+)+$'::"text"))
);


--
-- Name: inbox; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."inbox" (
    "consumer" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_version" integer NOT NULL,
    "trace_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "received_at" timestamp with time zone NOT NULL,
    "processed_at" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "provider" "text" NOT NULL,
    "operation" "text" NOT NULL,
    CONSTRAINT "inbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "inbox_event_version_check" CHECK (("event_version" > 0)),
    CONSTRAINT "inbox_payload_check" CHECK (("jsonb_typeof"("payload") = 'object'::"text")),
    CONSTRAINT "runtime_inbox_operation" CHECK (("operation" ~ '^[a-z][a-z0-9:.-]{1,191}$'::"text")),
    CONSTRAINT "runtime_inbox_provider" CHECK (("provider" ~ '^[a-z][a-z0-9.-]{1,127}$'::"text"))
);


--
-- Name: jobdefinition; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."jobdefinition" (
    "kind" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "queue" "text" NOT NULL,
    "concurrency" integer NOT NULL,
    "timeout_ms" integer NOT NULL,
    "retry_attempts" integer NOT NULL,
    "lease_seconds" integer NOT NULL,
    "resource_lease" boolean NOT NULL,
    "dead_letter" "text" NOT NULL,
    "runbook" "text" NOT NULL,
    "version" bigint DEFAULT 1 NOT NULL,
    CONSTRAINT "jobdefinition_concurrency_check" CHECK ((("concurrency" >= 1) AND ("concurrency" <= 128))),
    CONSTRAINT "jobdefinition_dead_letter_check" CHECK (("dead_letter" = 'runtime.deadletter'::"text")),
    CONSTRAINT "jobdefinition_lease_seconds_check" CHECK ((("lease_seconds" >= 1) AND ("lease_seconds" <= 900))),
    CONSTRAINT "jobdefinition_retry_attempts_check" CHECK ((("retry_attempts" >= 1) AND ("retry_attempts" <= 32))),
    CONSTRAINT "jobdefinition_timeout_ms_check" CHECK ((("timeout_ms" >= 1000) AND ("timeout_ms" <= 600000))),
    CONSTRAINT "jobdefinition_version_check" CHECK (("version" > 0))
);

ALTER TABLE ONLY "runtime"."jobdefinition" FORCE ROW LEVEL SECURITY;


--
-- Name: lease; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."lease" (
    "resource" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "token" "text" NOT NULL,
    "acquired_at" timestamp with time zone NOT NULL,
    "deadline" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "lease_version_check" CHECK (("version" >= 0))
);


--
-- Name: migrationevidence; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."migrationevidence" (
    "migration" "text" NOT NULL,
    "source_rows" bigint NOT NULL,
    "target_rows" bigint NOT NULL,
    "source_minor" numeric(30,0) NOT NULL,
    "target_minor" numeric(30,0) NOT NULL,
    "concurrent_index_sql" "text" NOT NULL,
    "recovery_sql" "text" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "migrationevidence_check" CHECK (("source_rows" = "target_rows")),
    CONSTRAINT "migrationevidence_check1" CHECK (("source_minor" = "target_minor")),
    CONSTRAINT "migrationevidence_concurrent_index_sql_check" CHECK (("length"("concurrent_index_sql") > 0)),
    CONSTRAINT "migrationevidence_recovery_sql_check" CHECK (("length"("recovery_sql") > 0)),
    CONSTRAINT "migrationevidence_source_rows_check" CHECK (("source_rows" >= 0)),
    CONSTRAINT "migrationevidence_target_rows_check" CHECK (("target_rows" >= 0)),
    CONSTRAINT "runtime_migration_recovery_command" CHECK (("recovery_sql" ~ '^(select|begin;|update)'::"text"))
);


--
-- Name: operation; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."operation" (
    "id" "text" NOT NULL,
    "owner" "text" NOT NULL,
    "method" "text" NOT NULL,
    "path" "text" NOT NULL,
    "contract_version" "text" NOT NULL,
    CONSTRAINT "operation_id_check" CHECK (("id" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$'::"text")),
    CONSTRAINT "operation_method_check" CHECK (("method" = ANY (ARRAY['GET'::"text", 'POST'::"text", 'PUT'::"text", 'PATCH'::"text", 'DELETE'::"text"]))),
    CONSTRAINT "runtime_operation_contract_v3" CHECK (("contract_version" = '3.0.0'::"text"))
);


--
-- Name: outbox; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."outbox" (
    "id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_version" integer NOT NULL,
    "aggregate_type" "text" NOT NULL,
    "aggregate_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "available_at" timestamp with time zone NOT NULL,
    "claimed_by" "text",
    "claim_until" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "error_code" "text",
    "aggregate_version" bigint NOT NULL,
    "fencing_token" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "outbox_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "outbox_event_version_check" CHECK (("event_version" > 0)),
    CONSTRAINT "outbox_payload_check" CHECK (("jsonb_typeof"("payload") = 'object'::"text")),
    CONSTRAINT "runtime_outbox_aggregate_version" CHECK (("aggregate_version" > 0)),
    CONSTRAINT "runtime_outbox_fencing_token" CHECK (("fencing_token" >= 0))
);


--
-- Name: projectionoffset; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."projectionoffset" (
    "projection" "text" NOT NULL,
    "shard" "text" NOT NULL,
    "offset_value" "text" NOT NULL,
    "watermark" timestamp with time zone NOT NULL,
    "version" bigint NOT NULL,
    CONSTRAINT "projectionoffset_version_check" CHECK (("version" >= 0))
);


--
-- Name: rawenvelope; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."rawenvelope" (
    "provider" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "headers" "jsonb" NOT NULL,
    "payload" "text" NOT NULL,
    "trace_id" "text" NOT NULL,
    "received_at" timestamp with time zone NOT NULL,
    CONSTRAINT "rawenvelope_headers_check" CHECK (("jsonb_typeof"("headers") = 'object'::"text")),
    CONSTRAINT "rawenvelope_sha256_check" CHECK (("sha256" ~ '^[0-9a-f]{64}$'::"text"))
);


--
-- Name: reconciliationevidence; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."reconciliationevidence" (
    "id" "text" NOT NULL,
    "source_count" bigint NOT NULL,
    "target_count" bigint NOT NULL,
    "source_amount" bigint,
    "target_amount" bigint,
    "difference" bigint NOT NULL,
    "checked_at" timestamp with time zone NOT NULL
);


--
-- Name: reconciliationhash; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."reconciliationhash" (
    "id" "text" NOT NULL,
    "source_hash" character(64) NOT NULL,
    "target_hash" character(64) NOT NULL,
    "checked_at" timestamp with time zone NOT NULL
);


--
-- Name: schemaversion; Type: TABLE; Schema: runtime; Owner: -
--

CREATE TABLE "runtime"."schemaversion" (
    "version" "text" NOT NULL,
    "checksum" character(64) NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "schemaversion_checksum_check" CHECK (("checksum" ~ '^[0-9a-f]{64}$'::"text"))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE "supabase_migrations"."schema_migrations" (
    "version" "text" NOT NULL,
    "statements" "text"[],
    "name" "text"
);


--
-- Name: account; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."account" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "external_ref" "text" NOT NULL,
    "secret_ref" "text",
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "account_channel_check" CHECK (("channel" = ANY (ARRAY['inapp'::"text", 'wechat'::"text", 'email'::"text", 'sms'::"text"]))),
    CONSTRAINT "account_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


--
-- Name: agent; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."agent" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "skills" "jsonb" NOT NULL,
    "capacity" integer NOT NULL,
    "state" "text" NOT NULL,
    CONSTRAINT "agent_capacity_check" CHECK (("capacity" > 0)),
    CONSTRAINT "agent_skills_check" CHECK (("jsonb_typeof"("skills") = 'array'::"text")),
    CONSTRAINT "agent_state_check" CHECK (("state" = ANY (ARRAY['offline'::"text", 'available'::"text", 'busy'::"text", 'disabled'::"text"])))
);


--
-- Name: assignment; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."assignment" (
    "id" "text" NOT NULL,
    "ticket_id" "text" NOT NULL,
    "agent_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "assigned_at" timestamp with time zone NOT NULL,
    "released_at" timestamp with time zone,
    "scope_id" "text" NOT NULL
);


--
-- Name: assignmentrule; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."assignmentrule" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "skill" "text" NOT NULL,
    "priorities" "text"[] NOT NULL,
    "weight" integer NOT NULL,
    "state" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "assignmentrule_priorities_check" CHECK (("cardinality"("priorities") > 0)),
    CONSTRAINT "assignmentrule_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "assignmentrule_weight_check" CHECK ((("weight" >= 1) AND ("weight" <= 1000)))
);


--
-- Name: conversation; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."conversation" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "member_id" "text",
    "order_id" "text",
    "channel" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "text",
    "reference_evidence" "jsonb",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "conversation_channel_check" CHECK (("channel" = ANY (ARRAY['inapp'::"text", 'wechat'::"text", 'email'::"text", 'sms'::"text"]))),
    CONSTRAINT "conversation_check" CHECK (((("reference_type" IS NULL) AND ("reference_id" IS NULL) AND ("reference_evidence" IS NULL)) OR (("reference_type" IS NOT NULL) AND ("reference_id" IS NOT NULL) AND ("jsonb_typeof"("reference_evidence") = 'object'::"text")))),
    CONSTRAINT "conversation_reference_type_check" CHECK (("reference_type" = 'benefitlot'::"text"))
);


--
-- Name: escalation; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."escalation" (
    "id" "text" NOT NULL,
    "ticket_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "target" "text" NOT NULL,
    "state" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "resolved_at" timestamp with time zone,
    "scope_id" "text" NOT NULL,
    CONSTRAINT "escalation_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'accepted'::"text", 'resolved'::"text"])))
);


--
-- Name: evidence; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."evidence" (
    "id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "kind" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "state" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "conversation_id" "text" NOT NULL,
    CONSTRAINT "evidence_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760))),
    CONSTRAINT "evidence_state_check" CHECK (("state" = ANY (ARRAY['pending'::"text", 'clean'::"text", 'rejected'::"text"])))
);


--
-- Name: history; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."history" (
    "ticket_id" "text" NOT NULL,
    "sequence" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    CONSTRAINT "caseevent_evidence_check" CHECK (("jsonb_typeof"("evidence") = 'object'::"text"))
);


--
-- Name: message; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."message" (
    "id" "text" NOT NULL,
    "author_type" "text" NOT NULL,
    "author_id" "text",
    "body_ciphertext" "text" NOT NULL,
    "body_hash" character(64) NOT NULL,
    "body_key_version" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "scope_id" "text" NOT NULL,
    "conversation_id" "text" NOT NULL,
    CONSTRAINT "message_author_type_check" CHECK (("author_type" = ANY (ARRAY['member'::"text", 'agent'::"text", 'system'::"text"])))
);


--
-- Name: sla; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."sla" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "response_seconds" integer NOT NULL,
    "resolution_seconds" integer NOT NULL,
    "version" integer NOT NULL,
    CONSTRAINT "sla_resolution_seconds_check" CHECK (("resolution_seconds" > 0)),
    CONSTRAINT "sla_response_seconds_check" CHECK (("response_seconds" > 0)),
    CONSTRAINT "sla_version_check" CHECK (("version" > 0))
);


--
-- Name: ticket; Type: TABLE; Schema: support; Owner: -
--

CREATE TABLE "support"."ticket" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "state" "text" NOT NULL,
    "assigned_agent_id" "text",
    "response_due_at" timestamp with time zone NOT NULL,
    "resolution_due_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "conversation_id" "text" NOT NULL,
    "skill" "text" NOT NULL,
    CONSTRAINT "case_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "case_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'assigned'::"text", 'waiting'::"text", 'resolved'::"text", 'closed'::"text"])))
);


--
-- Name: attempt; Type: TABLE; Schema: verification; Owner: -
--

CREATE TABLE "verification"."attempt" (
    "id" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "nonce_hash" character(64) NOT NULL,
    "device_id" "text",
    "result" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "trace_id" "text" NOT NULL,
    "attempted_at" timestamp with time zone NOT NULL,
    CONSTRAINT "attempt_result_check" CHECK (("result" = ANY (ARRAY['accepted'::"text", 'rejected'::"text", 'replayed'::"text", 'expired'::"text"])))
);


--
-- Name: device; Type: TABLE; Schema: verification; Owner: -
--

CREATE TABLE "verification"."device" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "fingerprint_hash" character(64) NOT NULL,
    "public_key" "text",
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "device_status_check" CHECK (("status" = ANY (ARRAY['trusted'::"text", 'blocked'::"text", 'retired'::"text"])))
);


--
-- Name: nonce; Type: TABLE; Schema: verification; Owner: -
--

CREATE TABLE "verification"."nonce" (
    "session_id" "text" NOT NULL,
    "nonce_hash" character(64) NOT NULL,
    "issued_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone
);


--
-- Name: session; Type: TABLE; Schema: verification; Owner: -
--

CREATE TABLE "verification"."session" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "session_state_check" CHECK (("state" = ANY (ARRAY['issued'::"text", 'verified'::"text", 'expired'::"text", 'revoked'::"text", 'locked'::"text"])))
);


--
-- Name: allocation; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."allocation" (
    "id" "text" NOT NULL,
    "cardpool_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "allocation_check" CHECK ((("used_count" >= 0) AND ("used_count" <= "quantity"))),
    CONSTRAINT "allocation_quantity_check" CHECK (("quantity" > 0))
);


--
-- Name: approval; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."approval" (
    "id" "text" NOT NULL,
    "request_id" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "decision" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "text",
    "actor_id" "text" NOT NULL,
    "membership_id" "text" NOT NULL,
    "grant_evidence" "jsonb" NOT NULL,
    "trace_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    CONSTRAINT "approval_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "approval_grant_evidence_check" CHECK (("jsonb_typeof"("grant_evidence") = 'object'::"text")),
    CONSTRAINT "approval_sequence_check" CHECK (("sequence" > 0))
);


--
-- Name: card; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."card" (
    "id" "text" NOT NULL,
    "cardpool_id" "text" NOT NULL,
    "code_ciphertext" "text" NOT NULL,
    "code_fingerprint" character(64) NOT NULL,
    "code_key_version" "text" NOT NULL,
    "state" "text" NOT NULL,
    "allocated_batch_id" "text",
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "card_check" CHECK ((("state" = 'allocated'::"text") = ("allocated_batch_id" IS NOT NULL))),
    CONSTRAINT "card_code_fingerprint_check" CHECK (("code_fingerprint" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "card_state_check" CHECK (("state" = ANY (ARRAY['available'::"text", 'allocated'::"text", 'void'::"text"])))
);


--
-- Name: cardpool; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."cardpool" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "code_prefix" "text" NOT NULL,
    "next_sequence" bigint NOT NULL,
    "provider" "text",
    "status" "text" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "mode" "text" DEFAULT 'generated'::"text" NOT NULL,
    CONSTRAINT "cardpool_mode_check" CHECK (("mode" = ANY (ARRAY['generated'::"text", 'imported'::"text"]))),
    CONSTRAINT "cardpool_next_sequence_check" CHECK (("next_sequence" > 0)),
    CONSTRAINT "cardpool_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'depleted'::"text", 'disabled'::"text"])))
);


--
-- Name: hold; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."hold" (
    "id" "text" NOT NULL,
    "voucher_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "reconciliation_reference" "text",
    "evidence" "jsonb" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "reconciled_at" timestamp with time zone,
    CONSTRAINT "hold_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "hold_check" CHECK (((("state" = 'open'::"text") AND ("reconciled_at" IS NULL)) OR (("state" = 'reconciled'::"text") AND ("reconciled_at" IS NOT NULL)))),
    CONSTRAINT "hold_state_check" CHECK (("state" = ANY (ARRAY['open'::"text", 'reconciled'::"text"])))
);


--
-- Name: importerror; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."importerror" (
    "job_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "reason_code" "text" NOT NULL,
    "detail" "text" NOT NULL,
    "field" "text",
    CONSTRAINT "importerror_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: importjob; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."importjob" (
    "id" "text" NOT NULL,
    "cardpool_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "object_ref" "text" NOT NULL,
    "sha256" character(64) NOT NULL,
    "state" "text" NOT NULL,
    "total_count" integer NOT NULL,
    "success_count" integer NOT NULL,
    "failure_count" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "cursor_value" integer DEFAULT 0 NOT NULL,
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_error" "text",
    "report_object_ref" "text",
    "report_sha256" character(64),
    "report_size" bigint,
    CONSTRAINT "importjob_failure_count_check" CHECK (("failure_count" >= 0)),
    CONSTRAINT "importjob_sha256_check" CHECK (("sha256" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "importjob_success_count_check" CHECK (("success_count" >= 0)),
    CONSTRAINT "importjob_total_count_check" CHECK (("total_count" >= 0)),
    CONSTRAINT "voucher_import_last_error" CHECK ((("last_error" IS NULL) OR ("length"("last_error") <= 500))),
    CONSTRAINT "voucher_import_progress" CHECK (((("total_count" >= 0) AND ("total_count" <= 100000)) AND (("cursor_value" >= 0) AND ("cursor_value" <= "total_count")) AND (("success_count" + "failure_count") <= "cursor_value") AND ("jsonb_typeof"("validation_summary") = 'object'::"text"))),
    CONSTRAINT "voucher_import_report" CHECK (((("report_object_ref" IS NULL) AND ("report_sha256" IS NULL) AND ("report_size" IS NULL)) OR (("report_object_ref" IS NOT NULL) AND ("report_sha256" ~ '^[0-9a-f]{64}$'::"text") AND ("report_size" > 0)))),
    CONSTRAINT "voucher_import_state" CHECK (("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: importrow; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."importrow" (
    "job_id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "row_number" integer NOT NULL,
    "code_ciphertext" "text",
    "code_fingerprint" character(64),
    "code_key_version" "text",
    "error_code" "text",
    CONSTRAINT "importrow_check" CHECK (((("error_code" IS NULL) AND ("code_ciphertext" IS NOT NULL) AND ("code_fingerprint" IS NOT NULL) AND ("code_key_version" IS NOT NULL)) OR (("error_code" IS NOT NULL) AND ("code_ciphertext" IS NULL) AND ("code_fingerprint" IS NULL) AND ("code_key_version" IS NULL)))),
    CONSTRAINT "importrow_code_fingerprint_check" CHECK (("code_fingerprint" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "importrow_row_number_check" CHECK (("row_number" > 1))
);


--
-- Name: issuebatch; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."issuebatch" (
    "id" "text" NOT NULL,
    "program_id" "text" NOT NULL,
    "cardpool_id" "text",
    "state" "text" NOT NULL,
    "requested_count" integer NOT NULL,
    "issued_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "reserve_request_id" "text",
    "program_version" bigint NOT NULL,
    CONSTRAINT "issuebatch_issued_count_check" CHECK (("issued_count" >= 0)),
    CONSTRAINT "issuebatch_requested_count_check" CHECK (("requested_count" > 0)),
    CONSTRAINT "issuebatch_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'approval'::"text", 'approved'::"text", 'issuing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: program; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."program" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "value_minor" bigint NOT NULL,
    "default_valid_days" integer NOT NULL,
    "currency" character(3) NOT NULL,
    "status" "text" NOT NULL,
    "approval_required" boolean NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "program_default_valid_days_check" CHECK ((("default_valid_days" >= 1) AND ("default_valid_days" <= 3650))),
    CONSTRAINT "program_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'retired'::"text"]))),
    CONSTRAINT "program_value_minor_check" CHECK (("value_minor" >= 0))
);


--
-- Name: programversion; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."programversion" (
    "program_id" "text" NOT NULL,
    "version" bigint NOT NULL,
    "value_minor" bigint NOT NULL,
    "default_valid_days" integer NOT NULL,
    "approval_required" boolean NOT NULL,
    "status" "text" NOT NULL,
    "changed_by" "text" NOT NULL,
    "changed_at" timestamp with time zone NOT NULL,
    CONSTRAINT "programversion_default_valid_days_check" CHECK ((("default_valid_days" >= 1) AND ("default_valid_days" <= 3650))),
    CONSTRAINT "programversion_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'retired'::"text"]))),
    CONSTRAINT "programversion_value_minor_check" CHECK (("value_minor" > 0)),
    CONSTRAINT "programversion_version_check" CHECK (("version" >= 0))
);


--
-- Name: redemption; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."redemption" (
    "id" "text" NOT NULL,
    "voucher_id" "text" NOT NULL,
    "verification_id" "text" NOT NULL,
    "order_id" "text",
    "amount_minor" bigint NOT NULL,
    "redeemed_at" timestamp with time zone NOT NULL,
    "reversed_at" timestamp with time zone,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "redemption_amount_minor_check" CHECK (("amount_minor" >= 0))
);


--
-- Name: reserve; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."reserve" (
    "id" "text" NOT NULL,
    "voucher_id" "text" NOT NULL,
    "owner_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "reserve_state_check" CHECK (("state" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'released'::"text", 'consumed'::"text"])))
);


--
-- Name: reserverequest; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."reserverequest" (
    "id" "text" NOT NULL,
    "request_number" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "program_id" "text" NOT NULL,
    "requested_count" integer NOT NULL,
    "requested_minor" bigint NOT NULL,
    "reason" "text" NOT NULL,
    "state" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "resolved_by" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "program_version" bigint NOT NULL,
    CONSTRAINT "reserverequest_requested_count_check" CHECK (("requested_count" > 0)),
    CONSTRAINT "reserverequest_requested_minor_check" CHECK (("requested_minor" > 0)),
    CONSTRAINT "reserverequest_state_check" CHECK (("state" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text", 'fulfilled'::"text"])))
);


--
-- Name: reversal; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."reversal" (
    "id" "text" NOT NULL,
    "redemption_id" "text" NOT NULL,
    "amount_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "evidence" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "reference_id" "text" NOT NULL,
    CONSTRAINT "reversal_amount_minor_check" CHECK (("amount_minor" > 0)),
    CONSTRAINT "reversal_state_check" CHECK (("state" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'reversed'::"text"])))
);


--
-- Name: statusbatch; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."statusbatch" (
    "id" "text" NOT NULL,
    "scope_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "reason" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "requested_count" integer NOT NULL,
    "succeeded_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "statusbatch_action_check" CHECK (("action" = ANY (ARRAY['activate'::"text", 'disable'::"text", 'extend'::"text", 'void'::"text"]))),
    CONSTRAINT "statusbatch_check" CHECK ((("action" = 'extend'::"text") = ("expires_at" IS NOT NULL))),
    CONSTRAINT "statusbatch_failed_count_check" CHECK (("failed_count" >= 0)),
    CONSTRAINT "statusbatch_requested_count_check" CHECK (("requested_count" > 0)),
    CONSTRAINT "statusbatch_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "statusbatch_succeeded_count_check" CHECK (("succeeded_count" >= 0))
);


--
-- Name: statusevent; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."statusevent" (
    "voucher_id" "text" NOT NULL,
    "sequence" bigint NOT NULL,
    "previous_state" "text",
    "next_state" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "actor_id" "text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL
);


--
-- Name: statusitem; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."statusitem" (
    "batch_id" "text" NOT NULL,
    "voucher_id" "text" NOT NULL,
    "state" "text" NOT NULL,
    "previous_state" "text",
    "next_state" "text",
    "error_code" "text",
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "statusitem_check" CHECK ((("state" = 'failed'::"text") = ("error_code" IS NOT NULL))),
    CONSTRAINT "statusitem_state_check" CHECK (("state" = ANY (ARRAY['queued'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


--
-- Name: voucher; Type: TABLE; Schema: voucher; Owner: -
--

CREATE TABLE "voucher"."voucher" (
    "id" "text" NOT NULL,
    "program_id" "text" NOT NULL,
    "batch_id" "text" NOT NULL,
    "member_id" "text",
    "code_ciphertext" "text" NOT NULL,
    "code_fingerprint" character(64) NOT NULL,
    "code_key_version" "text" NOT NULL,
    "initial_minor" bigint NOT NULL,
    "remaining_minor" bigint NOT NULL,
    "state" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "card_id" "text",
    "program_version" bigint NOT NULL,
    CONSTRAINT "voucher_check" CHECK ((("remaining_minor" >= 0) AND ("remaining_minor" <= "initial_minor"))),
    CONSTRAINT "voucher_initial_minor_check" CHECK (("initial_minor" > 0)),
    CONSTRAINT "voucher_state_check" CHECK (("state" = ANY (ARRAY['created'::"text", 'active'::"text", 'bound'::"text", 'reserved'::"text", 'disabled'::"text", 'redeemed'::"text", 'expired'::"text", 'void'::"text"])))
);


--
-- Name: recorddefault; Type: TABLE ATTACH; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."record" ATTACH PARTITION "audit"."recorddefault" DEFAULT;


--
-- Name: attemptdefault; Type: TABLE ATTACH; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."attempt" ATTACH PARTITION "notification"."attemptdefault" DEFAULT;


--
-- Name: actionproof actionproof_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_pkey" PRIMARY KEY ("id");


--
-- Name: actionproof actionproof_token_hash_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_token_hash_key" UNIQUE ("token_hash");


--
-- Name: decisionaudit decisionaudit_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."decisionaudit"
    ADD CONSTRAINT "decisionaudit_pkey" PRIMARY KEY ("id");


--
-- Name: membership membership_member_id_organization_id_client_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membership"
    ADD CONSTRAINT "membership_member_id_organization_id_client_key" UNIQUE ("member_id", "organization_id", "client");


--
-- Name: membership membership_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membership"
    ADD CONSTRAINT "membership_pkey" PRIMARY KEY ("id");


--
-- Name: membershipoverride membershipoverride_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membershipoverride"
    ADD CONSTRAINT "membershipoverride_pkey" PRIMARY KEY ("membership_id", "permission_id");


--
-- Name: membershiprole membershiprole_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membershiprole"
    ADD CONSTRAINT "membershiprole_pkey" PRIMARY KEY ("membership_id", "role_id", "effective_at");


--
-- Name: ownership ownership_membership_id_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."ownership"
    ADD CONSTRAINT "ownership_membership_id_key" UNIQUE ("membership_id");


--
-- Name: ownership ownership_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."ownership"
    ADD CONSTRAINT "ownership_pkey" PRIMARY KEY ("scope_id");


--
-- Name: ownership ownership_role_id_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."ownership"
    ADD CONSTRAINT "ownership_role_id_key" UNIQUE ("role_id");


--
-- Name: permission permission_code_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."permission"
    ADD CONSTRAINT "permission_code_key" UNIQUE ("code");


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."permission"
    ADD CONSTRAINT "permission_pkey" PRIMARY KEY ("id");


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."role"
    ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");


--
-- Name: role role_scope_id_name_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."role"
    ADD CONSTRAINT "role_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: rolepermission rolepermission_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."rolepermission"
    ADD CONSTRAINT "rolepermission_pkey" PRIMARY KEY ("role_id", "permission_id", "effect");


--
-- Name: scopegrant scopegrant_membership_id_scope_kind_scope_id_effect_effecti_key; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."scopegrant"
    ADD CONSTRAINT "scopegrant_membership_id_scope_kind_scope_id_effect_effecti_key" UNIQUE ("membership_id", "scope_kind", "scope_id", "effect", "effective_at");


--
-- Name: scopegrant scopegrant_pkey; Type: CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."scopegrant"
    ADD CONSTRAINT "scopegrant_pkey" PRIMARY KEY ("id");


--
-- Name: accessrecord accessrecord_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."accessrecord"
    ADD CONSTRAINT "accessrecord_pkey" PRIMARY KEY ("id");


--
-- Name: archiveitem archiveitem_archive_id_record_kind_record_id_key; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."archiveitem"
    ADD CONSTRAINT "archiveitem_archive_id_record_kind_record_id_key" UNIQUE ("archive_id", "record_kind", "record_id");


--
-- Name: archiveitem archiveitem_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."archiveitem"
    ADD CONSTRAINT "archiveitem_pkey" PRIMARY KEY ("record_kind", "record_id");


--
-- Name: archiveref archiveref_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."archiveref"
    ADD CONSTRAINT "archiveref_pkey" PRIMARY KEY ("id");


--
-- Name: archiveref audit_archive_identity; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."archiveref"
    ADD CONSTRAINT "audit_archive_identity" UNIQUE ("scope_id", "period_start", "period_end", "last_record_hash");


--
-- Name: record record_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."record"
    ADD CONSTRAINT "record_pkey" PRIMARY KEY ("id", "recorded_at");


--
-- Name: recorddefault recorddefault_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."recorddefault"
    ADD CONSTRAINT "recorddefault_pkey" PRIMARY KEY ("id", "recorded_at");


--
-- Name: retention retention_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."retention"
    ADD CONSTRAINT "retention_pkey" PRIMARY KEY ("scope_id");


--
-- Name: account account_finance_account_id_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."account"
    ADD CONSTRAINT "account_finance_account_id_key" UNIQUE ("finance_account_id");


--
-- Name: account account_member_id_scope_id_kind_currency_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."account"
    ADD CONSTRAINT "account_member_id_scope_id_kind_currency_key" UNIQUE ("member_id", "scope_id", "kind", "currency");


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."account"
    ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");


--
-- Name: action action_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."action"
    ADD CONSTRAINT "action_pkey" PRIMARY KEY ("id");


--
-- Name: budget budget_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."budget"
    ADD CONSTRAINT "budget_pkey" PRIMARY KEY ("id");


--
-- Name: budget budget_plan_id_period_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."budget"
    ADD CONSTRAINT "budget_plan_id_period_key" UNIQUE ("plan_id", "period");


--
-- Name: grantbatch grantbatch_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantbatch"
    ADD CONSTRAINT "grantbatch_pkey" PRIMARY KEY ("id");


--
-- Name: grantdecision grantdecision_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantdecision"
    ADD CONSTRAINT "grantdecision_pkey" PRIMARY KEY ("batch_id", "sequence");


--
-- Name: grantitem grantitem_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantitem"
    ADD CONSTRAINT "grantitem_pkey" PRIMARY KEY ("batch_id", "member_id");


--
-- Name: lot lot_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lot"
    ADD CONSTRAINT "lot_pkey" PRIMARY KEY ("id");


--
-- Name: lotmovement lotmovement_lot_id_kind_reference_type_reference_id_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lotmovement"
    ADD CONSTRAINT "lotmovement_lot_id_kind_reference_type_reference_id_key" UNIQUE ("lot_id", "kind", "reference_type", "reference_id");


--
-- Name: lotmovement lotmovement_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lotmovement"
    ADD CONSTRAINT "lotmovement_pkey" PRIMARY KEY ("id");


--
-- Name: plan plan_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."plan"
    ADD CONSTRAINT "plan_pkey" PRIMARY KEY ("id");


--
-- Name: plan plan_scope_id_name_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."plan"
    ADD CONSTRAINT "plan_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: planversion planversion_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."planversion"
    ADD CONSTRAINT "planversion_pkey" PRIMARY KEY ("plan_id", "version");


--
-- Name: reminder reminder_lot_id_kind_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reminder"
    ADD CONSTRAINT "reminder_lot_id_kind_key" UNIQUE ("lot_id", "kind");


--
-- Name: reminder reminder_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reminder"
    ADD CONSTRAINT "reminder_pkey" PRIMARY KEY ("id");


--
-- Name: reservation reservation_account_id_owner_id_key; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reservation"
    ADD CONSTRAINT "reservation_account_id_owner_id_key" UNIQUE ("account_id", "owner_id");


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reservation"
    ADD CONSTRAINT "reservation_pkey" PRIMARY KEY ("id");


--
-- Name: capability capability_kind_name_version_key; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."capability"
    ADD CONSTRAINT "capability_kind_name_version_key" UNIQUE ("kind", "name", "version");


--
-- Name: capability capability_pkey; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."capability"
    ADD CONSTRAINT "capability_pkey" PRIMARY KEY ("id");


--
-- Name: dependency dependency_pkey; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."dependency"
    ADD CONSTRAINT "dependency_pkey" PRIMARY KEY ("capability_id", "depends_on_id");


--
-- Name: entitlement entitlement_pkey; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."entitlement"
    ADD CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id");


--
-- Name: entitlement entitlement_scope_id_capability_id_effective_at_key; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."entitlement"
    ADD CONSTRAINT "entitlement_scope_id_capability_id_effective_at_key" UNIQUE ("scope_id", "capability_id", "effective_at");


--
-- Name: operation operation_capability_id_key; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."operation"
    ADD CONSTRAINT "operation_capability_id_key" UNIQUE ("capability_id");


--
-- Name: operation operation_pkey; Type: CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."operation"
    ADD CONSTRAINT "operation_pkey" PRIMARY KEY ("operation_id");


--
-- Name: cart cart_pkey; Type: CONSTRAINT; Schema: cart; Owner: -
--

ALTER TABLE ONLY "cart"."cart"
    ADD CONSTRAINT "cart_pkey" PRIMARY KEY ("id");


--
-- Name: item item_pkey; Type: CONSTRAINT; Schema: cart; Owner: -
--

ALTER TABLE ONLY "cart"."item"
    ADD CONSTRAINT "item_pkey" PRIMARY KEY ("cart_id", "listing_id");


--
-- Name: availabilitycity availabilitycity_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilitycity"
    ADD CONSTRAINT "availabilitycity_pkey" PRIMARY KEY ("zone_id", "code");


--
-- Name: availabilitycity availabilitycity_zone_id_city_key_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilitycity"
    ADD CONSTRAINT "availabilitycity_zone_id_city_key_key" UNIQUE ("zone_id", "city_key");


--
-- Name: availabilityitem availabilityitem_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilityitem"
    ADD CONSTRAINT "availabilityitem_pkey" PRIMARY KEY ("zone_id", "resource_type", "resource_id");


--
-- Name: availabilityzone availabilityzone_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilityzone"
    ADD CONSTRAINT "availabilityzone_pkey" PRIMARY KEY ("id");


--
-- Name: availabilityzone availabilityzone_scope_id_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilityzone"
    ADD CONSTRAINT "availabilityzone_scope_id_code_key" UNIQUE ("scope_id", "code");


--
-- Name: sourcelisting catalog_sourcelisting_scope_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sourcelisting"
    ADD CONSTRAINT "catalog_sourcelisting_scope_key" UNIQUE ("provider", "scope_id", "object_type", "external_id");


--
-- Name: category category_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."category"
    ADD CONSTRAINT "category_code_key" UNIQUE ("code");


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."category"
    ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");


--
-- Name: classificationrule classificationrule_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."classificationrule"
    ADD CONSTRAINT "classificationrule_pkey" PRIMARY KEY ("id");


--
-- Name: importerror importerror_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."importerror"
    ADD CONSTRAINT "importerror_pkey" PRIMARY KEY ("job_id", "row_number", "reason_code");


--
-- Name: importjob importjob_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."importjob"
    ADD CONSTRAINT "importjob_pkey" PRIMARY KEY ("id");


--
-- Name: importrow importrow_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."importrow"
    ADD CONSTRAINT "importrow_pkey" PRIMARY KEY ("job_id", "row_number");


--
-- Name: listing listing_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."listing"
    ADD CONSTRAINT "listing_pkey" PRIMARY KEY ("id");


--
-- Name: listing listing_scope_id_sku_id_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."listing"
    ADD CONSTRAINT "listing_scope_id_sku_id_key" UNIQUE ("scope_id", "sku_id");


--
-- Name: pool pool_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."pool"
    ADD CONSTRAINT "pool_pkey" PRIMARY KEY ("id");


--
-- Name: pool pool_scope_id_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."pool"
    ADD CONSTRAINT "pool_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: poolbinding poolbinding_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."poolbinding"
    ADD CONSTRAINT "poolbinding_pkey" PRIMARY KEY ("mall_id", "pool_id");


--
-- Name: poolitem poolitem_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."poolitem"
    ADD CONSTRAINT "poolitem_pkey" PRIMARY KEY ("pool_id", "sku_id");


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."product"
    ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");


--
-- Name: review review_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."review"
    ADD CONSTRAINT "review_pkey" PRIMARY KEY ("id");


--
-- Name: sku sku_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sku"
    ADD CONSTRAINT "sku_code_key" UNIQUE ("code");


--
-- Name: sku sku_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sku"
    ADD CONSTRAINT "sku_pkey" PRIMARY KEY ("id");


--
-- Name: sourcelisting sourcelisting_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sourcelisting"
    ADD CONSTRAINT "sourcelisting_pkey" PRIMARY KEY ("id");


--
-- Name: suppliercategory suppliercategory_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."suppliercategory"
    ADD CONSTRAINT "suppliercategory_pkey" PRIMARY KEY ("id");


--
-- Name: suppliercategory suppliercategory_supplier_id_source_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."suppliercategory"
    ADD CONSTRAINT "suppliercategory_supplier_id_source_name_key" UNIQUE ("supplier_id", "source_name");


--
-- Name: externalobject channel_externalobject_scope_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."externalobject"
    ADD CONSTRAINT "channel_externalobject_scope_key" UNIQUE ("provider", "scope_id", "objecttype", "externalid");


--
-- Name: sourcerecord channel_sourcerecord_scope_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."sourcerecord"
    ADD CONSTRAINT "channel_sourcerecord_scope_key" UNIQUE ("provider", "scope_id", "objecttype", "externalid", "sourceversion");


--
-- Name: connection connection_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."connection"
    ADD CONSTRAINT "connection_pkey" PRIMARY KEY ("id");


--
-- Name: distributor distributor_code_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."distributor"
    ADD CONSTRAINT "distributor_code_key" UNIQUE ("code");


--
-- Name: distributor distributor_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."distributor"
    ADD CONSTRAINT "distributor_pkey" PRIMARY KEY ("id");


--
-- Name: externalobject externalobject_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."externalobject"
    ADD CONSTRAINT "externalobject_pkey" PRIMARY KEY ("id");


--
-- Name: provideroperation provideroperation_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."provideroperation"
    ADD CONSTRAINT "provideroperation_pkey" PRIMARY KEY ("id");


--
-- Name: provideroperation provideroperation_provider_kind_external_reference_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."provideroperation"
    ADD CONSTRAINT "provideroperation_provider_kind_external_reference_key" UNIQUE ("provider", "kind", "external_reference");


--
-- Name: provideroperation provideroperation_provider_kind_idempotency_key_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."provideroperation"
    ADD CONSTRAINT "provideroperation_provider_kind_idempotency_key_key" UNIQUE ("provider", "kind", "idempotency_key");


--
-- Name: sourcerecord sourcerecord_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."sourcerecord"
    ADD CONSTRAINT "sourcerecord_pkey" PRIMARY KEY ("id");


--
-- Name: statement statement_connection_id_period_start_period_end_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."statement"
    ADD CONSTRAINT "statement_connection_id_period_start_period_end_key" UNIQUE ("connection_id", "period_start", "period_end");


--
-- Name: statement statement_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."statement"
    ADD CONSTRAINT "statement_pkey" PRIMARY KEY ("id");


--
-- Name: syncrun syncrun_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."syncrun"
    ADD CONSTRAINT "syncrun_pkey" PRIMARY KEY ("id");


--
-- Name: tenantbinding tenantbinding_distributor_id_tenant_id_effective_at_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."tenantbinding"
    ADD CONSTRAINT "tenantbinding_distributor_id_tenant_id_effective_at_key" UNIQUE ("distributor_id", "tenant_id", "effective_at");


--
-- Name: tenantbinding tenantbinding_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."tenantbinding"
    ADD CONSTRAINT "tenantbinding_pkey" PRIMARY KEY ("id");


--
-- Name: webhookinbox webhookinbox_connection_id_external_id_key; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."webhookinbox"
    ADD CONSTRAINT "webhookinbox_connection_id_external_id_key" UNIQUE ("connection_id", "external_id");


--
-- Name: webhookinbox webhookinbox_pkey; Type: CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."webhookinbox"
    ADD CONSTRAINT "webhookinbox_pkey" PRIMARY KEY ("id");


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: checkout; Owner: -
--

ALTER TABLE ONLY "checkout"."address"
    ADD CONSTRAINT "address_pkey" PRIMARY KEY ("id");


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: checkout; Owner: -
--

ALTER TABLE ONLY "checkout"."evidence"
    ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("checkout_id", "kind", "reference_id");


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: checkout; Owner: -
--

ALTER TABLE ONLY "checkout"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");


--
-- Name: application application_pkey; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."application"
    ADD CONSTRAINT "application_pkey" PRIMARY KEY ("id");


--
-- Name: application application_scope_id_name_key; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."application"
    ADD CONSTRAINT "application_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: binding binding_pkey; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."binding"
    ADD CONSTRAINT "binding_pkey" PRIMARY KEY ("application_id", "domain");


--
-- Name: application experience_application_scope_code_unique; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."application"
    ADD CONSTRAINT "experience_application_scope_code_unique" UNIQUE ("scope_id", "code");


--
-- Name: application experience_application_scope_slug_unique; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."application"
    ADD CONSTRAINT "experience_application_scope_slug_unique" UNIQUE ("scope_id", "public_slug");


--
-- Name: publication publication_application_id_content_hash_key; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_application_id_content_hash_key" UNIQUE ("application_id", "content_hash");


--
-- Name: publication publication_object_key_key; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_object_key_key" UNIQUE ("object_key");


--
-- Name: publication publication_pkey; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_pkey" PRIMARY KEY ("id");


--
-- Name: publication publication_release_id_key; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_release_id_key" UNIQUE ("release_id");


--
-- Name: release release_pkey; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."release"
    ADD CONSTRAINT "release_pkey" PRIMARY KEY ("id");


--
-- Name: version version_application_id_sequence_key; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."version"
    ADD CONSTRAINT "version_application_id_sequence_key" UNIQUE ("application_id", "sequence");


--
-- Name: version version_pkey; Type: CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."version"
    ADD CONSTRAINT "version_pkey" PRIMARY KEY ("id");


--
-- Name: activationhistory activationhistory_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."activationhistory"
    ADD CONSTRAINT "activationhistory_pkey" PRIMARY KEY ("installation_id", "sequence");


--
-- Name: contractversion contractversion_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."contractversion"
    ADD CONSTRAINT "contractversion_pkey" PRIMARY KEY ("extension_id", "contract_version");


--
-- Name: health health_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."health"
    ADD CONSTRAINT "health_pkey" PRIMARY KEY ("installation_id", "checked_at");


--
-- Name: installation installation_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."installation"
    ADD CONSTRAINT "installation_pkey" PRIMARY KEY ("id");


--
-- Name: manifest manifest_manifest_hash_key; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."manifest"
    ADD CONSTRAINT "manifest_manifest_hash_key" UNIQUE ("manifest_hash");


--
-- Name: manifest manifest_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."manifest"
    ADD CONSTRAINT "manifest_pkey" PRIMARY KEY ("id", "version");


--
-- Name: registry registry_installation_id_key; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."registry"
    ADD CONSTRAINT "registry_installation_id_key" UNIQUE ("installation_id");


--
-- Name: registry registry_pkey; Type: CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."registry"
    ADD CONSTRAINT "registry_pkey" PRIMARY KEY ("extension_id", "scope_id");


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."account"
    ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");


--
-- Name: account account_scope_id_code_currency_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."account"
    ADD CONSTRAINT "account_scope_id_code_currency_key" UNIQUE ("scope_id", "code", "currency");


--
-- Name: backfill backfill_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."backfill"
    ADD CONSTRAINT "backfill_pkey" PRIMARY KEY ("id");


--
-- Name: economicleg economicleg_journal_id_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."economicleg"
    ADD CONSTRAINT "economicleg_journal_id_key" UNIQUE ("journal_id");


--
-- Name: economicleg economicleg_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."economicleg"
    ADD CONSTRAINT "economicleg_pkey" PRIMARY KEY ("owner_event_id", "economic_leg_id");


--
-- Name: entry entry_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."entry"
    ADD CONSTRAINT "entry_pkey" PRIMARY KEY ("id");


--
-- Name: hold hold_account_id_owner_type_owner_id_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."hold"
    ADD CONSTRAINT "hold_account_id_owner_type_owner_id_key" UNIQUE ("account_id", "owner_type", "owner_id");


--
-- Name: hold hold_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."hold"
    ADD CONSTRAINT "hold_pkey" PRIMARY KEY ("id");


--
-- Name: journal journal_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."journal"
    ADD CONSTRAINT "journal_pkey" PRIMARY KEY ("id");


--
-- Name: journal journal_scope_id_reference_type_reference_id_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."journal"
    ADD CONSTRAINT "journal_scope_id_reference_type_reference_id_key" UNIQUE ("scope_id", "reference_type", "reference_id");


--
-- Name: period period_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."period"
    ADD CONSTRAINT "period_pkey" PRIMARY KEY ("scope_id", "period");


--
-- Name: periodclose periodclose_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."periodclose"
    ADD CONSTRAINT "periodclose_pkey" PRIMARY KEY ("id");


--
-- Name: periodclose periodclose_scope_id_period_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."periodclose"
    ADD CONSTRAINT "periodclose_scope_id_period_key" UNIQUE ("scope_id", "period");


--
-- Name: policy policy_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."policy"
    ADD CONSTRAINT "policy_pkey" PRIMARY KEY ("id");


--
-- Name: policy policy_scope_id_kind_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."policy"
    ADD CONSTRAINT "policy_scope_id_kind_key" UNIQUE ("scope_id", "kind");


--
-- Name: reconciliation reconciliation_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliation"
    ADD CONSTRAINT "reconciliation_pkey" PRIMARY KEY ("id");


--
-- Name: reconciliation reconciliation_provider_period_statement_hash_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliation"
    ADD CONSTRAINT "reconciliation_provider_period_statement_hash_key" UNIQUE ("provider", "period", "statement_hash");


--
-- Name: reconciliationitem reconciliationitem_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliationitem"
    ADD CONSTRAINT "reconciliationitem_pkey" PRIMARY KEY ("id");


--
-- Name: reconciliationitem reconciliationitem_statement_line_id_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliationitem"
    ADD CONSTRAINT "reconciliationitem_statement_line_id_key" UNIQUE ("statement_line_id");


--
-- Name: settlement settlement_partner_id_period_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlement"
    ADD CONSTRAINT "settlement_partner_id_period_key" UNIQUE ("partner_id", "period");


--
-- Name: settlement settlement_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlement"
    ADD CONSTRAINT "settlement_pkey" PRIMARY KEY ("id");


--
-- Name: settlementadjustment settlementadjustment_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementadjustment"
    ADD CONSTRAINT "settlementadjustment_pkey" PRIMARY KEY ("id");


--
-- Name: settlementline settlementline_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementline"
    ADD CONSTRAINT "settlementline_pkey" PRIMARY KEY ("id");


--
-- Name: settlementline settlementline_settlement_id_reconciliation_item_id_adjustm_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementline"
    ADD CONSTRAINT "settlementline_settlement_id_reconciliation_item_id_adjustm_key" UNIQUE ("settlement_id", "reconciliation_item_id", "adjustment_of");


--
-- Name: split split_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."split"
    ADD CONSTRAINT "split_pkey" PRIMARY KEY ("id");


--
-- Name: split split_settlement_id_beneficiary_type_beneficiary_id_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."split"
    ADD CONSTRAINT "split_settlement_id_beneficiary_type_beneficiary_id_key" UNIQUE ("settlement_id", "beneficiary_type", "beneficiary_id");


--
-- Name: statement statement_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statement"
    ADD CONSTRAINT "statement_pkey" PRIMARY KEY ("id");


--
-- Name: statement statement_scope_id_period_start_period_end_currency_state_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statement"
    ADD CONSTRAINT "statement_scope_id_period_start_period_end_currency_state_key" UNIQUE ("scope_id", "period_start", "period_end", "currency", "state");


--
-- Name: statementline statementline_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statementline"
    ADD CONSTRAINT "statementline_pkey" PRIMARY KEY ("id");


--
-- Name: statementline statementline_reconciliation_id_external_reference_kind_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statementline"
    ADD CONSTRAINT "statementline_reconciliation_id_external_reference_kind_key" UNIQUE ("reconciliation_id", "external_reference", "kind");


--
-- Name: statementline statementline_reconciliation_id_sequence_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statementline"
    ADD CONSTRAINT "statementline_reconciliation_id_sequence_key" UNIQUE ("reconciliation_id", "sequence");


--
-- Name: withdrawal withdrawal_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."withdrawal"
    ADD CONSTRAINT "withdrawal_pkey" PRIMARY KEY ("id");


--
-- Name: withdrawal withdrawal_settlement_id_destination_ref_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."withdrawal"
    ADD CONSTRAINT "withdrawal_settlement_id_destination_ref_key" UNIQUE ("settlement_id", "destination_ref");


--
-- Name: fulfillmentorder fulfillmentorder_pkey; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."fulfillmentorder"
    ADD CONSTRAINT "fulfillmentorder_pkey" PRIMARY KEY ("id");


--
-- Name: fulfillmentorder fulfillmentorder_provider_external_reference_key; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."fulfillmentorder"
    ADD CONSTRAINT "fulfillmentorder_provider_external_reference_key" UNIQUE ("provider", "external_reference");


--
-- Name: fulfillmentorder fulfillmentorder_source_effect_id_suborder_id_key; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."fulfillmentorder"
    ADD CONSTRAINT "fulfillmentorder_source_effect_id_suborder_id_key" UNIQUE ("source_effect_id", "suborder_id");


--
-- Name: line line_pkey; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."line"
    ADD CONSTRAINT "line_pkey" PRIMARY KEY ("fulfillment_id", "order_line_id");


--
-- Name: milestone milestone_fulfillment_id_kind_external_id_key; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."milestone"
    ADD CONSTRAINT "milestone_fulfillment_id_kind_external_id_key" UNIQUE ("fulfillment_id", "kind", "external_id");


--
-- Name: milestone milestone_pkey; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."milestone"
    ADD CONSTRAINT "milestone_pkey" PRIMARY KEY ("id");


--
-- Name: returnrecord returnrecord_pkey; Type: CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."returnrecord"
    ADD CONSTRAINT "returnrecord_pkey" PRIMARY KEY ("id");


--
-- Name: assurance assurance_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."assurance"
    ADD CONSTRAINT "assurance_pkey" PRIMARY KEY ("id");


--
-- Name: authticket authticket_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."authticket"
    ADD CONSTRAINT "authticket_pkey" PRIMARY KEY ("id");


--
-- Name: authticket authticket_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."authticket"
    ADD CONSTRAINT "authticket_token_hash_key" UNIQUE ("token_hash");


--
-- Name: challenge challenge_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challenge"
    ADD CONSTRAINT "challenge_pkey" PRIMARY KEY ("id");


--
-- Name: challengedelivery challengedelivery_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challengedelivery"
    ADD CONSTRAINT "challengedelivery_pkey" PRIMARY KEY ("challenge_id", "sequence");


--
-- Name: challengesecret challengesecret_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challengesecret"
    ADD CONSTRAINT "challengesecret_pkey" PRIMARY KEY ("challenge_id");


--
-- Name: credential credential_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."credential"
    ADD CONSTRAINT "credential_pkey" PRIMARY KEY ("id");


--
-- Name: credential credential_provider_subject_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."credential"
    ADD CONSTRAINT "credential_provider_subject_hash_key" UNIQUE ("provider", "subject_hash");


--
-- Name: federatedidentity federatedidentity_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federatedidentity"
    ADD CONSTRAINT "federatedidentity_pkey" PRIMARY KEY ("id");


--
-- Name: federationtransaction federationtransaction_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federationtransaction"
    ADD CONSTRAINT "federationtransaction_pkey" PRIMARY KEY ("id");


--
-- Name: federationtransaction federationtransaction_state_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federationtransaction"
    ADD CONSTRAINT "federationtransaction_state_hash_key" UNIQUE ("state_hash");


--
-- Name: provider identity_provider_directory_reference; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."provider"
    ADD CONSTRAINT "identity_provider_directory_reference" UNIQUE ("id", "tenant_id", "type", "secret_ref", "status");


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_pkey" PRIMARY KEY ("id");


--
-- Name: invitation invitation_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_token_hash_key" UNIQUE ("token_hash");


--
-- Name: invitationclaim invitationclaim_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationclaim"
    ADD CONSTRAINT "invitationclaim_pkey" PRIMARY KEY ("id");


--
-- Name: invitationreceipt invitationreceipt_invitation_id_session_id_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_invitation_id_session_id_key" UNIQUE ("invitation_id", "session_id");


--
-- Name: invitationreceipt invitationreceipt_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_pkey" PRIMARY KEY ("id");


--
-- Name: invitationreceipt invitationreceipt_session_id_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_session_id_key" UNIQUE ("session_id");


--
-- Name: linkcase linkcase_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."linkcase"
    ADD CONSTRAINT "linkcase_pkey" PRIMARY KEY ("id");


--
-- Name: loginattempt loginattempt_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."loginattempt"
    ADD CONSTRAINT "loginattempt_pkey" PRIMARY KEY ("subject_hash", "client_hash");


--
-- Name: preauth preauth_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."preauth"
    ADD CONSTRAINT "preauth_pkey" PRIMARY KEY ("id");


--
-- Name: preauth preauth_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."preauth"
    ADD CONSTRAINT "preauth_token_hash_key" UNIQUE ("token_hash");


--
-- Name: preauth preauth_transaction_id_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."preauth"
    ADD CONSTRAINT "preauth_transaction_id_key" UNIQUE ("transaction_id");


--
-- Name: principal principal_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."principal"
    ADD CONSTRAINT "principal_pkey" PRIMARY KEY ("id");


--
-- Name: provider provider_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."provider"
    ADD CONSTRAINT "provider_pkey" PRIMARY KEY ("id");


--
-- Name: providerhealth providerhealth_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."providerhealth"
    ADD CONSTRAINT "providerhealth_pkey" PRIMARY KEY ("provider_id");


--
-- Name: providersecretrotation providersecretrotation_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."providersecretrotation"
    ADD CONSTRAINT "providersecretrotation_pkey" PRIMARY KEY ("id");


--
-- Name: registrationpolicy registrationpolicy_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."registrationpolicy"
    ADD CONSTRAINT "registrationpolicy_pkey" PRIMARY KEY ("id");


--
-- Name: registrationpolicy registrationpolicy_version_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."registrationpolicy"
    ADD CONSTRAINT "registrationpolicy_version_key" UNIQUE ("version");


--
-- Name: session session_id_principal_id_membership_id_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."session"
    ADD CONSTRAINT "session_id_principal_id_membership_id_key" UNIQUE ("id", "principal_id", "membership_id");


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");


--
-- Name: session session_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."session"
    ADD CONSTRAINT "session_token_hash_key" UNIQUE ("token_hash");


--
-- Name: wechatgrant wechatgrant_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."wechatgrant"
    ADD CONSTRAINT "wechatgrant_pkey" PRIMARY KEY ("id");


--
-- Name: wechatgrant wechatgrant_token_hash_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."wechatgrant"
    ADD CONSTRAINT "wechatgrant_token_hash_key" UNIQUE ("token_hash");


--
-- Name: command command_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."command"
    ADD CONSTRAINT "command_pkey" PRIMARY KEY ("id");


--
-- Name: command command_scope_id_operation_idempotency_key_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."command"
    ADD CONSTRAINT "command_scope_id_operation_idempotency_key_key" UNIQUE ("scope_id", "operation", "idempotency_key");


--
-- Name: cutoverreview cutoverreview_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."cutoverreview"
    ADD CONSTRAINT "cutoverreview_pkey" PRIMARY KEY ("id");


--
-- Name: cutoverreview cutoverreview_stockitem_id_source_relation_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."cutoverreview"
    ADD CONSTRAINT "cutoverreview_stockitem_id_source_relation_key" UNIQUE ("stockitem_id", "source_relation");


--
-- Name: importerror importerror_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."importerror"
    ADD CONSTRAINT "importerror_pkey" PRIMARY KEY ("job_id", "row_number", "reason_code");


--
-- Name: importjob importjob_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."importjob"
    ADD CONSTRAINT "importjob_pkey" PRIMARY KEY ("id");


--
-- Name: importrow importrow_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."importrow"
    ADD CONSTRAINT "importrow_pkey" PRIMARY KEY ("job_id", "row_number");


--
-- Name: movement movement_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."movement"
    ADD CONSTRAINT "movement_pkey" PRIMARY KEY ("id");


--
-- Name: movement movement_stockitem_id_kind_reference_type_reference_id_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."movement"
    ADD CONSTRAINT "movement_stockitem_id_kind_reference_type_reference_id_key" UNIQUE ("stockitem_id", "kind", "reference_type", "reference_id");


--
-- Name: observation observation_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."observation"
    ADD CONSTRAINT "observation_pkey" PRIMARY KEY ("id");


--
-- Name: observation observation_stockitem_id_kind_source_source_reference_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."observation"
    ADD CONSTRAINT "observation_stockitem_id_kind_source_source_reference_key" UNIQUE ("stockitem_id", "kind", "source", "source_reference");


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."reservation"
    ADD CONSTRAINT "reservation_pkey" PRIMARY KEY ("id");


--
-- Name: reservation reservation_stockitem_id_owner_type_owner_id_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."reservation"
    ADD CONSTRAINT "reservation_stockitem_id_owner_type_owner_id_key" UNIQUE ("stockitem_id", "owner_type", "owner_id");


--
-- Name: snapshot snapshot_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."snapshot"
    ADD CONSTRAINT "snapshot_pkey" PRIMARY KEY ("stockitem_id", "observed_at", "source");


--
-- Name: stockitem stockitem_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."stockitem"
    ADD CONSTRAINT "stockitem_pkey" PRIMARY KEY ("id");


--
-- Name: stockitem stockitem_scope_id_sku_id_location_id_key; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."stockitem"
    ADD CONSTRAINT "stockitem_scope_id_sku_id_location_id_key" UNIQUE ("scope_id", "sku_id", "location_id");


--
-- Name: syncstate syncstate_pkey; Type: CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."syncstate"
    ADD CONSTRAINT "syncstate_pkey" PRIMARY KEY ("scope_id", "source", "source_reference", "location_id");


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."document"
    ADD CONSTRAINT "document_pkey" PRIMARY KEY ("id");


--
-- Name: document document_provider_external_id_key; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."document"
    ADD CONSTRAINT "document_provider_external_id_key" UNIQUE ("provider", "external_id");


--
-- Name: document document_request_id_key; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."document"
    ADD CONSTRAINT "document_request_id_key" UNIQUE ("request_id");


--
-- Name: line line_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."line"
    ADD CONSTRAINT "line_pkey" PRIMARY KEY ("request_id", "sequence");


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");


--
-- Name: request request_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."request"
    ADD CONSTRAINT "request_pkey" PRIMARY KEY ("id");


--
-- Name: requestline requestline_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestline"
    ADD CONSTRAINT "requestline_pkey" PRIMARY KEY ("id");


--
-- Name: requestline requestline_request_id_settlement_line_id_key; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestline"
    ADD CONSTRAINT "requestline_request_id_settlement_line_id_key" UNIQUE ("request_id", "settlement_line_id");


--
-- Name: requestprofile requestprofile_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestprofile"
    ADD CONSTRAINT "requestprofile_pkey" PRIMARY KEY ("request_id");


--
-- Name: statusevent statusevent_pkey; Type: CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."statusevent"
    ADD CONSTRAINT "statusevent_pkey" PRIMARY KEY ("request_id", "sequence");


--
-- Name: campaign campaign_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY "marketing"."campaign"
    ADD CONSTRAINT "campaign_pkey" PRIMARY KEY ("id");


--
-- Name: campaign campaign_scope_id_name_key; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY "marketing"."campaign"
    ADD CONSTRAINT "campaign_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: redemption redemption_campaign_id_member_id_idempotency_key_key; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY "marketing"."redemption"
    ADD CONSTRAINT "redemption_campaign_id_member_id_idempotency_key_key" UNIQUE ("campaign_id", "member_id", "idempotency_key");


--
-- Name: redemption redemption_pkey; Type: CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY "marketing"."redemption"
    ADD CONSTRAINT "redemption_pkey" PRIMARY KEY ("id");


--
-- Name: importerror importerror_pkey; Type: CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."importerror"
    ADD CONSTRAINT "importerror_pkey" PRIMARY KEY ("job_id", "row_number", "reason_code");


--
-- Name: importjob importjob_pkey; Type: CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."importjob"
    ADD CONSTRAINT "importjob_pkey" PRIMARY KEY ("id");


--
-- Name: importrow importrow_pkey; Type: CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."importrow"
    ADD CONSTRAINT "importrow_pkey" PRIMARY KEY ("job_id", "row_number");


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");


--
-- Name: profile profile_principal_id_key; Type: CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."profile"
    ADD CONSTRAINT "profile_principal_id_key" UNIQUE ("principal_id");


--
-- Name: announcement announcement_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."announcement"
    ADD CONSTRAINT "announcement_pkey" PRIMARY KEY ("id");


--
-- Name: announcement announcement_scope_id_id_key; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."announcement"
    ADD CONSTRAINT "announcement_scope_id_id_key" UNIQUE ("scope_id", "id");


--
-- Name: attempt attempt_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."attempt"
    ADD CONSTRAINT "attempt_pkey" PRIMARY KEY ("id", "attempted_at");


--
-- Name: attemptdefault attemptdefault_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."attemptdefault"
    ADD CONSTRAINT "attemptdefault_pkey" PRIMARY KEY ("id", "attempted_at");


--
-- Name: dispatch dispatch_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."dispatch"
    ADD CONSTRAINT "dispatch_pkey" PRIMARY KEY ("id");


--
-- Name: endpoint endpoint_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."endpoint"
    ADD CONSTRAINT "endpoint_pkey" PRIMARY KEY ("member_id", "channel");


--
-- Name: dispatch notification_dispatch_scope_idempotency; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."dispatch"
    ADD CONSTRAINT "notification_dispatch_scope_idempotency" UNIQUE ("scope_id", "idempotency_key");


--
-- Name: dispatch notification_dispatch_scope_identity; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."dispatch"
    ADD CONSTRAINT "notification_dispatch_scope_identity" UNIQUE ("scope_id", "id");


--
-- Name: template notification_template_scope_identity; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."template"
    ADD CONSTRAINT "notification_template_scope_identity" UNIQUE ("scope_id", "id", "channel");


--
-- Name: preference preference_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."preference"
    ADD CONSTRAINT "preference_pkey" PRIMARY KEY ("member_id", "channel", "event_type");


--
-- Name: template template_pkey; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."template"
    ADD CONSTRAINT "template_pkey" PRIMARY KEY ("id");


--
-- Name: template template_scope_id_channel_event_type_version_key; Type: CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."template"
    ADD CONSTRAINT "template_scope_id_channel_event_type_version_key" UNIQUE ("scope_id", "channel", "event_type", "version");


--
-- Name: aftersale aftersale_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."aftersale"
    ADD CONSTRAINT "aftersale_pkey" PRIMARY KEY ("id");


--
-- Name: line line_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."line"
    ADD CONSTRAINT "line_pkey" PRIMARY KEY ("id");


--
-- Name: orderrecord orderrecord_checkout_id_key; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."orderrecord"
    ADD CONSTRAINT "orderrecord_checkout_id_key" UNIQUE ("checkout_id");


--
-- Name: orderrecord orderrecord_order_number_key; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."orderrecord"
    ADD CONSTRAINT "orderrecord_order_number_key" UNIQUE ("order_number");


--
-- Name: orderrecord orderrecord_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."orderrecord"
    ADD CONSTRAINT "orderrecord_pkey" PRIMARY KEY ("id");


--
-- Name: reminder reminder_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."reminder"
    ADD CONSTRAINT "reminder_pkey" PRIMARY KEY ("id");


--
-- Name: reviewaction reviewaction_aftersale_id_next_state_key; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."reviewaction"
    ADD CONSTRAINT "reviewaction_aftersale_id_next_state_key" UNIQUE ("aftersale_id", "next_state");


--
-- Name: reviewaction reviewaction_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."reviewaction"
    ADD CONSTRAINT "reviewaction_pkey" PRIMARY KEY ("id");


--
-- Name: stateevent stateevent_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."stateevent"
    ADD CONSTRAINT "stateevent_pkey" PRIMARY KEY ("order_id", "sequence");


--
-- Name: suborder suborder_pkey; Type: CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."suborder"
    ADD CONSTRAINT "suborder_pkey" PRIMARY KEY ("id");


--
-- Name: assignment assignment_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."assignment"
    ADD CONSTRAINT "assignment_pkey" PRIMARY KEY ("parent_id", "child_id", "kind", "effective_at");


--
-- Name: change change_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."change"
    ADD CONSTRAINT "change_pkey" PRIMARY KEY ("id");


--
-- Name: directoryconnection directoryconnection_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryconnection"
    ADD CONSTRAINT "directoryconnection_pkey" PRIMARY KEY ("id");


--
-- Name: directoryinbox directoryinbox_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryinbox"
    ADD CONSTRAINT "directoryinbox_pkey" PRIMARY KEY ("connection_id", "provider_event_id");


--
-- Name: directorymembership directorymembership_connection_id_subject_id_organization_i_key; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorymembership"
    ADD CONSTRAINT "directorymembership_connection_id_subject_id_organization_i_key" UNIQUE ("connection_id", "subject_id", "organization_id");


--
-- Name: directorymembership directorymembership_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorymembership"
    ADD CONSTRAINT "directorymembership_pkey" PRIMARY KEY ("id");


--
-- Name: directorysubject directorysubject_connection_id_subject_hash_key; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorysubject"
    ADD CONSTRAINT "directorysubject_connection_id_subject_hash_key" UNIQUE ("connection_id", "subject_hash");


--
-- Name: directorysubject directorysubject_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorysubject"
    ADD CONSTRAINT "directorysubject_pkey" PRIMARY KEY ("id");


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."organization"
    ADD CONSTRAINT "organization_pkey" PRIMARY KEY ("id");


--
-- Name: sourcebinding sourcebinding_organization_id_source_type_key; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."sourcebinding"
    ADD CONSTRAINT "sourcebinding_organization_id_source_type_key" UNIQUE ("organization_id", "source_type");


--
-- Name: sourcebinding sourcebinding_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."sourcebinding"
    ADD CONSTRAINT "sourcebinding_pkey" PRIMARY KEY ("source_type", "source_id");


--
-- Name: syncrun syncrun_connection_id_provider_run_id_key; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."syncrun"
    ADD CONSTRAINT "syncrun_connection_id_provider_run_id_key" UNIQUE ("connection_id", "provider_run_id");


--
-- Name: syncrun syncrun_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."syncrun"
    ADD CONSTRAINT "syncrun_pkey" PRIMARY KEY ("id");


--
-- Name: unitclosure unitclosure_pkey; Type: CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."unitclosure"
    ADD CONSTRAINT "unitclosure_pkey" PRIMARY KEY ("ancestor_id", "descendant_id");


--
-- Name: agreement agreement_partner_id_mall_id_effective_at_key; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."agreement"
    ADD CONSTRAINT "agreement_partner_id_mall_id_effective_at_key" UNIQUE ("partner_id", "mall_id", "effective_at");


--
-- Name: agreement agreement_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."agreement"
    ADD CONSTRAINT "agreement_pkey" PRIMARY KEY ("id");


--
-- Name: brand brand_code_key; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."brand"
    ADD CONSTRAINT "brand_code_key" UNIQUE ("code");


--
-- Name: brand brand_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."brand"
    ADD CONSTRAINT "brand_pkey" PRIMARY KEY ("id");


--
-- Name: partner partner_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."partner"
    ADD CONSTRAINT "partner_pkey" PRIMARY KEY ("id");


--
-- Name: partner partner_scope_id_kind_name_key; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."partner"
    ADD CONSTRAINT "partner_scope_id_kind_name_key" UNIQUE ("scope_id", "kind", "name");


--
-- Name: qualificationdocument qualificationdocument_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."qualificationdocument"
    ADD CONSTRAINT "qualificationdocument_pkey" PRIMARY KEY ("id");


--
-- Name: relationship relationship_left_partner_id_right_partner_id_kind_key; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."relationship"
    ADD CONSTRAINT "relationship_left_partner_id_right_partner_id_kind_key" UNIQUE ("left_partner_id", "right_partner_id", "kind");


--
-- Name: relationship relationship_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."relationship"
    ADD CONSTRAINT "relationship_pkey" PRIMARY KEY ("id");


--
-- Name: servicebinding servicebinding_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."servicebinding"
    ADD CONSTRAINT "servicebinding_pkey" PRIMARY KEY ("store_id", "organization_id", "service");


--
-- Name: store store_pkey; Type: CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."store"
    ADD CONSTRAINT "store_pkey" PRIMARY KEY ("id");


--
-- Name: allocation allocation_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."allocation"
    ADD CONSTRAINT "allocation_pkey" PRIMARY KEY ("payment_id", "target_type", "target_id");


--
-- Name: attempt attempt_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."attempt"
    ADD CONSTRAINT "attempt_pkey" PRIMARY KEY ("id");


--
-- Name: attempt attempt_provider_external_transaction_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."attempt"
    ADD CONSTRAINT "attempt_provider_external_transaction_key" UNIQUE ("provider", "external_transaction");


--
-- Name: capture capture_order_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."capture"
    ADD CONSTRAINT "capture_order_id_key" UNIQUE ("order_id");


--
-- Name: capture capture_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."capture"
    ADD CONSTRAINT "capture_pkey" PRIMARY KEY ("id");


--
-- Name: capture capture_scope_id_mall_id_idempotency_key_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."capture"
    ADD CONSTRAINT "capture_scope_id_mall_id_idempotency_key_key" UNIQUE ("scope_id", "mall_id", "idempotency_key");


--
-- Name: deadletterreview deadletterreview_deadletter_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."deadletterreview"
    ADD CONSTRAINT "deadletterreview_deadletter_id_key" UNIQUE ("deadletter_id");


--
-- Name: deadletterreview deadletterreview_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."deadletterreview"
    ADD CONSTRAINT "deadletterreview_pkey" PRIMARY KEY ("id");


--
-- Name: effect effect_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."effect"
    ADD CONSTRAINT "effect_pkey" PRIMARY KEY ("id");


--
-- Name: intent intent_order_id_idempotency_key_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intent"
    ADD CONSTRAINT "intent_order_id_idempotency_key_key" UNIQUE ("order_id", "idempotency_key");


--
-- Name: intent intent_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intent"
    ADD CONSTRAINT "intent_pkey" PRIMARY KEY ("id");


--
-- Name: intent intent_provider_reference_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intent"
    ADD CONSTRAINT "intent_provider_reference_key" UNIQUE ("provider_reference");


--
-- Name: intenttender intenttender_intent_id_kind_reference_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intenttender"
    ADD CONSTRAINT "intenttender_intent_id_kind_reference_id_key" UNIQUE ("intent_id", "kind", "reference_id");


--
-- Name: intenttender intenttender_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intenttender"
    ADD CONSTRAINT "intenttender_pkey" PRIMARY KEY ("intent_id", "sequence");


--
-- Name: observation observation_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."observation"
    ADD CONSTRAINT "observation_pkey" PRIMARY KEY ("id");


--
-- Name: observation observation_provider_event_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."observation"
    ADD CONSTRAINT "observation_provider_event_id_key" UNIQUE ("provider_event_id");


--
-- Name: payment payment_intent_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."payment"
    ADD CONSTRAINT "payment_intent_id_key" UNIQUE ("intent_id");


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."payment"
    ADD CONSTRAINT "payment_pkey" PRIMARY KEY ("id");


--
-- Name: prepay prepay_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."prepay"
    ADD CONSTRAINT "prepay_pkey" PRIMARY KEY ("intent_id");


--
-- Name: providerattempt providerattempt_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."providerattempt"
    ADD CONSTRAINT "providerattempt_pkey" PRIMARY KEY ("id");


--
-- Name: providerattempt providerattempt_refund_id_sequence_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."providerattempt"
    ADD CONSTRAINT "providerattempt_refund_id_sequence_key" UNIQUE ("refund_id", "sequence");


--
-- Name: recoverycase recoverycase_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."recoverycase"
    ADD CONSTRAINT "recoverycase_pkey" PRIMARY KEY ("id");


--
-- Name: recoverycase recoverycase_resource_type_resource_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."recoverycase"
    ADD CONSTRAINT "recoverycase_resource_type_resource_id_key" UNIQUE ("resource_type", "resource_id");


--
-- Name: recoveryrequest recoveryrequest_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."recoveryrequest"
    ADD CONSTRAINT "recoveryrequest_pkey" PRIMARY KEY ("id");


--
-- Name: recoveryrequest recoveryrequest_trace_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."recoveryrequest"
    ADD CONSTRAINT "recoveryrequest_trace_id_key" UNIQUE ("trace_id");


--
-- Name: refund refund_payment_id_idempotency_key_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_payment_id_idempotency_key_key" UNIQUE ("payment_id", "idempotency_key");


--
-- Name: refund refund_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_pkey" PRIMARY KEY ("id");


--
-- Name: refund refund_provider_external_transaction_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_provider_external_transaction_key" UNIQUE ("provider", "external_transaction");


--
-- Name: refund refund_provider_reference_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_provider_reference_key" UNIQUE ("provider_reference");


--
-- Name: refundcommand refundcommand_external_refund_number_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundcommand"
    ADD CONSTRAINT "refundcommand_external_refund_number_key" UNIQUE ("external_refund_number");


--
-- Name: refundcommand refundcommand_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundcommand"
    ADD CONSTRAINT "refundcommand_pkey" PRIMARY KEY ("id");


--
-- Name: refundreceipt refundreceipt_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundreceipt"
    ADD CONSTRAINT "refundreceipt_pkey" PRIMARY KEY ("id");


--
-- Name: refundreceipt refundreceipt_provider_attempt_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundreceipt"
    ADD CONSTRAINT "refundreceipt_provider_attempt_id_key" UNIQUE ("provider_attempt_id");


--
-- Name: refundtender refundtender_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundtender"
    ADD CONSTRAINT "refundtender_pkey" PRIMARY KEY ("refund_id", "sequence");


--
-- Name: refundtender refundtender_refund_id_kind_reference_id_key; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundtender"
    ADD CONSTRAINT "refundtender_refund_id_kind_reference_id_key" UNIQUE ("refund_id", "kind", "reference_id");


--
-- Name: tender tender_pkey; Type: CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."tender"
    ADD CONSTRAINT "tender_pkey" PRIMARY KEY ("id");


--
-- Name: price price_book_id_sku_id_effective_at_key; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."price"
    ADD CONSTRAINT "price_book_id_sku_id_effective_at_key" UNIQUE ("book_id", "sku_id", "effective_at");


--
-- Name: price price_pkey; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."price"
    ADD CONSTRAINT "price_pkey" PRIMARY KEY ("id");


--
-- Name: pricebook pricebook_pkey; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."pricebook"
    ADD CONSTRAINT "pricebook_pkey" PRIMARY KEY ("id");


--
-- Name: pricebook pricebook_scope_id_name_key; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."pricebook"
    ADD CONSTRAINT "pricebook_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: quote quote_pkey; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."quote"
    ADD CONSTRAINT "quote_pkey" PRIMARY KEY ("id");


--
-- Name: rule rule_pkey; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."rule"
    ADD CONSTRAINT "rule_pkey" PRIMARY KEY ("id");


--
-- Name: rule rule_scope_id_id_version_key; Type: CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."rule"
    ADD CONSTRAINT "rule_scope_id_id_version_key" UNIQUE ("scope_id", "id", "version");


--
-- Name: changerequest changerequest_idempotency_key_key; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."changerequest"
    ADD CONSTRAINT "changerequest_idempotency_key_key" UNIQUE ("idempotency_key");


--
-- Name: changerequest changerequest_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."changerequest"
    ADD CONSTRAINT "changerequest_pkey" PRIMARY KEY ("id");


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."evidence"
    ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("id");


--
-- Name: policy policy_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."policy"
    ADD CONSTRAINT "policy_pkey" PRIMARY KEY ("id");


--
-- Name: policy policy_scope_id_name_key; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."policy"
    ADD CONSTRAINT "policy_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: policyversion policyversion_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."policyversion"
    ADD CONSTRAINT "policyversion_pkey" PRIMARY KEY ("policy_id", "version");


--
-- Name: policyversion policyversion_policy_id_rule_hash_key; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."policyversion"
    ADD CONSTRAINT "policyversion_policy_id_rule_hash_key" UNIQUE ("policy_id", "rule_hash");


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("member_id");


--
-- Name: resource resource_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."resource"
    ADD CONSTRAINT "resource_pkey" PRIMARY KEY ("policy_id", "policy_version", "kind", "resource_id");


--
-- Name: subject subject_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."subject"
    ADD CONSTRAINT "subject_pkey" PRIMARY KEY ("policy_id", "policy_version", "kind", "selector");


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."tag"
    ADD CONSTRAINT "tag_pkey" PRIMARY KEY ("member_id", "code");


--
-- Name: export export_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."export"
    ADD CONSTRAINT "export_pkey" PRIMARY KEY ("id");


--
-- Name: fact fact_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."fact"
    ADD CONSTRAINT "fact_pkey" PRIMARY KEY ("metric_id", "metric_version", "scope_id", "period_start", "dimensions");


--
-- Name: financeprojection financeprojection_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."financeprojection"
    ADD CONSTRAINT "financeprojection_pkey" PRIMARY KEY ("statement_id");


--
-- Name: metric metric_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."metric"
    ADD CONSTRAINT "metric_pkey" PRIMARY KEY ("id", "version");


--
-- Name: orderprojection orderprojection_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."orderprojection"
    ADD CONSTRAINT "orderprojection_pkey" PRIMARY KEY ("order_id", "scope_id");


--
-- Name: projectionevent projectionevent_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."projectionevent"
    ADD CONSTRAINT "projectionevent_pkey" PRIMARY KEY ("event_id");


--
-- Name: watermark watermark_pkey; Type: CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."watermark"
    ADD CONSTRAINT "watermark_pkey" PRIMARY KEY ("projection", "scope_id");


--
-- Name: case case_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."case"
    ADD CONSTRAINT "case_pkey" PRIMARY KEY ("id");


--
-- Name: decision decision_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."decision"
    ADD CONSTRAINT "decision_pkey" PRIMARY KEY ("id");


--
-- Name: listentry listentry_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."listentry"
    ADD CONSTRAINT "listentry_pkey" PRIMARY KEY ("id");


--
-- Name: policy policy_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policy"
    ADD CONSTRAINT "policy_pkey" PRIMARY KEY ("id");


--
-- Name: policy policy_scope_id_name_key; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policy"
    ADD CONSTRAINT "policy_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: policyversion policyversion_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policyversion"
    ADD CONSTRAINT "policyversion_pkey" PRIMARY KEY ("policy_id", "version");


--
-- Name: replay replay_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."replay"
    ADD CONSTRAINT "replay_pkey" PRIMARY KEY ("policy_id", "candidate_version");


--
-- Name: listentry risk_listentry_scope_token; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."listentry"
    ADD CONSTRAINT "risk_listentry_scope_token" UNIQUE ("scope_id", "list_type", "token", "effective_at");


--
-- Name: signal signal_pkey; Type: CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."signal"
    ADD CONSTRAINT "signal_pkey" PRIMARY KEY ("id");


--
-- Name: contractcatalog contractcatalog_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."contractcatalog"
    ADD CONSTRAINT "contractcatalog_pkey" PRIMARY KEY ("artifact", "version");


--
-- Name: deadletter deadletter_kind_source_id_key; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."deadletter"
    ADD CONSTRAINT "deadletter_kind_source_id_key" UNIQUE ("kind", "source_id");


--
-- Name: deadletter deadletter_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."deadletter"
    ADD CONSTRAINT "deadletter_pkey" PRIMARY KEY ("id");


--
-- Name: errorcontract errorcontract_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."errorcontract"
    ADD CONSTRAINT "errorcontract_pkey" PRIMARY KEY ("code");


--
-- Name: event event_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."event"
    ADD CONSTRAINT "event_pkey" PRIMARY KEY ("type", "version");


--
-- Name: idempotency idempotency_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."idempotency"
    ADD CONSTRAINT "idempotency_pkey" PRIMARY KEY ("scope", "actor_id", "operation", "key");


--
-- Name: inbox inbox_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."inbox"
    ADD CONSTRAINT "inbox_pkey" PRIMARY KEY ("provider", "event_id", "operation");


--
-- Name: job job_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."job"
    ADD CONSTRAINT "job_pkey" PRIMARY KEY ("id");


--
-- Name: jobdefinition jobdefinition_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."jobdefinition"
    ADD CONSTRAINT "jobdefinition_pkey" PRIMARY KEY ("kind");


--
-- Name: lease lease_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."lease"
    ADD CONSTRAINT "lease_pkey" PRIMARY KEY ("resource");


--
-- Name: lease lease_token_key; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."lease"
    ADD CONSTRAINT "lease_token_key" UNIQUE ("token");


--
-- Name: migrationevidence migrationevidence_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."migrationevidence"
    ADD CONSTRAINT "migrationevidence_pkey" PRIMARY KEY ("migration");


--
-- Name: operation operation_method_path_key; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."operation"
    ADD CONSTRAINT "operation_method_path_key" UNIQUE ("method", "path");


--
-- Name: operation operation_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."operation"
    ADD CONSTRAINT "operation_pkey" PRIMARY KEY ("id");


--
-- Name: outbox outbox_aggregate_id_aggregate_version_event_type_key; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."outbox"
    ADD CONSTRAINT "outbox_aggregate_id_aggregate_version_event_type_key" UNIQUE ("aggregate_id", "aggregate_version", "event_type");


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."outbox"
    ADD CONSTRAINT "outbox_pkey" PRIMARY KEY ("id");


--
-- Name: projectionoffset projectionoffset_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."projectionoffset"
    ADD CONSTRAINT "projectionoffset_pkey" PRIMARY KEY ("projection", "shard");


--
-- Name: rawenvelope rawenvelope_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."rawenvelope"
    ADD CONSTRAINT "rawenvelope_pkey" PRIMARY KEY ("provider", "external_id");


--
-- Name: rawenvelope rawenvelope_provider_sha256_key; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."rawenvelope"
    ADD CONSTRAINT "rawenvelope_provider_sha256_key" UNIQUE ("provider", "sha256");


--
-- Name: reconciliationevidence reconciliationevidence_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."reconciliationevidence"
    ADD CONSTRAINT "reconciliationevidence_pkey" PRIMARY KEY ("id");


--
-- Name: reconciliationhash reconciliationhash_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."reconciliationhash"
    ADD CONSTRAINT "reconciliationhash_pkey" PRIMARY KEY ("id");


--
-- Name: schemaversion schemaversion_pkey; Type: CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."schemaversion"
    ADD CONSTRAINT "schemaversion_pkey" PRIMARY KEY ("version");


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY "supabase_migrations"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."account"
    ADD CONSTRAINT "account_pkey" PRIMARY KEY ("id");


--
-- Name: account account_scope_id_channel_external_ref_key; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."account"
    ADD CONSTRAINT "account_scope_id_channel_external_ref_key" UNIQUE ("scope_id", "channel", "external_ref");


--
-- Name: agent agent_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."agent"
    ADD CONSTRAINT "agent_pkey" PRIMARY KEY ("id");


--
-- Name: agent agent_scope_id_membership_id_key; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."agent"
    ADD CONSTRAINT "agent_scope_id_membership_id_key" UNIQUE ("scope_id", "membership_id");


--
-- Name: assignment assignment_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."assignment"
    ADD CONSTRAINT "assignment_pkey" PRIMARY KEY ("id");


--
-- Name: assignmentrule assignmentrule_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."assignmentrule"
    ADD CONSTRAINT "assignmentrule_pkey" PRIMARY KEY ("id");


--
-- Name: assignmentrule assignmentrule_scope_id_name_key; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."assignmentrule"
    ADD CONSTRAINT "assignmentrule_scope_id_name_key" UNIQUE ("scope_id", "name");


--
-- Name: ticket case_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."ticket"
    ADD CONSTRAINT "case_pkey" PRIMARY KEY ("id");


--
-- Name: history caseevent_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."history"
    ADD CONSTRAINT "caseevent_pkey" PRIMARY KEY ("ticket_id", "sequence");


--
-- Name: conversation conversation_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."conversation"
    ADD CONSTRAINT "conversation_pkey" PRIMARY KEY ("id");


--
-- Name: escalation escalation_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."escalation"
    ADD CONSTRAINT "escalation_pkey" PRIMARY KEY ("id");


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."evidence"
    ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("id");


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."message"
    ADD CONSTRAINT "message_pkey" PRIMARY KEY ("id");


--
-- Name: sla sla_pkey; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."sla"
    ADD CONSTRAINT "sla_pkey" PRIMARY KEY ("id");


--
-- Name: sla sla_scope_id_priority_version_key; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."sla"
    ADD CONSTRAINT "sla_scope_id_priority_version_key" UNIQUE ("scope_id", "priority", "version");


--
-- Name: ticket ticket_conversation_key; Type: CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."ticket"
    ADD CONSTRAINT "ticket_conversation_key" UNIQUE ("conversation_id");


--
-- Name: attempt attempt_pkey; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."attempt"
    ADD CONSTRAINT "attempt_pkey" PRIMARY KEY ("id");


--
-- Name: attempt attempt_session_id_nonce_hash_key; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."attempt"
    ADD CONSTRAINT "attempt_session_id_nonce_hash_key" UNIQUE ("session_id", "nonce_hash");


--
-- Name: device device_pkey; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."device"
    ADD CONSTRAINT "device_pkey" PRIMARY KEY ("id");


--
-- Name: device device_scope_id_fingerprint_hash_key; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."device"
    ADD CONSTRAINT "device_scope_id_fingerprint_hash_key" UNIQUE ("scope_id", "fingerprint_hash");


--
-- Name: nonce nonce_pkey; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."nonce"
    ADD CONSTRAINT "nonce_pkey" PRIMARY KEY ("session_id", "nonce_hash");


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("id");


--
-- Name: allocation allocation_cardpool_id_scope_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."allocation"
    ADD CONSTRAINT "allocation_cardpool_id_scope_id_key" UNIQUE ("cardpool_id", "scope_id");


--
-- Name: allocation allocation_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."allocation"
    ADD CONSTRAINT "allocation_pkey" PRIMARY KEY ("id");


--
-- Name: approval approval_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."approval"
    ADD CONSTRAINT "approval_pkey" PRIMARY KEY ("id");


--
-- Name: approval approval_request_id_sequence_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."approval"
    ADD CONSTRAINT "approval_request_id_sequence_key" UNIQUE ("request_id", "sequence");


--
-- Name: card card_code_fingerprint_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."card"
    ADD CONSTRAINT "card_code_fingerprint_key" UNIQUE ("code_fingerprint");


--
-- Name: card card_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."card"
    ADD CONSTRAINT "card_pkey" PRIMARY KEY ("id");


--
-- Name: cardpool cardpool_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."cardpool"
    ADD CONSTRAINT "cardpool_pkey" PRIMARY KEY ("id");


--
-- Name: hold hold_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."hold"
    ADD CONSTRAINT "hold_pkey" PRIMARY KEY ("id");


--
-- Name: hold hold_voucher_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."hold"
    ADD CONSTRAINT "hold_voucher_id_key" UNIQUE ("voucher_id");


--
-- Name: importerror importerror_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importerror"
    ADD CONSTRAINT "importerror_pkey" PRIMARY KEY ("job_id", "row_number");


--
-- Name: importjob importjob_cardpool_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importjob"
    ADD CONSTRAINT "importjob_cardpool_id_key" UNIQUE ("cardpool_id");


--
-- Name: importjob importjob_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importjob"
    ADD CONSTRAINT "importjob_pkey" PRIMARY KEY ("id");


--
-- Name: importrow importrow_job_id_code_fingerprint_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importrow"
    ADD CONSTRAINT "importrow_job_id_code_fingerprint_key" UNIQUE ("job_id", "code_fingerprint");


--
-- Name: importrow importrow_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importrow"
    ADD CONSTRAINT "importrow_pkey" PRIMARY KEY ("job_id", "row_number");


--
-- Name: issuebatch issuebatch_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."issuebatch"
    ADD CONSTRAINT "issuebatch_pkey" PRIMARY KEY ("id");


--
-- Name: program program_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."program"
    ADD CONSTRAINT "program_pkey" PRIMARY KEY ("id");


--
-- Name: programversion programversion_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."programversion"
    ADD CONSTRAINT "programversion_pkey" PRIMARY KEY ("program_id", "version");


--
-- Name: redemption redemption_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."redemption"
    ADD CONSTRAINT "redemption_pkey" PRIMARY KEY ("id");


--
-- Name: redemption redemption_verification_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."redemption"
    ADD CONSTRAINT "redemption_verification_id_key" UNIQUE ("verification_id");


--
-- Name: reserve reserve_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserve"
    ADD CONSTRAINT "reserve_pkey" PRIMARY KEY ("id");


--
-- Name: reserve reserve_voucher_id_owner_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserve"
    ADD CONSTRAINT "reserve_voucher_id_owner_id_key" UNIQUE ("voucher_id", "owner_id");


--
-- Name: reserverequest reserverequest_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserverequest"
    ADD CONSTRAINT "reserverequest_pkey" PRIMARY KEY ("id");


--
-- Name: reserverequest reserverequest_request_number_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserverequest"
    ADD CONSTRAINT "reserverequest_request_number_key" UNIQUE ("request_number");


--
-- Name: reversal reversal_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reversal"
    ADD CONSTRAINT "reversal_pkey" PRIMARY KEY ("id");


--
-- Name: reversal reversal_redemption_id_reference_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reversal"
    ADD CONSTRAINT "reversal_redemption_id_reference_id_key" UNIQUE ("redemption_id", "reference_id");


--
-- Name: statusbatch statusbatch_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."statusbatch"
    ADD CONSTRAINT "statusbatch_pkey" PRIMARY KEY ("id");


--
-- Name: statusevent statusevent_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."statusevent"
    ADD CONSTRAINT "statusevent_pkey" PRIMARY KEY ("voucher_id", "sequence");


--
-- Name: statusitem statusitem_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."statusitem"
    ADD CONSTRAINT "statusitem_pkey" PRIMARY KEY ("batch_id", "voucher_id");


--
-- Name: voucher voucher_card_id_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_card_id_key" UNIQUE ("card_id");


--
-- Name: voucher voucher_code_fingerprint_key; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_code_fingerprint_key" UNIQUE ("code_fingerprint");


--
-- Name: voucher voucher_pkey; Type: CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_pkey" PRIMARY KEY ("id");


--
-- Name: access_actionproof_checker; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_actionproof_checker" ON "access"."actionproof" USING "btree" ("checker_membership_id", "checker_access_version", "expires_at");


--
-- Name: access_actionproof_expiry; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_actionproof_expiry" ON "access"."actionproof" USING "btree" ("expires_at", "id") WHERE ("consumed_at" IS NULL);


--
-- Name: access_membership_principal_organization_client; Type: INDEX; Schema: access; Owner: -
--

CREATE UNIQUE INDEX "access_membership_principal_organization_client" ON "access"."membership" USING "btree" ("principal_id", "organization_id", "client");


--
-- Name: access_membership_principal_target; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_membership_principal_target" ON "access"."membership" USING "btree" ("principal_id", "client", "status", "id");


--
-- Name: access_navigation_membershiprole; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_navigation_membershiprole" ON "access"."membershiprole" USING "btree" ("membership_id", "effective_at", "expires_at", "role_id");


--
-- Name: access_override_effective; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_override_effective" ON "access"."membershipoverride" USING "btree" ("membership_id", "effect", "effective_at", "expires_at", "revoked_at", "permission_id");


--
-- Name: access_permission_role_effect; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_permission_role_effect" ON "access"."rolepermission" USING "btree" ("role_id", "effect", "permission_id");


--
-- Name: access_role_kind_status; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_role_kind_status" ON "access"."role" USING "btree" ("kind", "status", "scope_id", "id");


--
-- Name: access_role_one_owner_per_scope; Type: INDEX; Schema: access; Owner: -
--

CREATE UNIQUE INDEX "access_role_one_owner_per_scope" ON "access"."role" USING "btree" ("scope_id") WHERE ("kind" = 'owner'::"text");


--
-- Name: access_scope_actor_path; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_scope_actor_path" ON "access"."scopegrant" USING "btree" ("membership_id", "scope_path", "effect", "expires_at");


--
-- Name: access_scope_effective; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "access_scope_effective" ON "access"."scopegrant" USING "btree" ("membership_id", "effect", "effective_at", "expires_at", "scope_kind", "scope_id");


--
-- Name: member_scope_status; Type: INDEX; Schema: access; Owner: -
--

CREATE INDEX "member_scope_status" ON "access"."membership" USING "btree" ("organization_id", "status", "id");


--
-- Name: audit_access_chain_lookup; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_access_chain_lookup" ON "audit"."accessrecord" USING "btree" ("scope_id", "accessed_at" DESC, "id" DESC, "record_hash");


--
-- Name: audit_access_scope_time; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_access_scope_time" ON "audit"."accessrecord" USING "btree" ("scope_id", "accessed_at" DESC, "id");


--
-- Name: audit_archive_scope_time; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_archive_scope_time" ON "audit"."archiveref" USING "btree" ("scope_id", "through_at" DESC, "id");


--
-- Name: audit_archiveitem_archive; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_archiveitem_archive" ON "audit"."archiveitem" USING "btree" ("archive_id", "record_kind", "record_id");


--
-- Name: audit_record_archive; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_record_archive" ON ONLY "audit"."record" USING "btree" ("scope_id", "recorded_at", "id");


--
-- Name: audit_record_chain_lookup; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_record_chain_lookup" ON ONLY "audit"."record" USING "btree" ("scope_id", "recorded_at" DESC, "id" DESC, "record_hash");


--
-- Name: audit_scope_time; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "audit_scope_time" ON ONLY "audit"."record" USING "btree" ("scope_id", "recorded_at" DESC, "id");


--
-- Name: recorddefault_scope_id_recorded_at_id_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "recorddefault_scope_id_recorded_at_id_idx" ON "audit"."recorddefault" USING "btree" ("scope_id", "recorded_at" DESC, "id");


--
-- Name: recorddefault_scope_id_recorded_at_id_idx1; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "recorddefault_scope_id_recorded_at_id_idx1" ON "audit"."recorddefault" USING "btree" ("scope_id", "recorded_at", "id");


--
-- Name: recorddefault_scope_id_recorded_at_id_record_hash_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX "recorddefault_scope_id_recorded_at_id_record_hash_idx" ON "audit"."recorddefault" USING "btree" ("scope_id", "recorded_at" DESC, "id" DESC, "record_hash");


--
-- Name: benefit_account_member_kind; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_account_member_kind" ON "benefit"."account" USING "btree" ("member_id", "kind", "id");


--
-- Name: benefit_action_batch; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_action_batch" ON "benefit"."action" USING "btree" ("batch_id", "occurred_at", "id");


--
-- Name: benefit_batch_plan_read; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_batch_plan_read" ON "benefit"."grantbatch" USING "btree" ("plan_id", "created_at" DESC, "id" DESC);


--
-- Name: benefit_budget_plan_read; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_budget_plan_read" ON "benefit"."budget" USING "btree" ("plan_id", "period", "id");


--
-- Name: benefit_item_work; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_item_work" ON "benefit"."grantitem" USING "btree" ("batch_id", "state", "member_id");


--
-- Name: benefit_lot_account_expiry; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_lot_account_expiry" ON "benefit"."lot" USING "btree" ("account_id", "state", "effective_at", "expires_at", "id");


--
-- Name: benefit_lot_expiry; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_lot_expiry" ON "benefit"."lot" USING "btree" ("state", "effective_at", "expires_at", "id");


--
-- Name: benefit_lot_grant; Type: INDEX; Schema: benefit; Owner: -
--

CREATE UNIQUE INDEX "benefit_lot_grant" ON "benefit"."lot" USING "btree" ("account_id", "batch_id") WHERE ("origin" = 'grant'::"text");


--
-- Name: benefit_movement_reference; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_movement_reference" ON "benefit"."lotmovement" USING "btree" ("reference_type", "reference_id", "lot_id");


--
-- Name: benefit_plan_scope_read; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_plan_scope_read" ON "benefit"."plan" USING "btree" ("scope_id", "id");


--
-- Name: benefit_reminder_schedule; Type: INDEX; Schema: benefit; Owner: -
--

CREATE INDEX "benefit_reminder_schedule" ON "benefit"."reminder" USING "btree" ("scheduled_at", "lot_id");


--
-- Name: capability_entitlement_scope; Type: INDEX; Schema: capability; Owner: -
--

CREATE INDEX "capability_entitlement_scope" ON "capability"."entitlement" USING "btree" ("scope_id", "capability_id", "id");


--
-- Name: capability_navigation_scope; Type: INDEX; Schema: capability; Owner: -
--

CREATE INDEX "capability_navigation_scope" ON "capability"."entitlement" USING "btree" ("scope_id", "state", "effective_at", "expires_at", "capability_id");


--
-- Name: cart_member_current; Type: INDEX; Schema: cart; Owner: -
--

CREATE INDEX "cart_member_current" ON "cart"."cart" USING "btree" ("member_id", "mall_id", "updated_at" DESC, "id");


--
-- Name: cart_one_active; Type: INDEX; Schema: cart; Owner: -
--

CREATE UNIQUE INDEX "cart_one_active" ON "cart"."cart" USING "btree" ("member_id", "mall_id", "application_id") WHERE ("state" = 'active'::"text");


--
-- Name: catalog_import_work; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_import_work" ON "catalog"."importjob" USING "btree" ("state", "updated_at", "id") WHERE ("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text"]));


--
-- Name: catalog_listing_scope; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_listing_scope" ON "catalog"."sourcelisting" USING "btree" ("scope_id", "status", "observed_at", "id");


--
-- Name: catalog_listing_scope_time; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_listing_scope_time" ON "catalog"."listing" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: catalog_pool_scope_name; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_pool_scope_name" ON "catalog"."pool" USING "btree" ("scope_id", "name", "id");


--
-- Name: catalog_product_category; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_product_category" ON "catalog"."product" USING "btree" ("category_id", "status", "updated_at", "id");


--
-- Name: catalog_source_scope_time; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX "catalog_source_scope_time" ON "catalog"."sourcelisting" USING "btree" ("scope_id", "observed_at" DESC, "id" DESC);


--
-- Name: channel_connection_state; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_connection_state" ON "channel"."connection" USING "btree" ("provider", "status", "id");


--
-- Name: channel_distributor_time; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_distributor_time" ON "channel"."distributor" USING "btree" ("updated_at" DESC, "id" DESC);


--
-- Name: channel_externalobject_internal; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_externalobject_internal" ON "channel"."externalobject" USING "btree" ("scope_id", "internaltype", "internalid");


--
-- Name: channel_operation_scope_time; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_operation_scope_time" ON "channel"."provideroperation" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: channel_source_external; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_source_external" ON "channel"."sourcerecord" USING "btree" ("provider", "externalid", "observed_at" DESC);


--
-- Name: channel_sync_claim; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_sync_claim" ON "channel"."syncrun" USING "btree" ("state", "started_at", "id");


--
-- Name: channel_syncrun_active; Type: INDEX; Schema: channel; Owner: -
--

CREATE UNIQUE INDEX "channel_syncrun_active" ON "channel"."syncrun" USING "btree" ("connection_id", "kind") WHERE ("state" = ANY (ARRAY['queued'::"text", 'running'::"text"]));


--
-- Name: channel_syncrun_connection_time; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_syncrun_connection_time" ON "channel"."syncrun" USING "btree" ("connection_id", "started_at" DESC, "id" DESC);


--
-- Name: channel_webhookinbox_reference; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_webhookinbox_reference" ON "channel"."webhookinbox" USING "btree" ("provider", "external_reference", "received_at" DESC);


--
-- Name: channel_webhookinbox_work; Type: INDEX; Schema: channel; Owner: -
--

CREATE INDEX "channel_webhookinbox_work" ON "channel"."webhookinbox" USING "btree" ("state", "received_at", "id");


--
-- Name: checkout_address_member; Type: INDEX; Schema: checkout; Owner: -
--

CREATE INDEX "checkout_address_member" ON "checkout"."address" USING "btree" ("member_id", "status", "id");


--
-- Name: checkout_expiry; Type: INDEX; Schema: checkout; Owner: -
--

CREATE INDEX "checkout_expiry" ON "checkout"."session" USING "btree" ("state", "expires_at", "id");


--
-- Name: experience_application_scope_time; Type: INDEX; Schema: experience; Owner: -
--

CREATE INDEX "experience_application_scope_time" ON "experience"."application" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: experience_publication_active; Type: INDEX; Schema: experience; Owner: -
--

CREATE UNIQUE INDEX "experience_publication_active" ON "experience"."publication" USING "btree" ("application_id") WHERE ("state" = 'active'::"text");


--
-- Name: experience_release_active; Type: INDEX; Schema: experience; Owner: -
--

CREATE INDEX "experience_release_active" ON "experience"."release" USING "btree" ("application_id", "state", "effective_at" DESC);


--
-- Name: extension_health_latest; Type: INDEX; Schema: extension; Owner: -
--

CREATE INDEX "extension_health_latest" ON "extension"."health" USING "btree" ("installation_id", "checked_at" DESC);


--
-- Name: extension_installation_enabled; Type: INDEX; Schema: extension; Owner: -
--

CREATE UNIQUE INDEX "extension_installation_enabled" ON "extension"."installation" USING "btree" ("extension_id", "scope_id") WHERE ("status" = 'enabled'::"text");


--
-- Name: extension_installation_healthwork; Type: INDEX; Schema: extension; Owner: -
--

CREATE INDEX "extension_installation_healthwork" ON "extension"."installation" USING "btree" ("status", "installed_at", "id") WHERE ("status" = ANY (ARRAY['testing'::"text", 'enabled'::"text", 'degraded'::"text"]));


--
-- Name: extension_installation_scope_time; Type: INDEX; Schema: extension; Owner: -
--

CREATE INDEX "extension_installation_scope_time" ON "extension"."installation" USING "btree" ("scope_id", "installed_at" DESC, "id" DESC);


--
-- Name: extension_registry_state; Type: INDEX; Schema: extension; Owner: -
--

CREATE INDEX "extension_registry_state" ON "extension"."registry" USING "btree" ("state", "extension_id", "scope_id", "generation");


--
-- Name: finance_backfill_scope; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_backfill_scope" ON "finance"."backfill" USING "btree" ("scope_id", "state", "prepared_at" DESC, "id" DESC);


--
-- Name: finance_economic_leg_scope; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_economic_leg_scope" ON "finance"."economicleg" USING "btree" ("scope_id", "posted_at" DESC, "owner_event_id", "economic_leg_id");


--
-- Name: finance_hold_scope_state; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_hold_scope_state" ON "finance"."hold" USING "btree" ("scope_id", "state", "expires_at", "id");


--
-- Name: finance_journal_period; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_journal_period" ON "finance"."journal" USING "btree" ("period", "state", "id");


--
-- Name: finance_journal_state_time; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_journal_state_time" ON "finance"."journal" USING "btree" ("state", "posted_at" DESC, "id" DESC);


--
-- Name: finance_periodclose_scope; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_periodclose_scope" ON "finance"."periodclose" USING "btree" ("scope_id", "state", "period" DESC, "id");


--
-- Name: finance_reconciliationitem_work; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_reconciliationitem_work" ON "finance"."reconciliationitem" USING "btree" ("reconciliation_id", "state", "id");


--
-- Name: finance_settlement_scope; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_settlement_scope" ON "finance"."settlement" USING "btree" ("scope_id", "state", "period", "id");


--
-- Name: finance_settlementadjustment_work; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_settlementadjustment_work" ON "finance"."settlementadjustment" USING "btree" ("scope_id", "state", "created_at", "id");


--
-- Name: finance_settlementline_source; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_settlementline_source" ON "finance"."settlementline" USING "btree" ("source_type", "source_id", "settlement_id");


--
-- Name: finance_split_settlement; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_split_settlement" ON "finance"."split" USING "btree" ("settlement_id", "beneficiary_type", "beneficiary_id");


--
-- Name: finance_statement_scope_period; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_statement_scope_period" ON "finance"."statement" USING "btree" ("scope_id", "state", "period_end" DESC, "id" DESC);


--
-- Name: finance_statementline_reference; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_statementline_reference" ON "finance"."statementline" USING "btree" ("scope_id", "external_reference", "kind");


--
-- Name: finance_withdrawal_scope; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX "finance_withdrawal_scope" ON "finance"."withdrawal" USING "btree" ("scope_id", "state", "created_at" DESC, "id" DESC);


--
-- Name: fulfillment_state; Type: INDEX; Schema: fulfillment; Owner: -
--

CREATE INDEX "fulfillment_state" ON "fulfillment"."fulfillmentorder" USING "btree" ("provider", "state", "id");


--
-- Name: identity_authticket_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_authticket_expiry" ON "identity"."authticket" USING "btree" ("expires_at", "id") WHERE ("consumed_at" IS NULL);


--
-- Name: identity_challengedelivery_no_automatic_resend; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_challengedelivery_no_automatic_resend" ON "identity"."challengedelivery" USING "btree" ("challenge_id") WHERE ("state" = ANY (ARRAY['sending'::"text", 'sent'::"text", 'ambiguous'::"text"]));


--
-- Name: identity_federated_active_subject; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_federated_active_subject" ON "identity"."federatedidentity" USING "btree" ("provider_instance_id", "provider_tenant_hash", "normalized_subject_hash") WHERE ("status" = 'active'::"text");


--
-- Name: identity_federation_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_federation_expiry" ON "identity"."federationtransaction" USING "btree" ("status", "expires_at", "id");


--
-- Name: identity_federation_link_open; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_federation_link_open" ON "identity"."federationtransaction" USING "btree" ("link_principal_id", "link_membership_id", "expires_at", "id") WHERE (("purpose" = 'link'::"text") AND ("consumed_at" IS NULL));


--
-- Name: identity_federation_provider_created; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_federation_provider_created" ON "identity"."federationtransaction" USING "btree" ("provider_id", "created_at", "id");


--
-- Name: identity_federation_returntarget_once; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_federation_returntarget_once" ON "identity"."federationtransaction" USING "btree" ("return_target_hash");


--
-- Name: identity_invitation_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_expiry" ON "identity"."invitation" USING "btree" ("status", "expires_at", "id");


--
-- Name: identity_invitation_issuer; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_issuer" ON "identity"."invitation" USING "btree" ("issuer_membership_id", "status", "created_at", "id");


--
-- Name: identity_invitation_membership; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_membership" ON "identity"."invitation" USING "btree" ("membership_id", "target", "status");


--
-- Name: identity_invitation_organization_created; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_organization_created" ON "identity"."invitation" USING "btree" ("organization_id", "created_at" DESC, "id" DESC);


--
-- Name: identity_invitation_personal_active; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_invitation_personal_active" ON "identity"."invitation" USING "btree" ("membership_id", "target") WHERE (("kind" = ANY (ARRAY['signin'::"text", 'enrollment'::"text"])) AND ("status" = ANY (ARRAY['active'::"text", 'reserved'::"text"])));


--
-- Name: identity_invitation_principal_status; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_principal_status" ON "identity"."invitation" USING "btree" ("principal_id", "status") WHERE ("principal_id" IS NOT NULL);


--
-- Name: identity_invitation_scope; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitation_scope" ON "identity"."invitation" USING "btree" ("organization_id", "id");


--
-- Name: identity_invitationclaim_campaign_capacity; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitationclaim_campaign_capacity" ON "identity"."invitationclaim" USING "btree" ("invitation_id", "state", "expires_at", "id") WHERE (("kind" = 'campaign'::"text") AND ("state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text", 'proved'::"text"])));


--
-- Name: identity_invitationclaim_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitationclaim_expiry" ON "identity"."invitationclaim" USING "btree" ("state", "expires_at", "id") WHERE ("state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text"]));


--
-- Name: identity_invitationclaim_lookup; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitationclaim_lookup" ON "identity"."invitationclaim" USING "btree" ("invitation_id", "state", "expires_at");


--
-- Name: identity_invitationclaim_personal_open; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_invitationclaim_personal_open" ON "identity"."invitationclaim" USING "btree" ("invitation_id") WHERE (("kind" = ANY (ARRAY['signin'::"text", 'enrollment'::"text"])) AND ("state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text", 'proved'::"text"])));


--
-- Name: identity_invitationreceipt_history; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_invitationreceipt_history" ON "identity"."invitationreceipt" USING "btree" ("invitation_id", "redeemed_at");


--
-- Name: identity_linkcase_enrollment_open; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_linkcase_enrollment_open" ON "identity"."linkcase" USING "btree" ("source", "organization_id", "reference_id", "subject_hash") WHERE (("source" = 'enrollment'::"text") AND ("status" = 'open'::"text"));


--
-- Name: identity_linkcase_enrollment_scope; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_linkcase_enrollment_scope" ON "identity"."linkcase" USING "btree" ("organization_id", "created_at", "id") WHERE (("source" = 'enrollment'::"text") AND ("status" = 'open'::"text"));


--
-- Name: identity_linkcase_open; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_linkcase_open" ON "identity"."linkcase" USING "btree" ("tenant_id", "created_at", "id") WHERE ("status" = 'open'::"text");


--
-- Name: identity_preauth_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_preauth_expiry" ON "identity"."preauth" USING "btree" ("expires_at", "id") WHERE ("consumed_at" IS NULL);


--
-- Name: identity_preauth_invitation_expiry; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_preauth_invitation_expiry" ON "identity"."preauth" USING "btree" ("purpose", "state", "expires_at", "id") WHERE (("purpose" = ANY (ARRAY['invitationproof'::"text", 'enrollment'::"text"])) AND ("state" = 'active'::"text"));


--
-- Name: identity_preauth_resolution; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_preauth_resolution" ON "identity"."preauth" USING "btree" ("token_hash", "purpose", "target", "state", "expires_at");


--
-- Name: identity_provider_active; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX "identity_provider_active" ON "identity"."provider" USING "btree" ("tenant_id", "type", "provider_tenant_hash", "client_id_hash") WHERE ("status" <> 'revoked'::"text");


--
-- Name: identity_session_active; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX "identity_session_active" ON "identity"."session" USING "btree" ("token_hash", "expires_at") WHERE ("revoked_at" IS NULL);


--
-- Name: inventory_import_work; Type: INDEX; Schema: inventory; Owner: -
--

CREATE INDEX "inventory_import_work" ON "inventory"."importjob" USING "btree" ("state", "updated_at", "id") WHERE ("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text"]));


--
-- Name: inventory_reservation_active; Type: INDEX; Schema: inventory; Owner: -
--

CREATE INDEX "inventory_reservation_active" ON "inventory"."reservation" USING "btree" ("stockitem_id", "expires_at", "id") WHERE ("state" = 'active'::"text");


--
-- Name: inventory_stock_scope; Type: INDEX; Schema: inventory; Owner: -
--

CREATE INDEX "inventory_stock_scope" ON "inventory"."stockitem" USING "btree" ("scope_id", "sku_id", "status", "id");


--
-- Name: inventory_stock_scope_time; Type: INDEX; Schema: inventory; Owner: -
--

CREATE INDEX "inventory_stock_scope_time" ON "inventory"."stockitem" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: invoice_profile_owner; Type: INDEX; Schema: invoice; Owner: -
--

CREATE INDEX "invoice_profile_owner" ON "invoice"."profile" USING "btree" ("owner_id", "id");


--
-- Name: invoice_request_profile_time; Type: INDEX; Schema: invoice; Owner: -
--

CREATE INDEX "invoice_request_profile_time" ON "invoice"."request" USING "btree" ("profile_id", "created_at" DESC, "id" DESC);


--
-- Name: invoice_requestline_request; Type: INDEX; Schema: invoice; Owner: -
--

CREATE INDEX "invoice_requestline_request" ON "invoice"."requestline" USING "btree" ("request_id", "settlement_line_id");


--
-- Name: marketing_scope_time; Type: INDEX; Schema: marketing; Owner: -
--

CREATE INDEX "marketing_scope_time" ON "marketing"."campaign" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: member_import_work; Type: INDEX; Schema: member; Owner: -
--

CREATE INDEX "member_import_work" ON "member"."importjob" USING "btree" ("state", "updated_at", "id") WHERE ("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text"]));


--
-- Name: member_profile_mobile_identity; Type: INDEX; Schema: member; Owner: -
--

CREATE UNIQUE INDEX "member_profile_mobile_identity" ON "member"."profile" USING "btree" ("mobile_token") WHERE (("mobile_token" IS NOT NULL) AND ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"])));


--
-- Name: notification_announcement_scope_time; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_announcement_scope_time" ON "notification"."announcement" USING "btree" ("scope_id", "state", "starts_at" DESC, "id" DESC);


--
-- Name: notification_dispatch_claim; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_dispatch_claim" ON "notification"."dispatch" USING "btree" ("state", "available_at", "id");


--
-- Name: notification_dispatch_member_time; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_dispatch_member_time" ON "notification"."dispatch" USING "btree" ("member_id", "created_at" DESC, "id" DESC);


--
-- Name: notification_dispatch_recipient_time; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_dispatch_recipient_time" ON "notification"."dispatch" USING "btree" ("recipient_ref", "created_at" DESC, "id" DESC);


--
-- Name: notification_dispatch_scope_time; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_dispatch_scope_time" ON "notification"."dispatch" USING "btree" ("scope_id", "created_at" DESC, "id" DESC) WHERE ("member_id" IS NULL);


--
-- Name: notification_preference_member; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_preference_member" ON "notification"."preference" USING "btree" ("member_id", "event_type", "channel");


--
-- Name: notification_template_active; Type: INDEX; Schema: notification; Owner: -
--

CREATE UNIQUE INDEX "notification_template_active" ON "notification"."template" USING "btree" ("scope_id", "channel", "event_type") WHERE ("status" = 'active'::"text");


--
-- Name: notification_template_scope_event; Type: INDEX; Schema: notification; Owner: -
--

CREATE INDEX "notification_template_scope_event" ON "notification"."template" USING "btree" ("scope_id", "event_type", "status", "channel", "version" DESC);


--
-- Name: ordering_aftersale_time; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_aftersale_time" ON "ordering"."aftersale" USING "btree" ("created_at" DESC, "id" DESC);


--
-- Name: ordering_member_status; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_member_status" ON "ordering"."orderrecord" USING "btree" ("member_id", "mall_id", "created_at" DESC, "id");


--
-- Name: ordering_member_time; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_member_time" ON "ordering"."orderrecord" USING "btree" ("member_id", "created_at" DESC, "id" DESC);


--
-- Name: ordering_reminder_order_time; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_reminder_order_time" ON "ordering"."reminder" USING "btree" ("order_id", "created_at" DESC);


--
-- Name: ordering_scope_status; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_scope_status" ON "ordering"."orderrecord" USING "btree" ("scope_id", "lifecycle_state", "created_at" DESC, "id");


--
-- Name: ordering_scope_time; Type: INDEX; Schema: ordering; Owner: -
--

CREATE INDEX "ordering_scope_time" ON "ordering"."orderrecord" USING "btree" ("scope_id", "created_at" DESC, "id" DESC);


--
-- Name: organization_directoryconnection_active; Type: INDEX; Schema: organization; Owner: -
--

CREATE UNIQUE INDEX "organization_directoryconnection_active" ON "organization"."directoryconnection" USING "btree" ("tenant_id", "provider_instance_id") WHERE ("status" <> 'revoked'::"text");


--
-- Name: organization_directoryinbox_pending; Type: INDEX; Schema: organization; Owner: -
--

CREATE INDEX "organization_directoryinbox_pending" ON "organization"."directoryinbox" USING "btree" ("state", "received_at", "connection_id", "provider_event_id") WHERE ("processed_at" IS NULL);


--
-- Name: organization_directorymembership_active; Type: INDEX; Schema: organization; Owner: -
--

CREATE INDEX "organization_directorymembership_active" ON "organization"."directorymembership" USING "btree" ("connection_id", "status", "source_version", "id");


--
-- Name: organization_directorysubject_active; Type: INDEX; Schema: organization; Owner: -
--

CREATE INDEX "organization_directorysubject_active" ON "organization"."directorysubject" USING "btree" ("connection_id", "status", "source_version", "id");


--
-- Name: organization_parent_status; Type: INDEX; Schema: organization; Owner: -
--

CREATE INDEX "organization_parent_status" ON "organization"."organization" USING "btree" ("parent_id", "status", "id");


--
-- Name: organization_syncrun_claim; Type: INDEX; Schema: organization; Owner: -
--

CREATE INDEX "organization_syncrun_claim" ON "organization"."syncrun" USING "btree" ("state", "created_at", "id") WHERE ("state" = ANY (ARRAY['queued'::"text", 'running'::"text"]));


--
-- Name: partner_scope_time; Type: INDEX; Schema: partner; Owner: -
--

CREATE INDEX "partner_scope_time" ON "partner"."partner" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: payment_attempt_application; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_attempt_application" ON "payment"."attempt" USING "btree" ("application_hash", "intent_id", "requested_at" DESC) WHERE ("application_hash" IS NOT NULL);


--
-- Name: payment_attempt_intent_provider; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_attempt_intent_provider" ON "payment"."attempt" USING "btree" ("intent_id", "provider", "requested_at" DESC, "id" DESC);


--
-- Name: payment_intent_state; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_intent_state" ON "payment"."intent" USING "btree" ("state", "expires_at", "id");


--
-- Name: payment_intenttender_reference; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_intenttender_reference" ON "payment"."intenttender" USING "btree" ("kind", "reference_id") WHERE ("state" = ANY (ARRAY['planned'::"text", 'held'::"text"]));


--
-- Name: payment_intenttender_wechat; Type: INDEX; Schema: payment; Owner: -
--

CREATE UNIQUE INDEX "payment_intenttender_wechat" ON "payment"."intenttender" USING "btree" ("intent_id") WHERE ("kind" = 'wechat'::"text");


--
-- Name: payment_recoverycase_refund; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_recoverycase_refund" ON "payment"."recoverycase" USING "btree" ((("evidence" ->> 'refund'::"text"))) WHERE (("state" = 'open'::"text") AND ("evidence" ? 'refund'::"text"));


--
-- Name: payment_recoverycase_scope; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_recoverycase_scope" ON "payment"."recoverycase" USING "btree" ("scope_id", "state", "opened_at" DESC, "id" DESC);


--
-- Name: payment_recoveryrequest_case; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_recoveryrequest_case" ON "payment"."recoveryrequest" USING "btree" ("case_id", "created_at" DESC, "id" DESC);


--
-- Name: payment_refund_aftersale; Type: INDEX; Schema: payment; Owner: -
--

CREATE UNIQUE INDEX "payment_refund_aftersale" ON "payment"."refund" USING "btree" ("aftersale_id") WHERE ("aftersale_id" IS NOT NULL);


--
-- Name: payment_refund_state; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_refund_state" ON "payment"."refund" USING "btree" ("provider", "state", "id");


--
-- Name: payment_refundreceipt_scope; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_refundreceipt_scope" ON "payment"."refundreceipt" USING "btree" ("scope_id", "recorded_at" DESC, "refund_id");


--
-- Name: payment_refundtender_reference; Type: INDEX; Schema: payment; Owner: -
--

CREATE INDEX "payment_refundtender_reference" ON "payment"."refundtender" USING "btree" ("kind", "reference_id", "state");


--
-- Name: payment_refundtender_wechat; Type: INDEX; Schema: payment; Owner: -
--

CREATE UNIQUE INDEX "payment_refundtender_wechat" ON "payment"."refundtender" USING "btree" ("refund_id") WHERE ("kind" = 'wechat'::"text");


--
-- Name: pricing_price_lookup; Type: INDEX; Schema: pricing; Owner: -
--

CREATE INDEX "pricing_price_lookup" ON "pricing"."price" USING "btree" ("book_id", "sku_id", "effective_at" DESC);


--
-- Name: qualification_policy_scope_time; Type: INDEX; Schema: qualification; Owner: -
--

CREATE INDEX "qualification_policy_scope_time" ON "qualification"."policy" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: reporting_export_scope_time; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_export_scope_time" ON "reporting"."export" USING "btree" ("scope_id", "created_at" DESC, "id" DESC);


--
-- Name: reporting_export_state; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_export_state" ON "reporting"."export" USING "btree" ("state", "created_at") WHERE ("state" = ANY (ARRAY['queued'::"text", 'running'::"text"]));


--
-- Name: reporting_fact_query; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_fact_query" ON "reporting"."fact" USING "btree" ("scope_id", "metric_id", "period_end" DESC);


--
-- Name: reporting_fact_scope_application_period; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_fact_scope_application_period" ON "reporting"."fact" USING "btree" ("scope_id", (("dimensions" ->> 'application'::"text")), "period_end" DESC);


--
-- Name: reporting_fact_scope_period; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_fact_scope_period" ON "reporting"."fact" USING "btree" ("scope_id", "period_end" DESC, "metric_id", "metric_version");


--
-- Name: reporting_fact_scope_time; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_fact_scope_time" ON "reporting"."fact" USING "btree" ("scope_id", "period_end" DESC, "metric_id");


--
-- Name: reporting_finance_scope_export; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_finance_scope_export" ON "reporting"."financeprojection" USING "btree" ("scope_id", "statement_id");


--
-- Name: reporting_order_scope_export; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_order_scope_export" ON "reporting"."orderprojection" USING "btree" ("scope_id", "order_id");


--
-- Name: reporting_projection_aggregate; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_projection_aggregate" ON "reporting"."projectionevent" USING "btree" ("aggregate_id", "occurred_at", "event_id");


--
-- Name: reporting_watermark_staleness; Type: INDEX; Schema: reporting; Owner: -
--

CREATE INDEX "reporting_watermark_staleness" ON "reporting"."watermark" USING "btree" ("occurred_at", "scope_id", "projection");


--
-- Name: risk_case_decision; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_case_decision" ON "risk"."case" USING "btree" ("decision_id");


--
-- Name: risk_case_scope_state; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_case_scope_state" ON "risk"."case" USING "btree" ("scope_id", "state", "created_at" DESC, "id");


--
-- Name: risk_decision_actor; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_decision_actor" ON "risk"."decision" USING "btree" ("actor_id", "decided_at" DESC, "id");


--
-- Name: risk_decision_scope_time; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_decision_scope_time" ON "risk"."decision" USING "btree" ("scope_id", "decided_at" DESC, "id");


--
-- Name: risk_decision_velocity; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_decision_velocity" ON "risk"."decision" USING "btree" ("actor_id", "operation", "scope_id", "decided_at" DESC);


--
-- Name: risk_listentry_lookup; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_listentry_lookup" ON "risk"."listentry" USING "btree" ("scope_id", "list_type", "token", "effective_at", "expires_at");


--
-- Name: risk_policy_scope_id; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_policy_scope_id" ON "risk"."policy" USING "btree" ("scope_id", "id");


--
-- Name: risk_policy_scope_status; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_policy_scope_status" ON "risk"."policy" USING "btree" ("scope_id", "status", "id");


--
-- Name: risk_policyversion_state; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_policyversion_state" ON "risk"."policyversion" USING "btree" ("policy_id", "status", "version" DESC);


--
-- Name: risk_replay_state; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_replay_state" ON "risk"."replay" USING "btree" ("state", "created_at", "policy_id", "candidate_version");


--
-- Name: risk_signal_actor_time; Type: INDEX; Schema: risk; Owner: -
--

CREATE INDEX "risk_signal_actor_time" ON "risk"."signal" USING "btree" ("actor_id", "scope_id", "observed_at" DESC);


--
-- Name: runtime_contractcatalog_active; Type: INDEX; Schema: runtime; Owner: -
--

CREATE UNIQUE INDEX "runtime_contractcatalog_active" ON "runtime"."contractcatalog" USING "btree" ("artifact") WHERE ("status" = 'active'::"text");


--
-- Name: runtime_idempotency_expiry; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_idempotency_expiry" ON "runtime"."idempotency" USING "btree" ("expires_at", "state");


--
-- Name: runtime_inbox_operation_pending; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_inbox_operation_pending" ON "runtime"."inbox" USING "btree" ("operation", "received_at", "event_id") WHERE ("processed_at" IS NULL);


--
-- Name: runtime_inbox_pending; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_inbox_pending" ON "runtime"."inbox" USING "btree" ("consumer", "processed_at", "received_at", "event_id") WHERE ("processed_at" IS NULL);


--
-- Name: runtime_job_claim; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_job_claim" ON "runtime"."job" USING "btree" ("state", "available_at", "priority", "id");


--
-- Name: runtime_job_fenced_claim; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_job_fenced_claim" ON "runtime"."job" USING "btree" ("kind", "state", "priority", "available_at", "id");


--
-- Name: runtime_job_resource_lease; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_job_resource_lease" ON "runtime"."job" USING "btree" ("kind", (("payload" ->> 'resource'::"text"))) WHERE ("state" = ANY (ARRAY['queued'::"text", 'running'::"text"]));


--
-- Name: runtime_operation_owner_contract; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_operation_owner_contract" ON "runtime"."operation" USING "btree" ("owner", "contract_version", "id");


--
-- Name: runtime_outbox_claim; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_outbox_claim" ON "runtime"."outbox" USING "btree" ("published_at", "available_at", "id") WHERE ("published_at" IS NULL);


--
-- Name: runtime_outbox_delivery; Type: INDEX; Schema: runtime; Owner: -
--

CREATE INDEX "runtime_outbox_delivery" ON "runtime"."outbox" USING "btree" ("available_at", "aggregate_id", "aggregate_version", "id") WHERE (("published_at" IS NULL) AND ("failed_at" IS NULL));


--
-- Name: support_assignment_active; Type: INDEX; Schema: support; Owner: -
--

CREATE UNIQUE INDEX "support_assignment_active" ON "support"."assignment" USING "btree" ("ticket_id") WHERE ("released_at" IS NULL);


--
-- Name: support_case_queue; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_case_queue" ON "support"."ticket" USING "btree" ("scope_id", "state", "priority", "response_due_at", "id");


--
-- Name: support_case_scope_time; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_case_scope_time" ON "support"."ticket" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: support_conversation_scope_time; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_conversation_scope_time" ON "support"."conversation" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: support_escalation_once; Type: INDEX; Schema: support; Owner: -
--

CREATE UNIQUE INDEX "support_escalation_once" ON "support"."escalation" USING "btree" ("ticket_id", "reason");


--
-- Name: support_event_case_sequence; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_event_case_sequence" ON "support"."history" USING "btree" ("ticket_id", "sequence");


--
-- Name: support_history_ticket_sequence; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_history_ticket_sequence" ON "support"."history" USING "btree" ("ticket_id", "sequence");


--
-- Name: support_message_conversation_time; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_message_conversation_time" ON "support"."message" USING "btree" ("conversation_id", "created_at", "id");


--
-- Name: support_ticket_scope_time; Type: INDEX; Schema: support; Owner: -
--

CREATE INDEX "support_ticket_scope_time" ON "support"."ticket" USING "btree" ("scope_id", "updated_at" DESC, "id" DESC);


--
-- Name: verification_attempt_session_time; Type: INDEX; Schema: verification; Owner: -
--

CREATE INDEX "verification_attempt_session_time" ON "verification"."attempt" USING "btree" ("session_id", "attempted_at" DESC, "id" DESC);


--
-- Name: verification_device_scope_label; Type: INDEX; Schema: verification; Owner: -
--

CREATE INDEX "verification_device_scope_label" ON "verification"."device" USING "btree" ("scope_id", "label", "id");


--
-- Name: verification_session_expiry; Type: INDEX; Schema: verification; Owner: -
--

CREATE INDEX "verification_session_expiry" ON "verification"."session" USING "btree" ("state", "expires_at", "id");


--
-- Name: verification_session_subject_time; Type: INDEX; Schema: verification; Owner: -
--

CREATE INDEX "verification_session_subject_time" ON "verification"."session" USING "btree" ("subject_id", "expires_at" DESC, "id" DESC);


--
-- Name: voucher_allocation_scope; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_allocation_scope" ON "voucher"."allocation" USING "btree" ("scope_id", "cardpool_id");


--
-- Name: voucher_card_available; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_card_available" ON "voucher"."card" USING "btree" ("cardpool_id", "state", "id");


--
-- Name: voucher_cardpool_scope_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_cardpool_scope_read" ON "voucher"."cardpool" USING "btree" ("scope_id", "id");


--
-- Name: voucher_import_work; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_import_work" ON "voucher"."importjob" USING "btree" ("state", "updated_at", "id") WHERE ("state" = ANY (ARRAY['uploaded'::"text", 'validating'::"text", 'ready'::"text", 'running'::"text", 'reporting'::"text"]));


--
-- Name: voucher_issuebatch_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_issuebatch_read" ON "voucher"."issuebatch" USING "btree" ("created_at" DESC, "id" DESC);


--
-- Name: voucher_issuebatch_reserve; Type: INDEX; Schema: voucher; Owner: -
--

CREATE UNIQUE INDEX "voucher_issuebatch_reserve" ON "voucher"."issuebatch" USING "btree" ("reserve_request_id") WHERE ("reserve_request_id" IS NOT NULL);


--
-- Name: voucher_member_expiry; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_member_expiry" ON "voucher"."voucher" USING "btree" ("member_id", "expires_at", "id");


--
-- Name: voucher_program_expiry; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_program_expiry" ON "voucher"."voucher" USING "btree" ("program_id", "expires_at", "id");


--
-- Name: voucher_program_scope_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_program_scope_read" ON "voucher"."program" USING "btree" ("scope_id", "id");


--
-- Name: voucher_redemption_time; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_redemption_time" ON "voucher"."redemption" USING "btree" ("redeemed_at" DESC, "id" DESC);


--
-- Name: voucher_reserverequest_scope_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_reserverequest_scope_read" ON "voucher"."reserverequest" USING "btree" ("scope_id", "created_at" DESC, "id" DESC);


--
-- Name: voucher_state_expiry; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_state_expiry" ON "voucher"."voucher" USING "btree" ("state", "expires_at", "id");


--
-- Name: voucher_statusbatch_scope_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_statusbatch_scope_read" ON "voucher"."statusbatch" USING "btree" ("scope_id", "created_at" DESC, "id" DESC);


--
-- Name: voucher_statusevent_read; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_statusevent_read" ON "voucher"."statusevent" USING "btree" ("occurred_at" DESC, "voucher_id" DESC, "sequence" DESC);


--
-- Name: voucher_statusitem_work; Type: INDEX; Schema: voucher; Owner: -
--

CREATE INDEX "voucher_statusitem_work" ON "voucher"."statusitem" USING "btree" ("batch_id", "state", "voucher_id");


--
-- Name: recorddefault_pkey; Type: INDEX ATTACH; Schema: audit; Owner: -
--

ALTER INDEX "audit"."record_pkey" ATTACH PARTITION "audit"."recorddefault_pkey";


--
-- Name: recorddefault_scope_id_recorded_at_id_idx; Type: INDEX ATTACH; Schema: audit; Owner: -
--

ALTER INDEX "audit"."audit_scope_time" ATTACH PARTITION "audit"."recorddefault_scope_id_recorded_at_id_idx";


--
-- Name: recorddefault_scope_id_recorded_at_id_idx1; Type: INDEX ATTACH; Schema: audit; Owner: -
--

ALTER INDEX "audit"."audit_record_archive" ATTACH PARTITION "audit"."recorddefault_scope_id_recorded_at_id_idx1";


--
-- Name: recorddefault_scope_id_recorded_at_id_record_hash_idx; Type: INDEX ATTACH; Schema: audit; Owner: -
--

ALTER INDEX "audit"."audit_record_chain_lookup" ATTACH PARTITION "audit"."recorddefault_scope_id_recorded_at_id_record_hash_idx";


--
-- Name: attemptdefault_pkey; Type: INDEX ATTACH; Schema: notification; Owner: -
--

ALTER INDEX "notification"."attempt_pkey" ATTACH PARTITION "notification"."attemptdefault_pkey";


--
-- Name: membership membership_owner_integrity; Type: TRIGGER; Schema: access; Owner: -
--

CREATE CONSTRAINT TRIGGER "membership_owner_integrity" AFTER UPDATE OF "status", "organization_id", "client" ON "access"."membership" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "access"."assert_owner_integrity"();


--
-- Name: membershiprole membershiprole_bootstrap_ownership; Type: TRIGGER; Schema: access; Owner: -
--

CREATE TRIGGER "membershiprole_bootstrap_ownership" AFTER INSERT ON "access"."membershiprole" FOR EACH ROW EXECUTE FUNCTION "access"."sync_bootstrap_ownership"();


--
-- Name: membershiprole membershiprole_owner_integrity; Type: TRIGGER; Schema: access; Owner: -
--

CREATE CONSTRAINT TRIGGER "membershiprole_owner_integrity" AFTER INSERT OR DELETE OR UPDATE ON "access"."membershiprole" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "access"."assert_owner_integrity"();


--
-- Name: ownership ownership_integrity; Type: TRIGGER; Schema: access; Owner: -
--

CREATE CONSTRAINT TRIGGER "ownership_integrity" AFTER INSERT OR DELETE OR UPDATE ON "access"."ownership" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "access"."assert_owner_integrity"();


--
-- Name: role role_owner_integrity; Type: TRIGGER; Schema: access; Owner: -
--

CREATE CONSTRAINT TRIGGER "role_owner_integrity" AFTER INSERT OR DELETE OR UPDATE OF "kind", "status", "scope_id" ON "access"."role" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "access"."assert_owner_integrity"();


--
-- Name: accessrecord audit_access_chain; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "audit_access_chain" BEFORE INSERT ON "audit"."accessrecord" FOR EACH ROW EXECUTE FUNCTION "audit"."enforce_chain"();


--
-- Name: record audit_record_chain; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "audit_record_chain" BEFORE INSERT ON "audit"."record" FOR EACH ROW EXECUTE FUNCTION "audit"."enforce_chain"();


--
-- Name: accessrecord immutable; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "immutable" BEFORE DELETE OR UPDATE ON "audit"."accessrecord" FOR EACH ROW EXECUTE FUNCTION "audit"."reject_mutation"();


--
-- Name: archiveitem immutable; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "immutable" BEFORE DELETE OR UPDATE ON "audit"."archiveitem" FOR EACH ROW EXECUTE FUNCTION "audit"."reject_mutation"();


--
-- Name: archiveref immutable; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "immutable" BEFORE DELETE OR UPDATE ON "audit"."archiveref" FOR EACH ROW EXECUTE FUNCTION "audit"."reject_mutation"();


--
-- Name: record immutable; Type: TRIGGER; Schema: audit; Owner: -
--

CREATE TRIGGER "immutable" BEFORE DELETE OR UPDATE ON "audit"."record" FOR EACH ROW EXECUTE FUNCTION "audit"."reject_mutation"();


--
-- Name: installation extension_registry_sync; Type: TRIGGER; Schema: extension; Owner: -
--

CREATE TRIGGER "extension_registry_sync" AFTER INSERT OR UPDATE OF "status" ON "extension"."installation" FOR EACH ROW EXECUTE FUNCTION "extension"."sync_registry"();


--
-- Name: economicleg finance_economic_leg_immutable; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE TRIGGER "finance_economic_leg_immutable" BEFORE DELETE OR UPDATE ON "finance"."economicleg" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_economic_leg_mutation"();


--
-- Name: entry finance_entry_deferred_balance; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE CONSTRAINT TRIGGER "finance_entry_deferred_balance" AFTER INSERT ON "finance"."entry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance"."assert_journal_balance"();


--
-- Name: entry finance_entry_immutable; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE TRIGGER "finance_entry_immutable" BEFORE DELETE OR UPDATE ON "finance"."entry" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_ledger_mutation"();


--
-- Name: journal finance_journal_balance; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE TRIGGER "finance_journal_balance" BEFORE UPDATE OF "state" ON "finance"."journal" FOR EACH ROW EXECUTE FUNCTION "finance"."enforce_balanced_journal"();


--
-- Name: journal finance_journal_deferred_balance; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE CONSTRAINT TRIGGER "finance_journal_deferred_balance" AFTER INSERT ON "finance"."journal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance"."assert_journal_balance"();


--
-- Name: journal finance_journal_immutable; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE TRIGGER "finance_journal_immutable" BEFORE DELETE OR UPDATE ON "finance"."journal" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_ledger_mutation"();


--
-- Name: settlementline finance_settlementline_immutable; Type: TRIGGER; Schema: finance; Owner: -
--

CREATE TRIGGER "finance_settlementline_immutable" BEFORE DELETE OR UPDATE ON "finance"."settlementline" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_ledger_mutation"();


--
-- Name: federationtransaction federation_link_binding_guard; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "federation_link_binding_guard" BEFORE INSERT OR UPDATE OF "purpose", "link_principal_id", "link_membership_id" ON "identity"."federationtransaction" FOR EACH ROW EXECUTE FUNCTION "identity"."validate_federation_link_binding"();


--
-- Name: federationtransaction identity_federation_transition; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "identity_federation_transition" BEFORE UPDATE ON "identity"."federationtransaction" FOR EACH ROW EXECUTE FUNCTION "identity"."protect_federation_consumption"();


--
-- Name: invitation identity_invitation_membership_target; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "identity_invitation_membership_target" BEFORE INSERT OR UPDATE OF "membership_id", "target" ON "identity"."invitation" FOR EACH ROW EXECUTE FUNCTION "identity"."enforce_invitation_membership_target"();


--
-- Name: invitationreceipt identity_invitation_receipt_shape; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "identity_invitation_receipt_shape" BEFORE INSERT ON "identity"."invitationreceipt" FOR EACH ROW EXECUTE FUNCTION "identity"."protect_invitation_receipt_shape"();


--
-- Name: linkcase identity_linkcase_transition; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "identity_linkcase_transition" BEFORE UPDATE ON "identity"."linkcase" FOR EACH ROW EXECUTE FUNCTION "identity"."protect_linkcase_transition"();


--
-- Name: invitationreceipt invitationreceiptimmutable; Type: TRIGGER; Schema: identity; Owner: -
--

CREATE TRIGGER "invitationreceiptimmutable" BEFORE DELETE OR UPDATE ON "identity"."invitationreceipt" FOR EACH ROW EXECUTE FUNCTION "identity"."reject_invitationreceipt_mutation"();


--
-- Name: requestline invoice_requestline_immutable; Type: TRIGGER; Schema: invoice; Owner: -
--

CREATE TRIGGER "invoice_requestline_immutable" BEFORE DELETE OR UPDATE ON "invoice"."requestline" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_ledger_mutation"();


--
-- Name: requestprofile invoice_requestprofile_immutable; Type: TRIGGER; Schema: invoice; Owner: -
--

CREATE TRIGGER "invoice_requestprofile_immutable" BEFORE DELETE OR UPDATE ON "invoice"."requestprofile" FOR EACH ROW EXECUTE FUNCTION "finance"."reject_ledger_mutation"();


--
-- Name: line ordering_line_immutable; Type: TRIGGER; Schema: ordering; Owner: -
--

CREATE TRIGGER "ordering_line_immutable" BEFORE DELETE OR UPDATE ON "ordering"."line" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: orderrecord ordering_orderrecord_snapshot; Type: TRIGGER; Schema: ordering; Owner: -
--

CREATE TRIGGER "ordering_orderrecord_snapshot" BEFORE UPDATE ON "ordering"."orderrecord" FOR EACH ROW EXECUTE FUNCTION "ordering"."protect_order_snapshot"();


--
-- Name: capture payment_capture_immutable; Type: TRIGGER; Schema: payment; Owner: -
--

CREATE TRIGGER "payment_capture_immutable" BEFORE DELETE OR UPDATE ON "payment"."capture" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: observation payment_observation_immutable; Type: TRIGGER; Schema: payment; Owner: -
--

CREATE TRIGGER "payment_observation_immutable" BEFORE DELETE OR UPDATE ON "payment"."observation" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: refundreceipt payment_refundreceipt_immutable; Type: TRIGGER; Schema: payment; Owner: -
--

CREATE TRIGGER "payment_refundreceipt_immutable" BEFORE DELETE OR UPDATE ON "payment"."refundreceipt" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: quote pricing_quote_immutable; Type: TRIGGER; Schema: pricing; Owner: -
--

CREATE TRIGGER "pricing_quote_immutable" BEFORE DELETE OR UPDATE ON "pricing"."quote" FOR EACH ROW EXECUTE FUNCTION "pricing"."reject_quote_mutation"();


--
-- Name: watermark reporting_watermark_monotonic; Type: TRIGGER; Schema: reporting; Owner: -
--

CREATE TRIGGER "reporting_watermark_monotonic" BEFORE UPDATE ON "reporting"."watermark" FOR EACH ROW EXECUTE FUNCTION "reporting"."enforce_watermark"();


--
-- Name: outbox runtime_outbox_aggregate_version; Type: TRIGGER; Schema: runtime; Owner: -
--

CREATE TRIGGER "runtime_outbox_aggregate_version" BEFORE INSERT ON "runtime"."outbox" FOR EACH ROW EXECUTE FUNCTION "runtime"."assign_outbox_aggregate_version"();


--
-- Name: history support_history_immutable; Type: TRIGGER; Schema: support; Owner: -
--

CREATE TRIGGER "support_history_immutable" BEFORE DELETE OR UPDATE ON "support"."history" FOR EACH ROW EXECUTE FUNCTION "support"."reject_mutation"();


--
-- Name: message support_message_immutable; Type: TRIGGER; Schema: support; Owner: -
--

CREATE TRIGGER "support_message_immutable" BEFORE DELETE OR UPDATE ON "support"."message" FOR EACH ROW EXECUTE FUNCTION "support"."reject_mutation"();


--
-- Name: redemption voucher_redemption_immutable; Type: TRIGGER; Schema: voucher; Owner: -
--

CREATE TRIGGER "voucher_redemption_immutable" BEFORE DELETE OR UPDATE ON "voucher"."redemption" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: reversal voucher_reversal_immutable; Type: TRIGGER; Schema: voucher; Owner: -
--

CREATE TRIGGER "voucher_reversal_immutable" BEFORE DELETE OR UPDATE ON "voucher"."reversal" FOR EACH ROW EXECUTE FUNCTION "runtime"."reject_receipt_mutation"();


--
-- Name: actionproof actionproof_checker_membership_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_checker_membership_id_fkey" FOREIGN KEY ("checker_membership_id") REFERENCES "access"."membership"("id");


--
-- Name: actionproof actionproof_maker_membership_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_maker_membership_id_fkey" FOREIGN KEY ("maker_membership_id") REFERENCES "access"."membership"("id");


--
-- Name: actionproof actionproof_operation_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "runtime"."operation"("id");


--
-- Name: actionproof actionproof_permission_code_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."actionproof"
    ADD CONSTRAINT "actionproof_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "access"."permission"("code");


--
-- Name: membership membership_member_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membership"
    ADD CONSTRAINT "membership_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"."profile"("id");


--
-- Name: membershipoverride membershipoverride_permission_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membershipoverride"
    ADD CONSTRAINT "membershipoverride_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "access"."permission"("id");


--
-- Name: membershiprole membershiprole_role_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."membershiprole"
    ADD CONSTRAINT "membershiprole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access"."role"("id");


--
-- Name: ownership ownership_membership_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."ownership"
    ADD CONSTRAINT "ownership_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "access"."membership"("id");


--
-- Name: ownership ownership_role_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."ownership"
    ADD CONSTRAINT "ownership_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access"."role"("id");


--
-- Name: rolepermission rolepermission_permission_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."rolepermission"
    ADD CONSTRAINT "rolepermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "access"."permission"("id");


--
-- Name: rolepermission rolepermission_role_id_fkey; Type: FK CONSTRAINT; Schema: access; Owner: -
--

ALTER TABLE ONLY "access"."rolepermission"
    ADD CONSTRAINT "rolepermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access"."role"("id") ON DELETE CASCADE;


--
-- Name: archiveitem archiveitem_archive_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY "audit"."archiveitem"
    ADD CONSTRAINT "archiveitem_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "audit"."archiveref"("id");


--
-- Name: account account_finance_account_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."account"
    ADD CONSTRAINT "account_finance_account_id_fkey" FOREIGN KEY ("finance_account_id") REFERENCES "finance"."account"("id");


--
-- Name: action action_batch_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."action"
    ADD CONSTRAINT "action_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "benefit"."grantbatch"("id");


--
-- Name: budget budget_plan_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."budget"
    ADD CONSTRAINT "budget_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit"."plan"("id");


--
-- Name: grantbatch grantbatch_budget_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantbatch"
    ADD CONSTRAINT "grantbatch_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "benefit"."budget"("id");


--
-- Name: grantbatch grantbatch_plan_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantbatch"
    ADD CONSTRAINT "grantbatch_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit"."plan"("id");


--
-- Name: grantbatch grantbatch_plan_id_plan_version_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantbatch"
    ADD CONSTRAINT "grantbatch_plan_id_plan_version_fkey" FOREIGN KEY ("plan_id", "plan_version") REFERENCES "benefit"."planversion"("plan_id", "version");


--
-- Name: grantdecision grantdecision_batch_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantdecision"
    ADD CONSTRAINT "grantdecision_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "benefit"."grantbatch"("id");


--
-- Name: grantitem grantitem_batch_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."grantitem"
    ADD CONSTRAINT "grantitem_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "benefit"."grantbatch"("id");


--
-- Name: lot lot_account_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lot"
    ADD CONSTRAINT "lot_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "benefit"."account"("id");


--
-- Name: lot lot_batch_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lot"
    ADD CONSTRAINT "lot_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "benefit"."grantbatch"("id");


--
-- Name: lotmovement lotmovement_lot_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lotmovement"
    ADD CONSTRAINT "lotmovement_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "benefit"."lot"("id");


--
-- Name: lotmovement lotmovement_source_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."lotmovement"
    ADD CONSTRAINT "lotmovement_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "benefit"."lotmovement"("id");


--
-- Name: planversion planversion_plan_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."planversion"
    ADD CONSTRAINT "planversion_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit"."plan"("id");


--
-- Name: reminder reminder_lot_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reminder"
    ADD CONSTRAINT "reminder_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "benefit"."lot"("id");


--
-- Name: reservation reservation_account_id_fkey; Type: FK CONSTRAINT; Schema: benefit; Owner: -
--

ALTER TABLE ONLY "benefit"."reservation"
    ADD CONSTRAINT "reservation_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "benefit"."account"("id");


--
-- Name: dependency dependency_capability_id_fkey; Type: FK CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."dependency"
    ADD CONSTRAINT "dependency_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability"."capability"("id");


--
-- Name: dependency dependency_depends_on_id_fkey; Type: FK CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."dependency"
    ADD CONSTRAINT "dependency_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "capability"."capability"("id");


--
-- Name: entitlement entitlement_capability_id_fkey; Type: FK CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."entitlement"
    ADD CONSTRAINT "entitlement_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability"."capability"("id");


--
-- Name: operation operation_capability_id_fkey; Type: FK CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."operation"
    ADD CONSTRAINT "operation_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capability"."capability"("id") ON DELETE CASCADE;


--
-- Name: operation operation_operation_id_fkey; Type: FK CONSTRAINT; Schema: capability; Owner: -
--

ALTER TABLE ONLY "capability"."operation"
    ADD CONSTRAINT "operation_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "runtime"."operation"("id") ON DELETE CASCADE;


--
-- Name: item item_cart_id_fkey; Type: FK CONSTRAINT; Schema: cart; Owner: -
--

ALTER TABLE ONLY "cart"."item"
    ADD CONSTRAINT "item_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"."cart"("id") ON DELETE CASCADE;


--
-- Name: availabilitycity availabilitycity_zone_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilitycity"
    ADD CONSTRAINT "availabilitycity_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "catalog"."availabilityzone"("id");


--
-- Name: availabilityitem availabilityitem_zone_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."availabilityitem"
    ADD CONSTRAINT "availabilityitem_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "catalog"."availabilityzone"("id");


--
-- Name: category category_parent_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."category"
    ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."category"("id");


--
-- Name: classificationrule classificationrule_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."classificationrule"
    ADD CONSTRAINT "classificationrule_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."category"("id");


--
-- Name: importerror importerror_job_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."importerror"
    ADD CONSTRAINT "importerror_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "catalog"."importjob"("id") ON DELETE CASCADE;


--
-- Name: importrow importrow_job_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."importrow"
    ADD CONSTRAINT "importrow_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "catalog"."importjob"("id") ON DELETE CASCADE;


--
-- Name: listing listing_pool_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."listing"
    ADD CONSTRAINT "listing_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "catalog"."pool"("id");


--
-- Name: listing listing_sku_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."listing"
    ADD CONSTRAINT "listing_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "catalog"."sku"("id");


--
-- Name: poolbinding poolbinding_pool_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."poolbinding"
    ADD CONSTRAINT "poolbinding_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "catalog"."pool"("id");


--
-- Name: poolitem poolitem_pool_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."poolitem"
    ADD CONSTRAINT "poolitem_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "catalog"."pool"("id") ON DELETE CASCADE;


--
-- Name: poolitem poolitem_sku_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."poolitem"
    ADD CONSTRAINT "poolitem_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "catalog"."sku"("id");


--
-- Name: product product_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."product"
    ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."category"("id");


--
-- Name: review review_listing_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."review"
    ADD CONSTRAINT "review_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "catalog"."sourcelisting"("id");


--
-- Name: sku sku_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sku"
    ADD CONSTRAINT "sku_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."product"("id");


--
-- Name: sourcelisting sourcelisting_sku_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."sourcelisting"
    ADD CONSTRAINT "sourcelisting_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "catalog"."sku"("id");


--
-- Name: suppliercategory suppliercategory_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY "catalog"."suppliercategory"
    ADD CONSTRAINT "suppliercategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."category"("id");


--
-- Name: statement statement_connection_id_fkey; Type: FK CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."statement"
    ADD CONSTRAINT "statement_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel"."connection"("id");


--
-- Name: syncrun syncrun_connection_id_fkey; Type: FK CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."syncrun"
    ADD CONSTRAINT "syncrun_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel"."connection"("id");


--
-- Name: tenantbinding tenantbinding_distributor_id_fkey; Type: FK CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."tenantbinding"
    ADD CONSTRAINT "tenantbinding_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "channel"."distributor"("id");


--
-- Name: webhookinbox webhookinbox_connection_id_fkey; Type: FK CONSTRAINT; Schema: channel; Owner: -
--

ALTER TABLE ONLY "channel"."webhookinbox"
    ADD CONSTRAINT "webhookinbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "channel"."connection"("id");


--
-- Name: evidence evidence_checkout_id_fkey; Type: FK CONSTRAINT; Schema: checkout; Owner: -
--

ALTER TABLE ONLY "checkout"."evidence"
    ADD CONSTRAINT "evidence_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkout"."session"("id") ON DELETE CASCADE;


--
-- Name: application application_head_version_fk; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."application"
    ADD CONSTRAINT "application_head_version_fk" FOREIGN KEY ("head_version_id") REFERENCES "experience"."version"("id") DEFERRABLE INITIALLY DEFERRED;


--
-- Name: binding binding_application_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."binding"
    ADD CONSTRAINT "binding_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "experience"."application"("id");


--
-- Name: publication publication_application_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "experience"."application"("id");


--
-- Name: publication publication_release_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "experience"."release"("id");


--
-- Name: publication publication_version_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."publication"
    ADD CONSTRAINT "publication_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "experience"."version"("id");


--
-- Name: release release_application_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."release"
    ADD CONSTRAINT "release_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "experience"."application"("id");


--
-- Name: release release_version_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."release"
    ADD CONSTRAINT "release_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "experience"."version"("id");


--
-- Name: version version_application_id_fkey; Type: FK CONSTRAINT; Schema: experience; Owner: -
--

ALTER TABLE ONLY "experience"."version"
    ADD CONSTRAINT "version_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "experience"."application"("id");


--
-- Name: activationhistory activationhistory_installation_id_fkey; Type: FK CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."activationhistory"
    ADD CONSTRAINT "activationhistory_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "extension"."installation"("id");


--
-- Name: health health_installation_id_fkey; Type: FK CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."health"
    ADD CONSTRAINT "health_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "extension"."installation"("id");


--
-- Name: installation installation_extension_id_extension_version_fkey; Type: FK CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."installation"
    ADD CONSTRAINT "installation_extension_id_extension_version_fkey" FOREIGN KEY ("extension_id", "extension_version") REFERENCES "extension"."manifest"("id", "version");


--
-- Name: registry registry_installation_id_fkey; Type: FK CONSTRAINT; Schema: extension; Owner: -
--

ALTER TABLE ONLY "extension"."registry"
    ADD CONSTRAINT "registry_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "extension"."installation"("id");


--
-- Name: economicleg economicleg_journal_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."economicleg"
    ADD CONSTRAINT "economicleg_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "finance"."journal"("id");


--
-- Name: entry entry_account_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."entry"
    ADD CONSTRAINT "entry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."account"("id");


--
-- Name: entry entry_journal_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."entry"
    ADD CONSTRAINT "entry_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "finance"."journal"("id");


--
-- Name: hold hold_account_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."hold"
    ADD CONSTRAINT "hold_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."account"("id");


--
-- Name: periodclose periodclose_scope_id_period_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."periodclose"
    ADD CONSTRAINT "periodclose_scope_id_period_fkey" FOREIGN KEY ("scope_id", "period") REFERENCES "finance"."period"("scope_id", "period");


--
-- Name: reconciliationitem reconciliationitem_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliationitem"
    ADD CONSTRAINT "reconciliationitem_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."reconciliation"("id");


--
-- Name: reconciliationitem reconciliationitem_statement_line_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."reconciliationitem"
    ADD CONSTRAINT "reconciliationitem_statement_line_id_fkey" FOREIGN KEY ("statement_line_id") REFERENCES "finance"."statementline"("id");


--
-- Name: settlement settlement_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlement"
    ADD CONSTRAINT "settlement_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."reconciliation"("id");


--
-- Name: settlementadjustment settlementadjustment_settlement_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementadjustment"
    ADD CONSTRAINT "settlementadjustment_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."settlement"("id");


--
-- Name: settlementadjustment settlementadjustment_settlement_line_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementadjustment"
    ADD CONSTRAINT "settlementadjustment_settlement_line_id_fkey" FOREIGN KEY ("settlement_line_id") REFERENCES "finance"."settlementline"("id");


--
-- Name: settlementline settlementline_adjustment_of_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementline"
    ADD CONSTRAINT "settlementline_adjustment_of_fkey" FOREIGN KEY ("adjustment_of") REFERENCES "finance"."settlementline"("id");


--
-- Name: settlementline settlementline_reconciliation_item_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementline"
    ADD CONSTRAINT "settlementline_reconciliation_item_id_fkey" FOREIGN KEY ("reconciliation_item_id") REFERENCES "finance"."reconciliationitem"("id");


--
-- Name: settlementline settlementline_settlement_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."settlementline"
    ADD CONSTRAINT "settlementline_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."settlement"("id");


--
-- Name: split split_settlement_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."split"
    ADD CONSTRAINT "split_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."settlement"("id");


--
-- Name: statementline statementline_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."statementline"
    ADD CONSTRAINT "statementline_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."reconciliation"("id");


--
-- Name: withdrawal withdrawal_settlement_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY "finance"."withdrawal"
    ADD CONSTRAINT "withdrawal_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "finance"."settlement"("id");


--
-- Name: line line_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."line"
    ADD CONSTRAINT "line_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillment"."fulfillmentorder"("id");


--
-- Name: milestone milestone_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."milestone"
    ADD CONSTRAINT "milestone_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillment"."fulfillmentorder"("id");


--
-- Name: returnrecord returnrecord_fulfillment_id_fkey; Type: FK CONSTRAINT; Schema: fulfillment; Owner: -
--

ALTER TABLE ONLY "fulfillment"."returnrecord"
    ADD CONSTRAINT "returnrecord_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillment"."fulfillmentorder"("id");


--
-- Name: assurance assurance_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."assurance"
    ADD CONSTRAINT "assurance_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: authticket authticket_session_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."authticket"
    ADD CONSTRAINT "authticket_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "identity"."session"("id") ON DELETE CASCADE;


--
-- Name: challenge challenge_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challenge"
    ADD CONSTRAINT "challenge_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: challengedelivery challengedelivery_challenge_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challengedelivery"
    ADD CONSTRAINT "challengedelivery_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "identity"."challenge"("id") ON DELETE CASCADE;


--
-- Name: challengesecret challengesecret_challenge_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."challengesecret"
    ADD CONSTRAINT "challengesecret_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "identity"."challenge"("id") ON DELETE CASCADE;


--
-- Name: credential credential_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."credential"
    ADD CONSTRAINT "credential_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: federatedidentity federatedidentity_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federatedidentity"
    ADD CONSTRAINT "federatedidentity_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: federatedidentity federatedidentity_provider_instance_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federatedidentity"
    ADD CONSTRAINT "federatedidentity_provider_instance_id_fkey" FOREIGN KEY ("provider_instance_id") REFERENCES "identity"."provider"("id");


--
-- Name: federationtransaction federationtransaction_link_membership_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federationtransaction"
    ADD CONSTRAINT "federationtransaction_link_membership_id_fkey" FOREIGN KEY ("link_membership_id") REFERENCES "access"."membership"("id");


--
-- Name: federationtransaction federationtransaction_link_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federationtransaction"
    ADD CONSTRAINT "federationtransaction_link_principal_id_fkey" FOREIGN KEY ("link_principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: federationtransaction federationtransaction_provider_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."federationtransaction"
    ADD CONSTRAINT "federationtransaction_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity"."provider"("id");


--
-- Name: invitation invitation_membership_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "access"."membership"("id");


--
-- Name: invitation invitation_organization_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: invitation invitation_policy_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "identity"."registrationpolicy"("id");


--
-- Name: invitation invitation_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitation"
    ADD CONSTRAINT "invitation_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: invitationclaim invitationclaim_invitation_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationclaim"
    ADD CONSTRAINT "invitationclaim_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "identity"."invitation"("id");


--
-- Name: invitationreceipt invitationreceipt_invitation_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "identity"."invitation"("id");


--
-- Name: invitationreceipt invitationreceipt_membership_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "access"."membership"("id");


--
-- Name: invitationreceipt invitationreceipt_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: invitationreceipt invitationreceipt_session_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."invitationreceipt"
    ADD CONSTRAINT "invitationreceipt_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "identity"."session"("id");


--
-- Name: linkcase linkcase_candidate_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."linkcase"
    ADD CONSTRAINT "linkcase_candidate_principal_id_fkey" FOREIGN KEY ("candidate_principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: linkcase linkcase_organization_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."linkcase"
    ADD CONSTRAINT "linkcase_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: linkcase linkcase_provider_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."linkcase"
    ADD CONSTRAINT "linkcase_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity"."provider"("id");


--
-- Name: linkcase linkcase_transaction_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."linkcase"
    ADD CONSTRAINT "linkcase_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "identity"."federationtransaction"("id");


--
-- Name: preauth preauth_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."preauth"
    ADD CONSTRAINT "preauth_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: preauth preauth_transaction_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."preauth"
    ADD CONSTRAINT "preauth_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "identity"."federationtransaction"("id");


--
-- Name: providerhealth providerhealth_provider_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."providerhealth"
    ADD CONSTRAINT "providerhealth_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity"."provider"("id") ON DELETE CASCADE;


--
-- Name: providersecretrotation providersecretrotation_provider_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."providersecretrotation"
    ADD CONSTRAINT "providersecretrotation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity"."provider"("id");


--
-- Name: session session_membership_fk; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."session"
    ADD CONSTRAINT "session_membership_fk" FOREIGN KEY ("membership_id") REFERENCES "access"."membership"("id");


--
-- Name: session session_principal_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."session"
    ADD CONSTRAINT "session_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "identity"."principal"("id");


--
-- Name: wechatgrant wechatgrant_identity_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY "identity"."wechatgrant"
    ADD CONSTRAINT "wechatgrant_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identity"."federatedidentity"("id") ON DELETE CASCADE;


--
-- Name: cutoverreview cutoverreview_stockitem_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."cutoverreview"
    ADD CONSTRAINT "cutoverreview_stockitem_id_fkey" FOREIGN KEY ("stockitem_id") REFERENCES "inventory"."stockitem"("id");


--
-- Name: importerror importerror_job_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."importerror"
    ADD CONSTRAINT "importerror_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "inventory"."importjob"("id") ON DELETE CASCADE;


--
-- Name: importrow importrow_job_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."importrow"
    ADD CONSTRAINT "importrow_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "inventory"."importjob"("id") ON DELETE CASCADE;


--
-- Name: movement movement_stockitem_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."movement"
    ADD CONSTRAINT "movement_stockitem_id_fkey" FOREIGN KEY ("stockitem_id") REFERENCES "inventory"."stockitem"("id");


--
-- Name: observation observation_stockitem_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."observation"
    ADD CONSTRAINT "observation_stockitem_id_fkey" FOREIGN KEY ("stockitem_id") REFERENCES "inventory"."stockitem"("id");


--
-- Name: reservation reservation_stockitem_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."reservation"
    ADD CONSTRAINT "reservation_stockitem_id_fkey" FOREIGN KEY ("stockitem_id") REFERENCES "inventory"."stockitem"("id");


--
-- Name: snapshot snapshot_stockitem_id_fkey; Type: FK CONSTRAINT; Schema: inventory; Owner: -
--

ALTER TABLE ONLY "inventory"."snapshot"
    ADD CONSTRAINT "snapshot_stockitem_id_fkey" FOREIGN KEY ("stockitem_id") REFERENCES "inventory"."stockitem"("id");


--
-- Name: document document_red_of_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."document"
    ADD CONSTRAINT "document_red_of_id_fkey" FOREIGN KEY ("red_of_id") REFERENCES "invoice"."document"("id");


--
-- Name: document document_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."document"
    ADD CONSTRAINT "document_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "invoice"."request"("id");


--
-- Name: line line_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."line"
    ADD CONSTRAINT "line_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "invoice"."request"("id");


--
-- Name: line line_source_line_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."line"
    ADD CONSTRAINT "line_source_line_id_fkey" FOREIGN KEY ("source_line_id") REFERENCES "finance"."settlementline"("id");


--
-- Name: request request_profile_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."request"
    ADD CONSTRAINT "request_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "invoice"."profile"("id");


--
-- Name: request request_red_of_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."request"
    ADD CONSTRAINT "request_red_of_request_id_fkey" FOREIGN KEY ("red_of_request_id") REFERENCES "invoice"."request"("id");


--
-- Name: requestline requestline_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestline"
    ADD CONSTRAINT "requestline_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "invoice"."request"("id");


--
-- Name: requestline requestline_settlement_line_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestline"
    ADD CONSTRAINT "requestline_settlement_line_id_fkey" FOREIGN KEY ("settlement_line_id") REFERENCES "finance"."settlementline"("id");


--
-- Name: requestprofile requestprofile_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."requestprofile"
    ADD CONSTRAINT "requestprofile_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "invoice"."request"("id");


--
-- Name: statusevent statusevent_request_id_fkey; Type: FK CONSTRAINT; Schema: invoice; Owner: -
--

ALTER TABLE ONLY "invoice"."statusevent"
    ADD CONSTRAINT "statusevent_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "invoice"."request"("id");


--
-- Name: redemption redemption_campaign_id_fkey; Type: FK CONSTRAINT; Schema: marketing; Owner: -
--

ALTER TABLE ONLY "marketing"."redemption"
    ADD CONSTRAINT "redemption_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing"."campaign"("id");


--
-- Name: importerror importerror_job_id_fkey; Type: FK CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."importerror"
    ADD CONSTRAINT "importerror_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "member"."importjob"("id") ON DELETE CASCADE;


--
-- Name: importrow importrow_job_id_fkey; Type: FK CONSTRAINT; Schema: member; Owner: -
--

ALTER TABLE ONLY "member"."importrow"
    ADD CONSTRAINT "importrow_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "member"."importjob"("id") ON DELETE CASCADE;


--
-- Name: attempt notification_attempt_dispatch_fkey; Type: FK CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE "notification"."attempt"
    ADD CONSTRAINT "notification_attempt_dispatch_fkey" FOREIGN KEY ("scope_id", "dispatch_id") REFERENCES "notification"."dispatch"("scope_id", "id");


--
-- Name: dispatch notification_dispatch_template_fkey; Type: FK CONSTRAINT; Schema: notification; Owner: -
--

ALTER TABLE ONLY "notification"."dispatch"
    ADD CONSTRAINT "notification_dispatch_template_fkey" FOREIGN KEY ("scope_id", "template_id", "channel") REFERENCES "notification"."template"("scope_id", "id", "channel");


--
-- Name: aftersale aftersale_line_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."aftersale"
    ADD CONSTRAINT "aftersale_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "ordering"."line"("id");


--
-- Name: aftersale aftersale_order_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."aftersale"
    ADD CONSTRAINT "aftersale_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orderrecord"("id");


--
-- Name: line line_order_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."line"
    ADD CONSTRAINT "line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orderrecord"("id");


--
-- Name: reminder reminder_order_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."reminder"
    ADD CONSTRAINT "reminder_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orderrecord"("id");


--
-- Name: reviewaction reviewaction_aftersale_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."reviewaction"
    ADD CONSTRAINT "reviewaction_aftersale_id_fkey" FOREIGN KEY ("aftersale_id") REFERENCES "ordering"."aftersale"("id");


--
-- Name: stateevent stateevent_order_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."stateevent"
    ADD CONSTRAINT "stateevent_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orderrecord"("id");


--
-- Name: suborder suborder_order_id_fkey; Type: FK CONSTRAINT; Schema: ordering; Owner: -
--

ALTER TABLE ONLY "ordering"."suborder"
    ADD CONSTRAINT "suborder_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orderrecord"("id");


--
-- Name: assignment assignment_child_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."assignment"
    ADD CONSTRAINT "assignment_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "organization"."organization"("id");


--
-- Name: assignment assignment_parent_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."assignment"
    ADD CONSTRAINT "assignment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization"."organization"("id");


--
-- Name: change change_organization_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."change"
    ADD CONSTRAINT "change_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: directoryconnection directoryconnection_organization_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryconnection"
    ADD CONSTRAINT "directoryconnection_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: directoryconnection directoryconnection_provider_instance_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryconnection"
    ADD CONSTRAINT "directoryconnection_provider_instance_id_fkey" FOREIGN KEY ("provider_instance_id") REFERENCES "identity"."provider"("id");


--
-- Name: directoryconnection directoryconnection_provider_reference; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryconnection"
    ADD CONSTRAINT "directoryconnection_provider_reference" FOREIGN KEY ("provider_instance_id", "tenant_id", "provider_type", "secret_ref", "provider_status") REFERENCES "identity"."provider"("id", "tenant_id", "type", "secret_ref", "status") ON UPDATE CASCADE;


--
-- Name: directoryinbox directoryinbox_connection_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directoryinbox"
    ADD CONSTRAINT "directoryinbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization"."directoryconnection"("id");


--
-- Name: directorymembership directorymembership_connection_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorymembership"
    ADD CONSTRAINT "directorymembership_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization"."directoryconnection"("id");


--
-- Name: directorymembership directorymembership_organization_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorymembership"
    ADD CONSTRAINT "directorymembership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: directorymembership directorymembership_subject_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorymembership"
    ADD CONSTRAINT "directorymembership_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "organization"."directorysubject"("id");


--
-- Name: directorysubject directorysubject_connection_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."directorysubject"
    ADD CONSTRAINT "directorysubject_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization"."directoryconnection"("id");


--
-- Name: organization organization_parent_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."organization"
    ADD CONSTRAINT "organization_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization"."organization"("id");


--
-- Name: sourcebinding sourcebinding_organization_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."sourcebinding"
    ADD CONSTRAINT "sourcebinding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: syncrun syncrun_connection_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."syncrun"
    ADD CONSTRAINT "syncrun_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization"."directoryconnection"("id");


--
-- Name: unitclosure unitclosure_ancestor_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."unitclosure"
    ADD CONSTRAINT "unitclosure_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "organization"."organization"("id") ON DELETE CASCADE;


--
-- Name: unitclosure unitclosure_descendant_id_fkey; Type: FK CONSTRAINT; Schema: organization; Owner: -
--

ALTER TABLE ONLY "organization"."unitclosure"
    ADD CONSTRAINT "unitclosure_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "organization"."organization"("id") ON DELETE CASCADE;


--
-- Name: agreement agreement_partner_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."agreement"
    ADD CONSTRAINT "agreement_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"."partner"("id");


--
-- Name: brand brand_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."brand"
    ADD CONSTRAINT "brand_id_fkey" FOREIGN KEY ("id") REFERENCES "partner"."partner"("id");


--
-- Name: brand brand_owner_partner_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."brand"
    ADD CONSTRAINT "brand_owner_partner_id_fkey" FOREIGN KEY ("owner_partner_id") REFERENCES "partner"."partner"("id");


--
-- Name: qualificationdocument qualificationdocument_partner_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."qualificationdocument"
    ADD CONSTRAINT "qualificationdocument_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"."partner"("id");


--
-- Name: relationship relationship_left_partner_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."relationship"
    ADD CONSTRAINT "relationship_left_partner_id_fkey" FOREIGN KEY ("left_partner_id") REFERENCES "partner"."partner"("id");


--
-- Name: relationship relationship_right_partner_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."relationship"
    ADD CONSTRAINT "relationship_right_partner_id_fkey" FOREIGN KEY ("right_partner_id") REFERENCES "partner"."partner"("id");


--
-- Name: servicebinding servicebinding_organization_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."servicebinding"
    ADD CONSTRAINT "servicebinding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organization"("id");


--
-- Name: servicebinding servicebinding_store_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."servicebinding"
    ADD CONSTRAINT "servicebinding_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "partner"."store"("id");


--
-- Name: store store_id_fkey; Type: FK CONSTRAINT; Schema: partner; Owner: -
--

ALTER TABLE ONLY "partner"."store"
    ADD CONSTRAINT "store_id_fkey" FOREIGN KEY ("id") REFERENCES "partner"."partner"("id");


--
-- Name: allocation allocation_payment_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."allocation"
    ADD CONSTRAINT "allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"."payment"("id");


--
-- Name: attempt attempt_intent_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."attempt"
    ADD CONSTRAINT "attempt_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment"."intent"("id");


--
-- Name: attempt attempt_tender_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."attempt"
    ADD CONSTRAINT "attempt_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "payment"."tender"("id");


--
-- Name: intenttender intenttender_intent_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."intenttender"
    ADD CONSTRAINT "intenttender_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment"."intent"("id") ON DELETE CASCADE;


--
-- Name: observation observation_attempt_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."observation"
    ADD CONSTRAINT "observation_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "payment"."attempt"("id");


--
-- Name: payment payment_intent_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."payment"
    ADD CONSTRAINT "payment_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment"."intent"("id");


--
-- Name: prepay prepay_intent_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."prepay"
    ADD CONSTRAINT "prepay_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment"."intent"("id");


--
-- Name: recoveryrequest recoveryrequest_case_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."recoveryrequest"
    ADD CONSTRAINT "recoveryrequest_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "payment"."recoverycase"("id");


--
-- Name: refund refund_aftersale_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_aftersale_id_fkey" FOREIGN KEY ("aftersale_id") REFERENCES "ordering"."aftersale"("id");


--
-- Name: refund refund_payment_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refund"
    ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"."payment"("id");


--
-- Name: refundcommand refundcommand_refund_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundcommand"
    ADD CONSTRAINT "refundcommand_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "payment"."refund"("id");


--
-- Name: refundreceipt refundreceipt_provider_attempt_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundreceipt"
    ADD CONSTRAINT "refundreceipt_provider_attempt_id_fkey" FOREIGN KEY ("provider_attempt_id") REFERENCES "payment"."providerattempt"("id");


--
-- Name: refundreceipt refundreceipt_refund_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundreceipt"
    ADD CONSTRAINT "refundreceipt_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "payment"."refund"("id");


--
-- Name: refundtender refundtender_refund_id_fkey; Type: FK CONSTRAINT; Schema: payment; Owner: -
--

ALTER TABLE ONLY "payment"."refundtender"
    ADD CONSTRAINT "refundtender_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "payment"."refund"("id") ON DELETE CASCADE;


--
-- Name: price price_book_id_fkey; Type: FK CONSTRAINT; Schema: pricing; Owner: -
--

ALTER TABLE ONLY "pricing"."price"
    ADD CONSTRAINT "price_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "pricing"."pricebook"("id");


--
-- Name: changerequest changerequest_policy_id_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."changerequest"
    ADD CONSTRAINT "changerequest_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "qualification"."policy"("id");


--
-- Name: evidence evidence_policy_id_policy_version_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."evidence"
    ADD CONSTRAINT "evidence_policy_id_policy_version_fkey" FOREIGN KEY ("policy_id", "policy_version") REFERENCES "qualification"."policyversion"("policy_id", "version");


--
-- Name: policyversion policyversion_policy_id_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."policyversion"
    ADD CONSTRAINT "policyversion_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "qualification"."policy"("id");


--
-- Name: purchaselimit purchaselimit_policy_id_policy_version_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."purchaselimit"
    ADD CONSTRAINT "purchaselimit_policy_id_policy_version_fkey" FOREIGN KEY ("policy_id", "policy_version") REFERENCES "qualification"."policyversion"("policy_id", "version");


--
-- Name: resource resource_policy_id_policy_version_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."resource"
    ADD CONSTRAINT "resource_policy_id_policy_version_fkey" FOREIGN KEY ("policy_id", "policy_version") REFERENCES "qualification"."policyversion"("policy_id", "version");


--
-- Name: subject subject_policy_id_policy_version_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."subject"
    ADD CONSTRAINT "subject_policy_id_policy_version_fkey" FOREIGN KEY ("policy_id", "policy_version") REFERENCES "qualification"."policyversion"("policy_id", "version");


--
-- Name: tag tag_member_id_fkey; Type: FK CONSTRAINT; Schema: qualification; Owner: -
--

ALTER TABLE ONLY "qualification"."tag"
    ADD CONSTRAINT "tag_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "qualification"."profile"("member_id");


--
-- Name: fact fact_metric_id_metric_version_fkey; Type: FK CONSTRAINT; Schema: reporting; Owner: -
--

ALTER TABLE ONLY "reporting"."fact"
    ADD CONSTRAINT "fact_metric_id_metric_version_fkey" FOREIGN KEY ("metric_id", "metric_version") REFERENCES "reporting"."metric"("id", "version");


--
-- Name: case case_decision_id_fkey; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."case"
    ADD CONSTRAINT "case_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "risk"."decision"("id");


--
-- Name: decision decision_policy_id_policy_version_fkey; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."decision"
    ADD CONSTRAINT "decision_policy_id_policy_version_fkey" FOREIGN KEY ("policy_id", "policy_version") REFERENCES "risk"."policyversion"("policy_id", "version");


--
-- Name: policyversion policyversion_policy_id_fkey; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policyversion"
    ADD CONSTRAINT "policyversion_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "risk"."policy"("id");


--
-- Name: replay replay_policy_id_candidate_version_fkey; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."replay"
    ADD CONSTRAINT "replay_policy_id_candidate_version_fkey" FOREIGN KEY ("policy_id", "candidate_version") REFERENCES "risk"."policyversion"("policy_id", "version");


--
-- Name: policy risk_policy_activeversion; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policy"
    ADD CONSTRAINT "risk_policy_activeversion" FOREIGN KEY ("id", "active_version") REFERENCES "risk"."policyversion"("policy_id", "version");


--
-- Name: policy risk_policy_baselineversion; Type: FK CONSTRAINT; Schema: risk; Owner: -
--

ALTER TABLE ONLY "risk"."policy"
    ADD CONSTRAINT "risk_policy_baselineversion" FOREIGN KEY ("id", "baseline_version") REFERENCES "risk"."policyversion"("policy_id", "version");


--
-- Name: inbox inbox_event_contract_fk; Type: FK CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."inbox"
    ADD CONSTRAINT "inbox_event_contract_fk" FOREIGN KEY ("event_type", "event_version") REFERENCES "runtime"."event"("type", "version");


--
-- Name: outbox outbox_event_contract_fk; Type: FK CONSTRAINT; Schema: runtime; Owner: -
--

ALTER TABLE ONLY "runtime"."outbox"
    ADD CONSTRAINT "outbox_event_contract_fk" FOREIGN KEY ("event_type", "event_version") REFERENCES "runtime"."event"("type", "version");


--
-- Name: assignment assignment_case_id_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."assignment"
    ADD CONSTRAINT "assignment_case_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support"."ticket"("id");


--
-- Name: history caseevent_case_id_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."history"
    ADD CONSTRAINT "caseevent_case_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support"."ticket"("id");


--
-- Name: escalation escalation_case_id_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."escalation"
    ADD CONSTRAINT "escalation_case_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support"."ticket"("id");


--
-- Name: evidence evidence_conversation_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."evidence"
    ADD CONSTRAINT "evidence_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support"."conversation"("id");


--
-- Name: message message_conversation_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."message"
    ADD CONSTRAINT "message_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support"."conversation"("id");


--
-- Name: ticket ticket_conversation_fkey; Type: FK CONSTRAINT; Schema: support; Owner: -
--

ALTER TABLE ONLY "support"."ticket"
    ADD CONSTRAINT "ticket_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support"."conversation"("id");


--
-- Name: attempt attempt_device_id_fkey; Type: FK CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."attempt"
    ADD CONSTRAINT "attempt_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "verification"."device"("id");


--
-- Name: attempt attempt_session_id_fkey; Type: FK CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."attempt"
    ADD CONSTRAINT "attempt_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "verification"."session"("id");


--
-- Name: nonce nonce_session_id_fkey; Type: FK CONSTRAINT; Schema: verification; Owner: -
--

ALTER TABLE ONLY "verification"."nonce"
    ADD CONSTRAINT "nonce_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "verification"."session"("id") ON DELETE CASCADE;


--
-- Name: allocation allocation_cardpool_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."allocation"
    ADD CONSTRAINT "allocation_cardpool_id_fkey" FOREIGN KEY ("cardpool_id") REFERENCES "voucher"."cardpool"("id");


--
-- Name: approval approval_request_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."approval"
    ADD CONSTRAINT "approval_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "voucher"."reserverequest"("id");


--
-- Name: card card_allocated_batch_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."card"
    ADD CONSTRAINT "card_allocated_batch_id_fkey" FOREIGN KEY ("allocated_batch_id") REFERENCES "voucher"."issuebatch"("id");


--
-- Name: card card_cardpool_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."card"
    ADD CONSTRAINT "card_cardpool_id_fkey" FOREIGN KEY ("cardpool_id") REFERENCES "voucher"."cardpool"("id");


--
-- Name: hold hold_voucher_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."hold"
    ADD CONSTRAINT "hold_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"."voucher"("id");


--
-- Name: importerror importerror_job_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importerror"
    ADD CONSTRAINT "importerror_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "voucher"."importjob"("id") ON DELETE CASCADE;


--
-- Name: importjob importjob_cardpool_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importjob"
    ADD CONSTRAINT "importjob_cardpool_id_fkey" FOREIGN KEY ("cardpool_id") REFERENCES "voucher"."cardpool"("id");


--
-- Name: importrow importrow_job_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."importrow"
    ADD CONSTRAINT "importrow_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "voucher"."importjob"("id") ON DELETE CASCADE;


--
-- Name: issuebatch issuebatch_cardpool_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."issuebatch"
    ADD CONSTRAINT "issuebatch_cardpool_id_fkey" FOREIGN KEY ("cardpool_id") REFERENCES "voucher"."cardpool"("id");


--
-- Name: issuebatch issuebatch_program_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."issuebatch"
    ADD CONSTRAINT "issuebatch_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "voucher"."program"("id");


--
-- Name: issuebatch issuebatch_program_id_program_version_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."issuebatch"
    ADD CONSTRAINT "issuebatch_program_id_program_version_fkey" FOREIGN KEY ("program_id", "program_version") REFERENCES "voucher"."programversion"("program_id", "version");


--
-- Name: issuebatch issuebatch_reserve_request_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."issuebatch"
    ADD CONSTRAINT "issuebatch_reserve_request_id_fkey" FOREIGN KEY ("reserve_request_id") REFERENCES "voucher"."reserverequest"("id");


--
-- Name: programversion programversion_program_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."programversion"
    ADD CONSTRAINT "programversion_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "voucher"."program"("id");


--
-- Name: redemption redemption_voucher_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."redemption"
    ADD CONSTRAINT "redemption_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"."voucher"("id");


--
-- Name: reserve reserve_voucher_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserve"
    ADD CONSTRAINT "reserve_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"."voucher"("id");


--
-- Name: reserverequest reserverequest_program_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserverequest"
    ADD CONSTRAINT "reserverequest_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "voucher"."program"("id");


--
-- Name: reserverequest reserverequest_program_id_program_version_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reserverequest"
    ADD CONSTRAINT "reserverequest_program_id_program_version_fkey" FOREIGN KEY ("program_id", "program_version") REFERENCES "voucher"."programversion"("program_id", "version");


--
-- Name: reversal reversal_redemption_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."reversal"
    ADD CONSTRAINT "reversal_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "voucher"."redemption"("id");


--
-- Name: statusevent statusevent_voucher_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."statusevent"
    ADD CONSTRAINT "statusevent_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "voucher"."voucher"("id");


--
-- Name: statusitem statusitem_batch_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."statusitem"
    ADD CONSTRAINT "statusitem_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "voucher"."statusbatch"("id");


--
-- Name: voucher voucher_batch_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "voucher"."issuebatch"("id");


--
-- Name: voucher voucher_card_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "voucher"."card"("id");


--
-- Name: voucher voucher_program_id_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "voucher"."program"("id");


--
-- Name: voucher voucher_program_id_program_version_fkey; Type: FK CONSTRAINT; Schema: voucher; Owner: -
--

ALTER TABLE ONLY "voucher"."voucher"
    ADD CONSTRAINT "voucher_program_id_program_version_fkey" FOREIGN KEY ("program_id", "program_version") REFERENCES "voucher"."programversion"("program_id", "version");


--
-- Name: actionproof; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."actionproof" ENABLE ROW LEVEL SECURITY;

--
-- Name: actionproof actionproofjob; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "actionproofjob" ON "access"."actionproof" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: decisionaudit appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."decisionaudit" TO "shopapp" USING (((("scope_id" IS NULL) AND ("actor_id" = NULLIF("current_setting"('app.actor_id'::"text", true), ''::"text"))) OR "access"."scope_allowed"("scope_id"))) WITH CHECK (((("scope_id" IS NULL) AND ("actor_id" = NULLIF("current_setting"('app.actor_id'::"text", true), ''::"text"))) OR "access"."scope_allowed"("scope_id")));


--
-- Name: membership appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."membership" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: membershipoverride appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."membershipoverride" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: membershiprole appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."membershiprole" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: permission appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."permission" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: role appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."role" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: rolepermission appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."rolepermission" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: scopegrant appscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "appscope" ON "access"."scopegrant" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: decisionaudit; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."decisionaudit" ENABLE ROW LEVEL SECURITY;

--
-- Name: decisionaudit jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."decisionaudit" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: membership jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."membership" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: membershipoverride jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."membershipoverride" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: membershiprole jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."membershiprole" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: permission jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."permission" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: role jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."role" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: rolepermission jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."rolepermission" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: scopegrant jobscope; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "jobscope" ON "access"."scopegrant" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: membership; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."membership" ENABLE ROW LEVEL SECURITY;

--
-- Name: membershipoverride; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."membershipoverride" ENABLE ROW LEVEL SECURITY;

--
-- Name: membershiprole; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."membershiprole" ENABLE ROW LEVEL SECURITY;

--
-- Name: ownership; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."ownership" ENABLE ROW LEVEL SECURITY;

--
-- Name: ownership ownershipapp; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "ownershipapp" ON "access"."ownership" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: ownership ownershipjob; Type: POLICY; Schema: access; Owner: -
--

CREATE POLICY "ownershipjob" ON "access"."ownership" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: permission; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."permission" ENABLE ROW LEVEL SECURITY;

--
-- Name: role; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."role" ENABLE ROW LEVEL SECURITY;

--
-- Name: rolepermission; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."rolepermission" ENABLE ROW LEVEL SECURITY;

--
-- Name: scopegrant; Type: ROW SECURITY; Schema: access; Owner: -
--

ALTER TABLE "access"."scopegrant" ENABLE ROW LEVEL SECURITY;

--
-- Name: accessrecord; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."accessrecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: accessrecord appinsert; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appinsert" ON "audit"."accessrecord" FOR INSERT TO "shopapp" WITH CHECK ("audit"."scope_allowed"("scope_id"));


--
-- Name: record appinsert; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appinsert" ON "audit"."record" FOR INSERT TO "shopapp" WITH CHECK ("audit"."scope_allowed"("scope_id"));


--
-- Name: recorddefault appinsert; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appinsert" ON "audit"."recorddefault" FOR INSERT TO "shopapp" WITH CHECK ("audit"."scope_allowed"("scope_id"));


--
-- Name: accessrecord appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."accessrecord" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: archiveitem appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."archiveitem" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: archiveref appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."archiveref" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: record appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."record" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: recorddefault appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."recorddefault" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: retention appselect; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "appselect" ON "audit"."retention" FOR SELECT TO "shopapp" USING ("audit"."scope_allowed"("scope_id"));


--
-- Name: archiveitem; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."archiveitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: archiveref; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."archiveref" ENABLE ROW LEVEL SECURITY;

--
-- Name: archiveitem joball; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "joball" ON "audit"."archiveitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: accessrecord jobscope; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "jobscope" ON "audit"."accessrecord" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: archiveref jobscope; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "jobscope" ON "audit"."archiveref" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: record jobscope; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "jobscope" ON "audit"."record" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: recorddefault jobscope; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "jobscope" ON "audit"."recorddefault" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: retention jobscope; Type: POLICY; Schema: audit; Owner: -
--

CREATE POLICY "jobscope" ON "audit"."retention" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: record; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."record" ENABLE ROW LEVEL SECURITY;

--
-- Name: recorddefault; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."recorddefault" ENABLE ROW LEVEL SECURITY;

--
-- Name: retention; Type: ROW SECURITY; Schema: audit; Owner: -
--

ALTER TABLE "audit"."retention" ENABLE ROW LEVEL SECURITY;

--
-- Name: account; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."account" ENABLE ROW LEVEL SECURITY;

--
-- Name: action; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."action" ENABLE ROW LEVEL SECURITY;

--
-- Name: account appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."account" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: action appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."action" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ("benefit"."grantbatch" "batch"
     JOIN "benefit"."plan" "plan" ON (("plan"."id" = "batch"."plan_id")))
  WHERE (("batch"."id" = "action"."batch_id") AND "access"."scope_allowed"("plan"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("benefit"."grantbatch" "batch"
     JOIN "benefit"."plan" "plan" ON (("plan"."id" = "batch"."plan_id")))
  WHERE (("batch"."id" = "action"."batch_id") AND "access"."scope_allowed"("plan"."scope_id")))));


--
-- Name: budget appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."budget" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: grantbatch appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."grantbatch" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: grantdecision appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."grantdecision" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: grantitem appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."grantitem" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: lot appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."lot" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "benefit"."account" "account"
  WHERE (("account"."id" = "lot"."account_id") AND "access"."scope_allowed"("account"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "benefit"."account" "account"
  WHERE (("account"."id" = "lot"."account_id") AND "access"."scope_allowed"("account"."scope_id")))));


--
-- Name: lotmovement appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."lotmovement" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ("benefit"."lot" "lot"
     JOIN "benefit"."account" "account" ON (("account"."id" = "lot"."account_id")))
  WHERE (("lot"."id" = "lotmovement"."lot_id") AND "access"."scope_allowed"("account"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("benefit"."lot" "lot"
     JOIN "benefit"."account" "account" ON (("account"."id" = "lot"."account_id")))
  WHERE (("lot"."id" = "lotmovement"."lot_id") AND "access"."scope_allowed"("account"."scope_id")))));


--
-- Name: plan appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."plan" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: planversion appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."planversion" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "benefit"."plan" "plan"
  WHERE (("plan"."id" = "planversion"."plan_id") AND "access"."scope_allowed"("plan"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "benefit"."plan" "plan"
  WHERE (("plan"."id" = "planversion"."plan_id") AND "access"."scope_allowed"("plan"."scope_id")))));


--
-- Name: reminder appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."reminder" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ("benefit"."lot" "lot"
     JOIN "benefit"."account" "account" ON (("account"."id" = "lot"."account_id")))
  WHERE (("lot"."id" = "reminder"."lot_id") AND "access"."scope_allowed"("account"."scope_id")))));


--
-- Name: reservation appscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "appscope" ON "benefit"."reservation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: budget; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."budget" ENABLE ROW LEVEL SECURITY;

--
-- Name: grantbatch; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."grantbatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: grantdecision; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."grantdecision" ENABLE ROW LEVEL SECURITY;

--
-- Name: grantitem; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."grantitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: account jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."account" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: action jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."action" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: budget jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."budget" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: grantbatch jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."grantbatch" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: grantdecision jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."grantdecision" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: grantitem jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."grantitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: lot jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."lot" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: lotmovement jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."lotmovement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: plan jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."plan" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: planversion jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."planversion" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reminder jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."reminder" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reservation jobscope; Type: POLICY; Schema: benefit; Owner: -
--

CREATE POLICY "jobscope" ON "benefit"."reservation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: lot; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."lot" ENABLE ROW LEVEL SECURITY;

--
-- Name: lotmovement; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."lotmovement" ENABLE ROW LEVEL SECURITY;

--
-- Name: plan; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."plan" ENABLE ROW LEVEL SECURITY;

--
-- Name: planversion; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."planversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: reminder; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."reminder" ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation; Type: ROW SECURITY; Schema: benefit; Owner: -
--

ALTER TABLE "benefit"."reservation" ENABLE ROW LEVEL SECURITY;

--
-- Name: capability appscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "appscope" ON "capability"."capability" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: dependency appscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "appscope" ON "capability"."dependency" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: entitlement appscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "appscope" ON "capability"."entitlement" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: operation appscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "appscope" ON "capability"."operation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: capability; Type: ROW SECURITY; Schema: capability; Owner: -
--

ALTER TABLE "capability"."capability" ENABLE ROW LEVEL SECURITY;

--
-- Name: dependency; Type: ROW SECURITY; Schema: capability; Owner: -
--

ALTER TABLE "capability"."dependency" ENABLE ROW LEVEL SECURITY;

--
-- Name: entitlement; Type: ROW SECURITY; Schema: capability; Owner: -
--

ALTER TABLE "capability"."entitlement" ENABLE ROW LEVEL SECURITY;

--
-- Name: capability jobscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "jobscope" ON "capability"."capability" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: dependency jobscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "jobscope" ON "capability"."dependency" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: entitlement jobscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "jobscope" ON "capability"."entitlement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: operation jobscope; Type: POLICY; Schema: capability; Owner: -
--

CREATE POLICY "jobscope" ON "capability"."operation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: operation; Type: ROW SECURITY; Schema: capability; Owner: -
--

ALTER TABLE "capability"."operation" ENABLE ROW LEVEL SECURITY;

--
-- Name: cart appscope; Type: POLICY; Schema: cart; Owner: -
--

CREATE POLICY "appscope" ON "cart"."cart" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: item appscope; Type: POLICY; Schema: cart; Owner: -
--

CREATE POLICY "appscope" ON "cart"."item" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: cart; Type: ROW SECURITY; Schema: cart; Owner: -
--

ALTER TABLE "cart"."cart" ENABLE ROW LEVEL SECURITY;

--
-- Name: item; Type: ROW SECURITY; Schema: cart; Owner: -
--

ALTER TABLE "cart"."item" ENABLE ROW LEVEL SECURITY;

--
-- Name: cart jobscope; Type: POLICY; Schema: cart; Owner: -
--

CREATE POLICY "jobscope" ON "cart"."cart" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: item jobscope; Type: POLICY; Schema: cart; Owner: -
--

CREATE POLICY "jobscope" ON "cart"."item" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: availabilitycity appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."availabilitycity" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: availabilityitem appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."availabilityitem" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: availabilityzone appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."availabilityzone" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: category appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."category" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: classificationrule appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."classificationrule" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: importerror appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."importerror" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: importjob appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."importjob" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: listing appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."listing" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: pool appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."pool" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: poolbinding appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."poolbinding" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: poolitem appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."poolitem" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: product appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."product" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: review appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."review" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: sku appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."sku" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: sourcelisting appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."sourcelisting" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: suppliercategory appscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "appscope" ON "catalog"."suppliercategory" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: availabilitycity; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."availabilitycity" ENABLE ROW LEVEL SECURITY;

--
-- Name: availabilityitem; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."availabilityitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: availabilityzone; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."availabilityzone" ENABLE ROW LEVEL SECURITY;

--
-- Name: category; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."category" ENABLE ROW LEVEL SECURITY;

--
-- Name: classificationrule; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."classificationrule" ENABLE ROW LEVEL SECURITY;

--
-- Name: importerror; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."importerror" ENABLE ROW LEVEL SECURITY;

--
-- Name: importjob; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."importjob" ENABLE ROW LEVEL SECURITY;

--
-- Name: importrow; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."importrow" ENABLE ROW LEVEL SECURITY;

--
-- Name: availabilitycity jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."availabilitycity" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: availabilityitem jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."availabilityitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: availabilityzone jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."availabilityzone" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: category jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."category" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: classificationrule jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."classificationrule" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importerror jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."importerror" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importjob jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."importjob" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importrow jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."importrow" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: listing jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."listing" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: pool jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."pool" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: poolbinding jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."poolbinding" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: poolitem jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."poolitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: product jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."product" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: review jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."review" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: sku jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."sku" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: sourcelisting jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."sourcelisting" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: suppliercategory jobscope; Type: POLICY; Schema: catalog; Owner: -
--

CREATE POLICY "jobscope" ON "catalog"."suppliercategory" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: listing; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."listing" ENABLE ROW LEVEL SECURITY;

--
-- Name: pool; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."pool" ENABLE ROW LEVEL SECURITY;

--
-- Name: poolbinding; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."poolbinding" ENABLE ROW LEVEL SECURITY;

--
-- Name: poolitem; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."poolitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: product; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."product" ENABLE ROW LEVEL SECURITY;

--
-- Name: review; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."review" ENABLE ROW LEVEL SECURITY;

--
-- Name: sku; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."sku" ENABLE ROW LEVEL SECURITY;

--
-- Name: sourcelisting; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."sourcelisting" ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliercategory; Type: ROW SECURITY; Schema: catalog; Owner: -
--

ALTER TABLE "catalog"."suppliercategory" ENABLE ROW LEVEL SECURITY;

--
-- Name: connection appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."connection" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: distributor appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."distributor" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: externalobject appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."externalobject" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: provideroperation appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."provideroperation" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: sourcerecord appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."sourcerecord" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: statement appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."statement" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: syncrun appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."syncrun" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: tenantbinding appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."tenantbinding" TO "shopapp" USING (("tenant_id" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))) WITH CHECK (("tenant_id" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text")));


--
-- Name: webhookinbox appscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "appscope" ON "channel"."webhookinbox" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: connection; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."connection" ENABLE ROW LEVEL SECURITY;

--
-- Name: distributor; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."distributor" ENABLE ROW LEVEL SECURITY;

--
-- Name: externalobject; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."externalobject" ENABLE ROW LEVEL SECURITY;

--
-- Name: connection jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."connection" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: distributor jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."distributor" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: externalobject jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."externalobject" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: provideroperation jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."provideroperation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: sourcerecord jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."sourcerecord" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statement jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."statement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: syncrun jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."syncrun" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: tenantbinding jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."tenantbinding" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: webhookinbox jobscope; Type: POLICY; Schema: channel; Owner: -
--

CREATE POLICY "jobscope" ON "channel"."webhookinbox" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: provideroperation; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."provideroperation" ENABLE ROW LEVEL SECURITY;

--
-- Name: sourcerecord; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."sourcerecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: statement; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."statement" ENABLE ROW LEVEL SECURITY;

--
-- Name: syncrun; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."syncrun" ENABLE ROW LEVEL SECURITY;

--
-- Name: tenantbinding; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."tenantbinding" ENABLE ROW LEVEL SECURITY;

--
-- Name: webhookinbox; Type: ROW SECURITY; Schema: channel; Owner: -
--

ALTER TABLE "channel"."webhookinbox" ENABLE ROW LEVEL SECURITY;

--
-- Name: address; Type: ROW SECURITY; Schema: checkout; Owner: -
--

ALTER TABLE "checkout"."address" ENABLE ROW LEVEL SECURITY;

--
-- Name: address appscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "appscope" ON "checkout"."address" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: evidence appscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "appscope" ON "checkout"."evidence" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: session appscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "appscope" ON "checkout"."session" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: evidence; Type: ROW SECURITY; Schema: checkout; Owner: -
--

ALTER TABLE "checkout"."evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: address jobscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "jobscope" ON "checkout"."address" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: evidence jobscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "jobscope" ON "checkout"."evidence" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: session jobscope; Type: POLICY; Schema: checkout; Owner: -
--

CREATE POLICY "jobscope" ON "checkout"."session" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: session; Type: ROW SECURITY; Schema: checkout; Owner: -
--

ALTER TABLE "checkout"."session" ENABLE ROW LEVEL SECURITY;

--
-- Name: application; Type: ROW SECURITY; Schema: experience; Owner: -
--

ALTER TABLE "experience"."application" ENABLE ROW LEVEL SECURITY;

--
-- Name: application appscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "appscope" ON "experience"."application" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: binding appscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "appscope" ON "experience"."binding" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: publication appscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "appscope" ON "experience"."publication" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "experience"."application"
  WHERE (("application"."id" = "publication"."application_id") AND "access"."scope_allowed"("application"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "experience"."application"
  WHERE (("application"."id" = "publication"."application_id") AND "access"."scope_allowed"("application"."scope_id")))));


--
-- Name: release appscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "appscope" ON "experience"."release" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: version appscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "appscope" ON "experience"."version" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: binding; Type: ROW SECURITY; Schema: experience; Owner: -
--

ALTER TABLE "experience"."binding" ENABLE ROW LEVEL SECURITY;

--
-- Name: application jobscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "jobscope" ON "experience"."application" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: binding jobscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "jobscope" ON "experience"."binding" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: publication jobscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "jobscope" ON "experience"."publication" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: release jobscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "jobscope" ON "experience"."release" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: version jobscope; Type: POLICY; Schema: experience; Owner: -
--

CREATE POLICY "jobscope" ON "experience"."version" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: publication; Type: ROW SECURITY; Schema: experience; Owner: -
--

ALTER TABLE "experience"."publication" ENABLE ROW LEVEL SECURITY;

--
-- Name: release; Type: ROW SECURITY; Schema: experience; Owner: -
--

ALTER TABLE "experience"."release" ENABLE ROW LEVEL SECURITY;

--
-- Name: version; Type: ROW SECURITY; Schema: experience; Owner: -
--

ALTER TABLE "experience"."version" ENABLE ROW LEVEL SECURITY;

--
-- Name: activationhistory; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."activationhistory" ENABLE ROW LEVEL SECURITY;

--
-- Name: activationhistory appinsert; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appinsert" ON "extension"."activationhistory" FOR INSERT TO "shopapp" WITH CHECK ((EXISTS ( SELECT 1
   FROM "extension"."installation" "installation"
  WHERE (("installation"."id" = "activationhistory"."installation_id") AND "access"."scope_allowed"("installation"."scope_id")))));


--
-- Name: health appinsert; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appinsert" ON "extension"."health" FOR INSERT TO "shopapp" WITH CHECK ((EXISTS ( SELECT 1
   FROM "extension"."installation" "installation"
  WHERE (("installation"."id" = "health"."installation_id") AND "access"."scope_allowed"("installation"."scope_id")))));


--
-- Name: installation appinsert; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appinsert" ON "extension"."installation" FOR INSERT TO "shopapp" WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: activationhistory appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."activationhistory" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "extension"."installation" "installation"
  WHERE (("installation"."id" = "activationhistory"."installation_id") AND "access"."scope_allowed"("installation"."scope_id")))));


--
-- Name: contractversion appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."contractversion" FOR SELECT TO "shopapp" USING ((NULLIF("current_setting"('app.scope_id'::"text", true), ''::"text") IS NOT NULL));


--
-- Name: health appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."health" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "extension"."installation" "installation"
  WHERE (("installation"."id" = "health"."installation_id") AND "access"."scope_allowed"("installation"."scope_id")))));


--
-- Name: installation appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."installation" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: manifest appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."manifest" FOR SELECT TO "shopapp" USING ((NULLIF("current_setting"('app.scope_id'::"text", true), ''::"text") IS NOT NULL));


--
-- Name: registry appselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appselect" ON "extension"."registry" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: installation appupdate; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "appupdate" ON "extension"."installation" FOR UPDATE TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: contractversion; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."contractversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: health; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."health" ENABLE ROW LEVEL SECURITY;

--
-- Name: installation; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."installation" ENABLE ROW LEVEL SECURITY;

--
-- Name: activationhistory jobscope; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobscope" ON "extension"."activationhistory" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: health jobscope; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobscope" ON "extension"."health" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: installation jobscope; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobscope" ON "extension"."installation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: contractversion jobselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobselect" ON "extension"."contractversion" FOR SELECT TO "shopjob" USING (true);


--
-- Name: manifest jobselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobselect" ON "extension"."manifest" FOR SELECT TO "shopjob" USING (true);


--
-- Name: registry jobselect; Type: POLICY; Schema: extension; Owner: -
--

CREATE POLICY "jobselect" ON "extension"."registry" FOR SELECT TO "shopjob" USING (true);


--
-- Name: manifest; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."manifest" ENABLE ROW LEVEL SECURITY;

--
-- Name: registry; Type: ROW SECURITY; Schema: extension; Owner: -
--

ALTER TABLE "extension"."registry" ENABLE ROW LEVEL SECURITY;

--
-- Name: account; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."account" ENABLE ROW LEVEL SECURITY;

--
-- Name: economicleg appinsert; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appinsert" ON "finance"."economicleg" FOR INSERT TO "shopapp" WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: account appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."account" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: backfill appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."backfill" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: entry appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."entry" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: hold appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."hold" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: journal appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."journal" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: period appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."period" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: periodclose appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."periodclose" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: policy appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."policy" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: reconciliation appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."reconciliation" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: reconciliationitem appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."reconciliationitem" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: settlement appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."settlement" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: settlementadjustment appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."settlementadjustment" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: settlementline appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."settlementline" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: split appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."split" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: statement appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."statement" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: statementline appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."statementline" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: withdrawal appscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appscope" ON "finance"."withdrawal" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: economicleg appselect; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "appselect" ON "finance"."economicleg" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: backfill; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."backfill" ENABLE ROW LEVEL SECURITY;

--
-- Name: economicleg; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."economicleg" ENABLE ROW LEVEL SECURITY;

--
-- Name: entry; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."entry" ENABLE ROW LEVEL SECURITY;

--
-- Name: hold; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."hold" ENABLE ROW LEVEL SECURITY;

--
-- Name: account jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."account" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: backfill jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."backfill" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: economicleg jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."economicleg" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: entry jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."entry" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: hold jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."hold" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: journal jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."journal" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: period jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."period" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: periodclose jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."periodclose" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policy jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."policy" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reconciliation jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."reconciliation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reconciliationitem jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."reconciliationitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: settlement jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."settlement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: settlementadjustment jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."settlementadjustment" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: settlementline jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."settlementline" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: split jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."split" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statement jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."statement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statementline jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."statementline" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: withdrawal jobscope; Type: POLICY; Schema: finance; Owner: -
--

CREATE POLICY "jobscope" ON "finance"."withdrawal" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: journal; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."journal" ENABLE ROW LEVEL SECURITY;

--
-- Name: period; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."period" ENABLE ROW LEVEL SECURITY;

--
-- Name: periodclose; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."periodclose" ENABLE ROW LEVEL SECURITY;

--
-- Name: policy; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."policy" ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."reconciliation" ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliationitem; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."reconciliationitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: settlement; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."settlement" ENABLE ROW LEVEL SECURITY;

--
-- Name: settlementadjustment; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."settlementadjustment" ENABLE ROW LEVEL SECURITY;

--
-- Name: settlementline; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."settlementline" ENABLE ROW LEVEL SECURITY;

--
-- Name: split; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."split" ENABLE ROW LEVEL SECURITY;

--
-- Name: statement; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."statement" ENABLE ROW LEVEL SECURITY;

--
-- Name: statementline; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."statementline" ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal; Type: ROW SECURITY; Schema: finance; Owner: -
--

ALTER TABLE "finance"."withdrawal" ENABLE ROW LEVEL SECURITY;

--
-- Name: fulfillmentorder appscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "appscope" ON "fulfillment"."fulfillmentorder" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: line appscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "appscope" ON "fulfillment"."line" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: milestone appscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "appscope" ON "fulfillment"."milestone" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: returnrecord appscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "appscope" ON "fulfillment"."returnrecord" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: fulfillmentorder; Type: ROW SECURITY; Schema: fulfillment; Owner: -
--

ALTER TABLE "fulfillment"."fulfillmentorder" ENABLE ROW LEVEL SECURITY;

--
-- Name: fulfillmentorder jobscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "jobscope" ON "fulfillment"."fulfillmentorder" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line jobscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "jobscope" ON "fulfillment"."line" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: milestone jobscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "jobscope" ON "fulfillment"."milestone" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: returnrecord jobscope; Type: POLICY; Schema: fulfillment; Owner: -
--

CREATE POLICY "jobscope" ON "fulfillment"."returnrecord" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line; Type: ROW SECURITY; Schema: fulfillment; Owner: -
--

ALTER TABLE "fulfillment"."line" ENABLE ROW LEVEL SECURITY;

--
-- Name: milestone; Type: ROW SECURITY; Schema: fulfillment; Owner: -
--

ALTER TABLE "fulfillment"."milestone" ENABLE ROW LEVEL SECURITY;

--
-- Name: returnrecord; Type: ROW SECURITY; Schema: fulfillment; Owner: -
--

ALTER TABLE "fulfillment"."returnrecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: assurance appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."assurance" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: authticket appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."authticket" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: challenge appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."challenge" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: challengedelivery appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."challengedelivery" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: challengesecret appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."challengesecret" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: credential appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."credential" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: federatedidentity appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."federatedidentity" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: loginattempt appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."loginattempt" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: principal appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."principal" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: registrationpolicy appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."registrationpolicy" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: session appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."session" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: wechatgrant appscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "appscope" ON "identity"."wechatgrant" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: assurance; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."assurance" ENABLE ROW LEVEL SECURITY;

--
-- Name: authticket; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."authticket" ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."challenge" ENABLE ROW LEVEL SECURITY;

--
-- Name: challengedelivery; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."challengedelivery" ENABLE ROW LEVEL SECURITY;

--
-- Name: challengesecret; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."challengesecret" ENABLE ROW LEVEL SECURITY;

--
-- Name: credential; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."credential" ENABLE ROW LEVEL SECURITY;

--
-- Name: federatedidentity; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."federatedidentity" ENABLE ROW LEVEL SECURITY;

--
-- Name: federationtransaction federationapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "federationapp" ON "identity"."federationtransaction" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "federationtransaction"."provider_id") AND (("provider"."tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "federationtransaction"."provider_id") AND (("provider"."tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))))));


--
-- Name: federationtransaction federationjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "federationjob" ON "identity"."federationtransaction" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: federationtransaction federationpublic; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "federationpublic" ON "identity"."federationtransaction" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "federationtransaction"."provider_id") AND ("provider"."status" = 'enabled'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "federationtransaction"."provider_id") AND ("provider"."status" = 'enabled'::"text")))));


--
-- Name: federationtransaction; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."federationtransaction" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."invitation" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation invitationapi; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationapi" ON "identity"."invitation" TO "shopapp" USING ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND (("current_setting"('app.operation_id'::"text", true) = ANY (ARRAY['identity.sessions.create'::"text", 'identity.sessions.complete'::"text", 'identity.invitations.resolve'::"text", 'identity.enrollments.read'::"text", 'identity.enrollments.complete'::"text"])) OR "access"."scope_allowed"("organization_id")))) WITH CHECK ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND (("current_setting"('app.operation_id'::"text", true) = ANY (ARRAY['identity.sessions.create'::"text", 'identity.sessions.complete'::"text", 'identity.enrollments.complete'::"text"])) OR "access"."scope_allowed"("organization_id"))));


--
-- Name: invitationclaim; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."invitationclaim" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitationclaim invitationclaimapi; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationclaimapi" ON "identity"."invitationclaim" TO "shopapp" USING ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND ("current_setting"('app.operation_id'::"text", true) = ANY (ARRAY['identity.sessions.create'::"text", 'identity.sessions.complete'::"text", 'identity.enrollments.read'::"text", 'identity.enrollments.complete'::"text"])))) WITH CHECK ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND ("current_setting"('app.operation_id'::"text", true) = ANY (ARRAY['identity.sessions.create'::"text", 'identity.sessions.complete'::"text", 'identity.enrollments.complete'::"text"]))));


--
-- Name: invitationclaim invitationclaimjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationclaimjob" ON "identity"."invitationclaim" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: invitation invitationjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationjob" ON "identity"."invitation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: loginattempt invitationratejob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationratejob" ON "identity"."loginattempt" TO "shopjob" USING ((("current_setting"('app.workload'::"text", true) = 'jobs'::"text") AND ("current_setting"('app.job_kind'::"text", true) = 'invitationcleanup'::"text"))) WITH CHECK ((("current_setting"('app.workload'::"text", true) = 'jobs'::"text") AND ("current_setting"('app.job_kind'::"text", true) = 'invitationcleanup'::"text")));


--
-- Name: invitationreceipt; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."invitationreceipt" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitationreceipt invitationreceiptapiread; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationreceiptapiread" ON "identity"."invitationreceipt" FOR SELECT TO "shopapp" USING ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND ("current_setting"('app.operation_id'::"text", true) = 'identity.invitations.read'::"text") AND (EXISTS ( SELECT 1
   FROM "identity"."invitation" "invitation"
  WHERE (("invitation"."id" = "invitationreceipt"."invitation_id") AND "access"."scope_allowed"("invitation"."organization_id"))))));


--
-- Name: invitationreceipt invitationreceiptapiwrite; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationreceiptapiwrite" ON "identity"."invitationreceipt" FOR INSERT TO "shopapp" WITH CHECK ((("current_setting"('app.workload'::"text", true) = 'api'::"text") AND ("current_setting"('app.operation_id'::"text", true) = ANY (ARRAY['identity.sessions.create'::"text", 'identity.sessions.complete'::"text", 'identity.enrollments.complete'::"text"]))));


--
-- Name: invitationreceipt invitationreceiptjobread; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "invitationreceiptjobread" ON "identity"."invitationreceipt" FOR SELECT TO "shopjob" USING (true);


--
-- Name: assurance jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."assurance" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: authticket jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."authticket" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: challenge jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."challenge" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: challengedelivery jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."challengedelivery" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: challengesecret jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."challengesecret" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: credential jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."credential" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: federatedidentity jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."federatedidentity" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: principal jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."principal" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: registrationpolicy jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."registrationpolicy" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: session jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."session" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: wechatgrant jobscope; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "jobscope" ON "identity"."wechatgrant" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: linkcase; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."linkcase" ENABLE ROW LEVEL SECURITY;

--
-- Name: linkcase linkcaseapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "linkcaseapp" ON "identity"."linkcase" TO "shopapp" USING (((("source" = 'federation'::"text") AND (("tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))) OR (("source" = 'enrollment'::"text") AND "access"."scope_allowed"("organization_id")))) WITH CHECK (((("source" = 'federation'::"text") AND (("tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))) OR (("source" = 'enrollment'::"text") AND "access"."scope_allowed"("organization_id"))));


--
-- Name: linkcase linkcasejob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "linkcasejob" ON "identity"."linkcase" FOR SELECT TO "shopjob" USING (true);


--
-- Name: linkcase linkcasepublic; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "linkcasepublic" ON "identity"."linkcase" FOR INSERT TO "shopapp" WITH CHECK (((("source" = 'federation'::"text") AND (EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "linkcase"."provider_id") AND ("provider"."tenant_id" = "provider"."tenant_id") AND ("provider"."status" = 'enabled'::"text"))))) OR (("source" = 'enrollment'::"text") AND ("current_setting"('app.operation_id'::"text", true) = 'identity.enrollments.complete'::"text") AND (EXISTS ( SELECT 1
   FROM ("identity"."invitationclaim" "claim"
     JOIN "identity"."invitation" "invitation" ON (("invitation"."id" = "claim"."invitation_id")))
  WHERE ((("claim"."id")::"text" = "linkcase"."reference_id") AND ("invitation"."organization_id" = "invitation"."organization_id") AND ("claim"."state" = ANY (ARRAY['reserved'::"text", 'proofpending'::"text", 'proved'::"text"]))))))));


--
-- Name: loginattempt; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."loginattempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: preauth; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."preauth" ENABLE ROW LEVEL SECURITY;

--
-- Name: preauth preauthapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "preauthapp" ON "identity"."preauth" TO "shopapp" USING ((("transaction_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "identity"."federationtransaction" "transaction"
  WHERE ("transaction"."id" = "preauth"."transaction_id"))))) WITH CHECK ((("transaction_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "identity"."federationtransaction" "transaction"
  WHERE ("transaction"."id" = "preauth"."transaction_id")))));


--
-- Name: preauth preauthjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "preauthjob" ON "identity"."preauth" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: principal; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."principal" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."provider" ENABLE ROW LEVEL SECURITY;

--
-- Name: provider providerapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "providerapp" ON "identity"."provider" TO "shopapp" USING ((("tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))) WITH CHECK ((("tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text")));


--
-- Name: providerhealth; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."providerhealth" ENABLE ROW LEVEL SECURITY;

--
-- Name: providerhealth providerhealthapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "providerhealthapp" ON "identity"."providerhealth" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "providerhealth"."provider_id") AND (("provider"."tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))))));


--
-- Name: providerhealth providerhealthjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "providerhealthjob" ON "identity"."providerhealth" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: provider providerjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "providerjob" ON "identity"."provider" FOR SELECT TO "shopjob" USING (true);


--
-- Name: provider providerpublic; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "providerpublic" ON "identity"."provider" FOR SELECT TO "shopapp" USING (("status" = 'enabled'::"text"));


--
-- Name: providersecretrotation; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."providersecretrotation" ENABLE ROW LEVEL SECURITY;

--
-- Name: registrationpolicy; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."registrationpolicy" ENABLE ROW LEVEL SECURITY;

--
-- Name: providersecretrotation rotationapp; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "rotationapp" ON "identity"."providersecretrotation" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "providersecretrotation"."provider_id") AND (("provider"."tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "identity"."provider" "provider"
  WHERE (("provider"."id" = "providersecretrotation"."provider_id") AND (("provider"."tenant_id")::"text" = NULLIF("current_setting"('app.tenant_id'::"text", true), ''::"text"))))));


--
-- Name: providersecretrotation rotationjob; Type: POLICY; Schema: identity; Owner: -
--

CREATE POLICY "rotationjob" ON "identity"."providersecretrotation" FOR SELECT TO "shopjob" USING (true);


--
-- Name: session; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."session" ENABLE ROW LEVEL SECURITY;

--
-- Name: wechatgrant; Type: ROW SECURITY; Schema: identity; Owner: -
--

ALTER TABLE "identity"."wechatgrant" ENABLE ROW LEVEL SECURITY;

--
-- Name: command appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."command" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: cutoverreview appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."cutoverreview" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: importerror appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."importerror" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: importjob appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."importjob" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: movement appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."movement" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: observation appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."observation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: reservation appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."reservation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: snapshot appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."snapshot" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: stockitem appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."stockitem" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: syncstate appscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "appscope" ON "inventory"."syncstate" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: command; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."command" ENABLE ROW LEVEL SECURITY;

--
-- Name: cutoverreview; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."cutoverreview" ENABLE ROW LEVEL SECURITY;

--
-- Name: importerror; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."importerror" ENABLE ROW LEVEL SECURITY;

--
-- Name: importjob; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."importjob" ENABLE ROW LEVEL SECURITY;

--
-- Name: importrow; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."importrow" ENABLE ROW LEVEL SECURITY;

--
-- Name: command jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."command" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: cutoverreview jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."cutoverreview" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importerror jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."importerror" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importjob jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."importjob" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importrow jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."importrow" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: movement jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."movement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: observation jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."observation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reservation jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."reservation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: snapshot jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."snapshot" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: stockitem jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."stockitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: syncstate jobscope; Type: POLICY; Schema: inventory; Owner: -
--

CREATE POLICY "jobscope" ON "inventory"."syncstate" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: movement; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."movement" ENABLE ROW LEVEL SECURITY;

--
-- Name: observation; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."observation" ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."reservation" ENABLE ROW LEVEL SECURITY;

--
-- Name: snapshot; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."snapshot" ENABLE ROW LEVEL SECURITY;

--
-- Name: stockitem; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."stockitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: syncstate; Type: ROW SECURITY; Schema: inventory; Owner: -
--

ALTER TABLE "inventory"."syncstate" ENABLE ROW LEVEL SECURITY;

--
-- Name: document appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."document" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: line appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."line" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: profile appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."profile" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: request appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."request" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: requestline appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."requestline" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ("invoice"."request" "request"
     JOIN "invoice"."profile" "profile" ON (("profile"."id" = "request"."profile_id")))
  WHERE (("request"."id" = "requestline"."request_id") AND "access"."scope_allowed"("profile"."owner_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("invoice"."request" "request"
     JOIN "invoice"."profile" "profile" ON (("profile"."id" = "request"."profile_id")))
  WHERE (("request"."id" = "requestline"."request_id") AND "access"."scope_allowed"("profile"."owner_id")))));


--
-- Name: requestprofile appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."requestprofile" TO "shopapp" USING ("access"."scope_allowed"("owner_id")) WITH CHECK ("access"."scope_allowed"("owner_id"));


--
-- Name: statusevent appscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "appscope" ON "invoice"."statusevent" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: document; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."document" ENABLE ROW LEVEL SECURITY;

--
-- Name: document jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."document" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."line" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: profile jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."profile" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: request jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."request" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: requestline jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."requestline" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: requestprofile jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."requestprofile" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statusevent jobscope; Type: POLICY; Schema: invoice; Owner: -
--

CREATE POLICY "jobscope" ON "invoice"."statusevent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."line" ENABLE ROW LEVEL SECURITY;

--
-- Name: profile; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."profile" ENABLE ROW LEVEL SECURITY;

--
-- Name: request; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."request" ENABLE ROW LEVEL SECURITY;

--
-- Name: requestline; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."requestline" ENABLE ROW LEVEL SECURITY;

--
-- Name: requestprofile; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."requestprofile" ENABLE ROW LEVEL SECURITY;

--
-- Name: statusevent; Type: ROW SECURITY; Schema: invoice; Owner: -
--

ALTER TABLE "invoice"."statusevent" ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign appscope; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY "appscope" ON "marketing"."campaign" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: redemption appscope; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY "appscope" ON "marketing"."redemption" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: campaign; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE "marketing"."campaign" ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign jobscope; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY "jobscope" ON "marketing"."campaign" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: redemption jobscope; Type: POLICY; Schema: marketing; Owner: -
--

CREATE POLICY "jobscope" ON "marketing"."redemption" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: redemption; Type: ROW SECURITY; Schema: marketing; Owner: -
--

ALTER TABLE "marketing"."redemption" ENABLE ROW LEVEL SECURITY;

--
-- Name: importerror appscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "appscope" ON "member"."importerror" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: importjob appscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "appscope" ON "member"."importjob" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: profile appscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "appscope" ON "member"."profile" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: importerror; Type: ROW SECURITY; Schema: member; Owner: -
--

ALTER TABLE "member"."importerror" ENABLE ROW LEVEL SECURITY;

--
-- Name: importjob; Type: ROW SECURITY; Schema: member; Owner: -
--

ALTER TABLE "member"."importjob" ENABLE ROW LEVEL SECURITY;

--
-- Name: importrow; Type: ROW SECURITY; Schema: member; Owner: -
--

ALTER TABLE "member"."importrow" ENABLE ROW LEVEL SECURITY;

--
-- Name: importerror jobscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "jobscope" ON "member"."importerror" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importjob jobscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "jobscope" ON "member"."importjob" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importrow jobscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "jobscope" ON "member"."importrow" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: profile jobscope; Type: POLICY; Schema: member; Owner: -
--

CREATE POLICY "jobscope" ON "member"."profile" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: profile; Type: ROW SECURITY; Schema: member; Owner: -
--

ALTER TABLE "member"."profile" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."announcement" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."announcement" TO "shopapp" USING (("access"."scope_allowed"("scope_id") OR (("state" = 'published'::"text") AND ("starts_at" <= "clock_timestamp"()) AND (("ends_at" IS NULL) OR ("ends_at" > "clock_timestamp"())) AND (EXISTS ( SELECT 1
   FROM ("access"."membership" "membership"
     JOIN "organization"."unitclosure" "closure" ON ((("closure"."descendant_id" = "membership"."organization_id") AND ("closure"."ancestor_id" = "announcement"."scope_id"))))
  WHERE (("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")) AND ("membership"."status" = 'active'::"text"))))))) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: attempt appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."attempt" TO "shopapp" USING (("access"."scope_allowed"("scope_id") OR ("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")))))) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: attemptdefault appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."attemptdefault" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: dispatch appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."dispatch" TO "shopapp" USING (("access"."scope_allowed"("scope_id") OR ("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")))))) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: endpoint appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."endpoint" TO "shopapp" USING (("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text"))))) WITH CHECK (("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")))));


--
-- Name: preference appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."preference" TO "shopapp" USING (("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text"))))) WITH CHECK (("member_id" = ( SELECT "membership"."member_id"
   FROM "access"."membership" "membership"
  WHERE ("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")))));


--
-- Name: template appscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "appscope" ON "notification"."template" TO "shopapp" USING (("access"."scope_allowed"("scope_id") OR (("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM ("access"."membership" "membership"
     JOIN "organization"."unitclosure" "closure" ON ((("closure"."descendant_id" = "membership"."organization_id") AND ("closure"."ancestor_id" = "template"."scope_id"))))
  WHERE (("membership"."id" = NULLIF("current_setting"('app.membership_id'::"text", true), ''::"text")) AND ("membership"."status" = 'active'::"text"))))))) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: attempt; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."attempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: attemptdefault; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."attemptdefault" ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."dispatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: endpoint; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."endpoint" ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."announcement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: attempt jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."attempt" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: attemptdefault jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."attemptdefault" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: dispatch jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."dispatch" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: endpoint jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."endpoint" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: preference jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."preference" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: template jobscope; Type: POLICY; Schema: notification; Owner: -
--

CREATE POLICY "jobscope" ON "notification"."template" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: preference; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."preference" ENABLE ROW LEVEL SECURITY;

--
-- Name: template; Type: ROW SECURITY; Schema: notification; Owner: -
--

ALTER TABLE "notification"."template" ENABLE ROW LEVEL SECURITY;

--
-- Name: aftersale; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."aftersale" ENABLE ROW LEVEL SECURITY;

--
-- Name: aftersale appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."aftersale" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: line appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."line" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: orderrecord appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."orderrecord" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: reminder appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."reminder" TO "shopapp" USING ((("member_id" = "current_setting"('app.scope_id'::"text", true)) OR (EXISTS ( SELECT 1
   FROM ("organization"."unitclosure" "closure"
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "reminder"."order_id")))
  WHERE (("closure"."ancestor_id" = "current_setting"('app.scope_id'::"text", true)) AND ("closure"."descendant_id" = "orders"."mall_id")))))) WITH CHECK ((("member_id" = "current_setting"('app.scope_id'::"text", true)) OR (EXISTS ( SELECT 1
   FROM ("organization"."unitclosure" "closure"
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "reminder"."order_id")))
  WHERE (("closure"."ancestor_id" = "current_setting"('app.scope_id'::"text", true)) AND ("closure"."descendant_id" = "orders"."mall_id"))))));


--
-- Name: reviewaction appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."reviewaction" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: stateevent appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."stateevent" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: suborder appscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "appscope" ON "ordering"."suborder" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: aftersale jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."aftersale" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."line" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: orderrecord jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."orderrecord" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reminder jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."reminder" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reviewaction jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."reviewaction" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: stateevent jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."stateevent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: suborder jobscope; Type: POLICY; Schema: ordering; Owner: -
--

CREATE POLICY "jobscope" ON "ordering"."suborder" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: line; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."line" ENABLE ROW LEVEL SECURITY;

--
-- Name: orderrecord; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."orderrecord" ENABLE ROW LEVEL SECURITY;

--
-- Name: reminder; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."reminder" ENABLE ROW LEVEL SECURITY;

--
-- Name: reviewaction; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."reviewaction" ENABLE ROW LEVEL SECURITY;

--
-- Name: stateevent; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."stateevent" ENABLE ROW LEVEL SECURITY;

--
-- Name: suborder; Type: ROW SECURITY; Schema: ordering; Owner: -
--

ALTER TABLE "ordering"."suborder" ENABLE ROW LEVEL SECURITY;

--
-- Name: assignment appscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "appscope" ON "organization"."assignment" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: change appscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "appscope" ON "organization"."change" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: organization appscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "appscope" ON "organization"."organization" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: sourcebinding appscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "appscope" ON "organization"."sourcebinding" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: unitclosure appscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "appscope" ON "organization"."unitclosure" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: assignment; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."assignment" ENABLE ROW LEVEL SECURITY;

--
-- Name: change; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."change" ENABLE ROW LEVEL SECURITY;

--
-- Name: directoryconnection; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."directoryconnection" ENABLE ROW LEVEL SECURITY;

--
-- Name: directoryconnection directoryconnectionapp; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directoryconnectionapp" ON "organization"."directoryconnection" TO "shopapp" USING ("access"."scope_allowed"("organization_id")) WITH CHECK ("access"."scope_allowed"("organization_id"));


--
-- Name: directoryconnection directoryconnectionjob; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directoryconnectionjob" ON "organization"."directoryconnection" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: directoryinbox; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."directoryinbox" ENABLE ROW LEVEL SECURITY;

--
-- Name: directoryinbox directoryinboxjob; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directoryinboxjob" ON "organization"."directoryinbox" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: directorymembership; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."directorymembership" ENABLE ROW LEVEL SECURITY;

--
-- Name: directorymembership directorymembershipapp; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directorymembershipapp" ON "organization"."directorymembership" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("organization_id"));


--
-- Name: directorymembership directorymembershipjob; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directorymembershipjob" ON "organization"."directorymembership" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: directorysubject; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."directorysubject" ENABLE ROW LEVEL SECURITY;

--
-- Name: directorysubject directorysubjectapp; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directorysubjectapp" ON "organization"."directorysubject" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "organization"."directoryconnection" "connection"
  WHERE (("connection"."id" = "directorysubject"."connection_id") AND "access"."scope_allowed"("connection"."organization_id")))));


--
-- Name: directorysubject directorysubjectjob; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "directorysubjectjob" ON "organization"."directorysubject" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: assignment jobscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "jobscope" ON "organization"."assignment" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: change jobscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "jobscope" ON "organization"."change" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: organization jobscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "jobscope" ON "organization"."organization" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: sourcebinding jobscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "jobscope" ON "organization"."sourcebinding" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: unitclosure jobscope; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "jobscope" ON "organization"."unitclosure" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: organization; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."organization" ENABLE ROW LEVEL SECURITY;

--
-- Name: sourcebinding; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."sourcebinding" ENABLE ROW LEVEL SECURITY;

--
-- Name: syncrun; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."syncrun" ENABLE ROW LEVEL SECURITY;

--
-- Name: syncrun syncrunapp; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "syncrunapp" ON "organization"."syncrun" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "organization"."directoryconnection" "connection"
  WHERE (("connection"."id" = "syncrun"."connection_id") AND "access"."scope_allowed"("connection"."organization_id")))));


--
-- Name: syncrun syncrunjob; Type: POLICY; Schema: organization; Owner: -
--

CREATE POLICY "syncrunjob" ON "organization"."syncrun" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: unitclosure; Type: ROW SECURITY; Schema: organization; Owner: -
--

ALTER TABLE "organization"."unitclosure" ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."agreement" ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."agreement" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: brand appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."brand" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: partner appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."partner" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: qualificationdocument appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."qualificationdocument" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: relationship appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."relationship" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: servicebinding appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."servicebinding" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: store appscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "appscope" ON "partner"."store" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: brand; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."brand" ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."agreement" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: brand jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."brand" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: partner jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."partner" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: qualificationdocument jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."qualificationdocument" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: relationship jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."relationship" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: servicebinding jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."servicebinding" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: store jobscope; Type: POLICY; Schema: partner; Owner: -
--

CREATE POLICY "jobscope" ON "partner"."store" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: partner; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."partner" ENABLE ROW LEVEL SECURITY;

--
-- Name: qualificationdocument; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."qualificationdocument" ENABLE ROW LEVEL SECURITY;

--
-- Name: relationship; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."relationship" ENABLE ROW LEVEL SECURITY;

--
-- Name: servicebinding; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."servicebinding" ENABLE ROW LEVEL SECURITY;

--
-- Name: store; Type: ROW SECURITY; Schema: partner; Owner: -
--

ALTER TABLE "partner"."store" ENABLE ROW LEVEL SECURITY;

--
-- Name: allocation; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."allocation" ENABLE ROW LEVEL SECURITY;

--
-- Name: allocation appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."allocation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: attempt appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."attempt" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: capture appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."capture" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: deadletterreview appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."deadletterreview" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: effect appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."effect" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: intent appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."intent" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: intenttender appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."intenttender" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ("payment"."intent" "intent"
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "intent"."order_id")))
  WHERE (("intent"."id" = "intenttender"."intent_id") AND "access"."scope_allowed"("orders"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("payment"."intent" "intent"
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "intent"."order_id")))
  WHERE (("intent"."id" = "intenttender"."intent_id") AND "access"."scope_allowed"("orders"."scope_id")))));


--
-- Name: observation appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."observation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: payment appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."payment" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: prepay appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."prepay" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: providerattempt appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."providerattempt" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: recoverycase appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."recoverycase" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: recoveryrequest appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."recoveryrequest" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: refund appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."refund" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: refundcommand appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."refundcommand" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: refundtender appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."refundtender" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM ((("payment"."refund" "refund"
     JOIN "payment"."payment" "payment" ON (("payment"."id" = "refund"."payment_id")))
     JOIN "payment"."intent" "intent" ON (("intent"."id" = "payment"."intent_id")))
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "intent"."order_id")))
  WHERE (("refund"."id" = "refundtender"."refund_id") AND "access"."scope_allowed"("orders"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("payment"."refund" "refund"
     JOIN "payment"."payment" "payment" ON (("payment"."id" = "refund"."payment_id")))
     JOIN "payment"."intent" "intent" ON (("intent"."id" = "payment"."intent_id")))
     JOIN "ordering"."orderrecord" "orders" ON (("orders"."id" = "intent"."order_id")))
  WHERE (("refund"."id" = "refundtender"."refund_id") AND "access"."scope_allowed"("orders"."scope_id")))));


--
-- Name: tender appscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appscope" ON "payment"."tender" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: refundreceipt appselect; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "appselect" ON "payment"."refundreceipt" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: attempt; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."attempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: capture; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."capture" ENABLE ROW LEVEL SECURITY;

--
-- Name: deadletterreview; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."deadletterreview" ENABLE ROW LEVEL SECURITY;

--
-- Name: effect; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."effect" ENABLE ROW LEVEL SECURITY;

--
-- Name: intent; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."intent" ENABLE ROW LEVEL SECURITY;

--
-- Name: intenttender; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."intenttender" ENABLE ROW LEVEL SECURITY;

--
-- Name: allocation jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."allocation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: attempt jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."attempt" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: capture jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."capture" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: deadletterreview jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."deadletterreview" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: effect jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."effect" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: intent jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."intent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: intenttender jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."intenttender" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: observation jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."observation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: payment jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."payment" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: prepay jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."prepay" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: providerattempt jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."providerattempt" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: recoverycase jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."recoverycase" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: recoveryrequest jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."recoveryrequest" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: refund jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."refund" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: refundcommand jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."refundcommand" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: refundreceipt jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."refundreceipt" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: refundtender jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."refundtender" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: tender jobscope; Type: POLICY; Schema: payment; Owner: -
--

CREATE POLICY "jobscope" ON "payment"."tender" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: observation; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."observation" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."payment" ENABLE ROW LEVEL SECURITY;

--
-- Name: prepay; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."prepay" ENABLE ROW LEVEL SECURITY;

--
-- Name: providerattempt; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."providerattempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: recoverycase; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."recoverycase" ENABLE ROW LEVEL SECURITY;

--
-- Name: recoveryrequest; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."recoveryrequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: refund; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."refund" ENABLE ROW LEVEL SECURITY;

--
-- Name: refundcommand; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."refundcommand" ENABLE ROW LEVEL SECURITY;

--
-- Name: refundreceipt; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."refundreceipt" ENABLE ROW LEVEL SECURITY;

--
-- Name: refundtender; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."refundtender" ENABLE ROW LEVEL SECURITY;

--
-- Name: tender; Type: ROW SECURITY; Schema: payment; Owner: -
--

ALTER TABLE "payment"."tender" ENABLE ROW LEVEL SECURITY;

--
-- Name: price appscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "appscope" ON "pricing"."price" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: pricebook appscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "appscope" ON "pricing"."pricebook" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: quote appscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "appscope" ON "pricing"."quote" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: rule appscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "appscope" ON "pricing"."rule" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: price jobscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "jobscope" ON "pricing"."price" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: pricebook jobscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "jobscope" ON "pricing"."pricebook" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: quote jobscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "jobscope" ON "pricing"."quote" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: rule jobscope; Type: POLICY; Schema: pricing; Owner: -
--

CREATE POLICY "jobscope" ON "pricing"."rule" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: price; Type: ROW SECURITY; Schema: pricing; Owner: -
--

ALTER TABLE "pricing"."price" ENABLE ROW LEVEL SECURITY;

--
-- Name: pricebook; Type: ROW SECURITY; Schema: pricing; Owner: -
--

ALTER TABLE "pricing"."pricebook" ENABLE ROW LEVEL SECURITY;

--
-- Name: quote; Type: ROW SECURITY; Schema: pricing; Owner: -
--

ALTER TABLE "pricing"."quote" ENABLE ROW LEVEL SECURITY;

--
-- Name: rule; Type: ROW SECURITY; Schema: pricing; Owner: -
--

ALTER TABLE "pricing"."rule" ENABLE ROW LEVEL SECURITY;

--
-- Name: changerequest appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."changerequest" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: evidence appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."evidence" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: policy appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."policy" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: policyversion appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."policyversion" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: profile appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."profile" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: purchaselimit appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."purchaselimit" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: resource appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."resource" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: subject appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."subject" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: tag appscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "appscope" ON "qualification"."tag" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: changerequest; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."changerequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: changerequest jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."changerequest" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: evidence jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."evidence" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policy jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."policy" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policyversion jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."policyversion" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: profile jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."profile" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: purchaselimit jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."purchaselimit" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: resource jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."resource" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: subject jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."subject" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: tag jobscope; Type: POLICY; Schema: qualification; Owner: -
--

CREATE POLICY "jobscope" ON "qualification"."tag" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policy; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."policy" ENABLE ROW LEVEL SECURITY;

--
-- Name: policyversion; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."policyversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: profile; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."profile" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchaselimit; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."purchaselimit" ENABLE ROW LEVEL SECURITY;

--
-- Name: resource; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."resource" ENABLE ROW LEVEL SECURITY;

--
-- Name: subject; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."subject" ENABLE ROW LEVEL SECURITY;

--
-- Name: tag; Type: ROW SECURITY; Schema: qualification; Owner: -
--

ALTER TABLE "qualification"."tag" ENABLE ROW LEVEL SECURITY;

--
-- Name: export appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."export" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: fact appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."fact" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: financeprojection appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."financeprojection" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: metric appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."metric" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: orderprojection appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."orderprojection" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: projectionevent appscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appscope" ON "reporting"."projectionevent" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: watermark appselect; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "appselect" ON "reporting"."watermark" FOR SELECT TO "shopapp" USING ("access"."scope_allowed"("scope_id"));


--
-- Name: export; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."export" ENABLE ROW LEVEL SECURITY;

--
-- Name: fact; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."fact" ENABLE ROW LEVEL SECURITY;

--
-- Name: financeprojection; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."financeprojection" ENABLE ROW LEVEL SECURITY;

--
-- Name: export jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."export" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: fact jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."fact" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: financeprojection jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."financeprojection" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: metric jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."metric" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: orderprojection jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."orderprojection" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: projectionevent jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."projectionevent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: watermark jobscope; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "jobscope" ON "reporting"."watermark" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: metric; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."metric" ENABLE ROW LEVEL SECURITY;

--
-- Name: orderprojection; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."orderprojection" ENABLE ROW LEVEL SECURITY;

--
-- Name: projectionevent; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."projectionevent" ENABLE ROW LEVEL SECURITY;

--
-- Name: fact readfact; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "readfact" ON "reporting"."fact" FOR SELECT TO "shopread" USING (true);


--
-- Name: metric readmetric; Type: POLICY; Schema: reporting; Owner: -
--

CREATE POLICY "readmetric" ON "reporting"."metric" FOR SELECT TO "shopread" USING (true);


--
-- Name: watermark; Type: ROW SECURITY; Schema: reporting; Owner: -
--

ALTER TABLE "reporting"."watermark" ENABLE ROW LEVEL SECURITY;

--
-- Name: case appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."case" FOR INSERT TO "shopapp" WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: decision appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."decision" FOR INSERT TO "shopapp" WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: listentry appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."listentry" FOR INSERT TO "shopapp" WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: policy appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."policy" FOR INSERT TO "shopapp" WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: policyversion appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."policyversion" FOR INSERT TO "shopapp" WITH CHECK ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "policyversion"."policy_id"))));


--
-- Name: replay appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."replay" FOR INSERT TO "shopapp" WITH CHECK ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "replay"."policy_id"))));


--
-- Name: signal appinsert; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appinsert" ON "risk"."signal" FOR INSERT TO "shopapp" WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: case appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."case" FOR SELECT TO "shopapp" USING ("risk"."scope_allowed"("scope_id"));


--
-- Name: decision appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."decision" FOR SELECT TO "shopapp" USING ("risk"."scope_allowed"("scope_id"));


--
-- Name: listentry appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."listentry" FOR SELECT TO "shopapp" USING ("risk"."scope_allowed"("scope_id"));


--
-- Name: policy appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."policy" FOR SELECT TO "shopapp" USING ("risk"."scope_allowed"("scope_id"));


--
-- Name: policyversion appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."policyversion" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "policyversion"."policy_id"))));


--
-- Name: replay appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."replay" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "replay"."policy_id"))));


--
-- Name: signal appselect; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appselect" ON "risk"."signal" FOR SELECT TO "shopapp" USING ("risk"."scope_allowed"("scope_id"));


--
-- Name: case appupdate; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appupdate" ON "risk"."case" FOR UPDATE TO "shopapp" USING ("risk"."scope_allowed"("scope_id")) WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: listentry appupdate; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appupdate" ON "risk"."listentry" FOR UPDATE TO "shopapp" USING ("risk"."scope_allowed"("scope_id")) WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: policy appupdate; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appupdate" ON "risk"."policy" FOR UPDATE TO "shopapp" USING ("risk"."scope_allowed"("scope_id")) WITH CHECK ("risk"."scope_allowed"("scope_id"));


--
-- Name: policyversion appupdate; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appupdate" ON "risk"."policyversion" FOR UPDATE TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "policyversion"."policy_id")))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "policyversion"."policy_id"))));


--
-- Name: replay appupdate; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "appupdate" ON "risk"."replay" FOR UPDATE TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "replay"."policy_id")))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "risk"."policy" "policy"
  WHERE ("policy"."id" = "replay"."policy_id"))));


--
-- Name: case; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."case" ENABLE ROW LEVEL SECURITY;

--
-- Name: decision; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."decision" ENABLE ROW LEVEL SECURITY;

--
-- Name: case jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."case" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: decision jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."decision" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: listentry jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."listentry" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policy jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."policy" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: policyversion jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."policyversion" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: replay jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."replay" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: signal jobscope; Type: POLICY; Schema: risk; Owner: -
--

CREATE POLICY "jobscope" ON "risk"."signal" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: listentry; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."listentry" ENABLE ROW LEVEL SECURITY;

--
-- Name: policy; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."policy" ENABLE ROW LEVEL SECURITY;

--
-- Name: policyversion; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."policyversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: replay; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."replay" ENABLE ROW LEVEL SECURITY;

--
-- Name: signal; Type: ROW SECURITY; Schema: risk; Owner: -
--

ALTER TABLE "risk"."signal" ENABLE ROW LEVEL SECURITY;

--
-- Name: deadletter appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."deadletter" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: event appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."event" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: idempotency appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."idempotency" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: inbox appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."inbox" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: job appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."job" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: lease appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."lease" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: operation appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."operation" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: outbox appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."outbox" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: projectionoffset appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."projectionoffset" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: rawenvelope appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."rawenvelope" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: reconciliationevidence appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."reconciliationevidence" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: reconciliationhash appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."reconciliationhash" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: schemaversion appscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appscope" ON "runtime"."schemaversion" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: contractcatalog appselect; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "appselect" ON "runtime"."contractcatalog" FOR SELECT TO "shopapp" USING (true);


--
-- Name: contractcatalog; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."contractcatalog" ENABLE ROW LEVEL SECURITY;

--
-- Name: deadletter; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."deadletter" ENABLE ROW LEVEL SECURITY;

--
-- Name: errorcontract; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."errorcontract" ENABLE ROW LEVEL SECURITY;

--
-- Name: errorcontract errorcontractapp; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "errorcontractapp" ON "runtime"."errorcontract" FOR SELECT TO "shopapp" USING (true);


--
-- Name: errorcontract errorcontractjob; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "errorcontractjob" ON "runtime"."errorcontract" FOR SELECT TO "shopjob" USING (true);


--
-- Name: event; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."event" ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."idempotency" ENABLE ROW LEVEL SECURITY;

--
-- Name: inbox; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."inbox" ENABLE ROW LEVEL SECURITY;

--
-- Name: job; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."job" ENABLE ROW LEVEL SECURITY;

--
-- Name: jobdefinition; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."jobdefinition" ENABLE ROW LEVEL SECURITY;

--
-- Name: jobdefinition jobdefinitionapp; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobdefinitionapp" ON "runtime"."jobdefinition" FOR SELECT TO "shopapp" USING (true);


--
-- Name: jobdefinition jobdefinitionjob; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobdefinitionjob" ON "runtime"."jobdefinition" FOR SELECT TO "shopjob" USING (true);


--
-- Name: deadletter jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."deadletter" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: event jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."event" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: idempotency jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."idempotency" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: inbox jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."inbox" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: job jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."job" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: lease jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."lease" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: operation jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."operation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: outbox jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."outbox" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: projectionoffset jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."projectionoffset" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: rawenvelope jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."rawenvelope" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reconciliationevidence jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."reconciliationevidence" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reconciliationhash jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."reconciliationhash" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: schemaversion jobscope; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobscope" ON "runtime"."schemaversion" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: contractcatalog jobselect; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "jobselect" ON "runtime"."contractcatalog" FOR SELECT TO "shopjob" USING (true);


--
-- Name: lease; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."lease" ENABLE ROW LEVEL SECURITY;

--
-- Name: migrationevidence; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."migrationevidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: migrationevidence migrationevidence; Type: POLICY; Schema: runtime; Owner: -
--

CREATE POLICY "migrationevidence" ON "runtime"."migrationevidence" FOR SELECT TO "shopmigration" USING (true);


--
-- Name: operation; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."operation" ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."outbox" ENABLE ROW LEVEL SECURITY;

--
-- Name: projectionoffset; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."projectionoffset" ENABLE ROW LEVEL SECURITY;

--
-- Name: rawenvelope; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."rawenvelope" ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliationevidence; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."reconciliationevidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliationhash; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."reconciliationhash" ENABLE ROW LEVEL SECURITY;

--
-- Name: schemaversion; Type: ROW SECURITY; Schema: runtime; Owner: -
--

ALTER TABLE "runtime"."schemaversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: account; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."account" ENABLE ROW LEVEL SECURITY;

--
-- Name: agent; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."agent" ENABLE ROW LEVEL SECURITY;

--
-- Name: account appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."account" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: agent appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."agent" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: assignment appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."assignment" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: assignmentrule appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."assignmentrule" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: conversation appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."conversation" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: escalation appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."escalation" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: evidence appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."evidence" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: history appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."history" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: message appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."message" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: sla appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."sla" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: ticket appscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "appscope" ON "support"."ticket" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: assignment; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."assignment" ENABLE ROW LEVEL SECURITY;

--
-- Name: assignmentrule; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."assignmentrule" ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."conversation" ENABLE ROW LEVEL SECURITY;

--
-- Name: escalation; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."escalation" ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."evidence" ENABLE ROW LEVEL SECURITY;

--
-- Name: history; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."history" ENABLE ROW LEVEL SECURITY;

--
-- Name: account jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."account" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: agent jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."agent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: assignment jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."assignment" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: assignmentrule jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."assignmentrule" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: conversation jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."conversation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: escalation jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."escalation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: evidence jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."evidence" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: history jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."history" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: message jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."message" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: sla jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."sla" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: ticket jobscope; Type: POLICY; Schema: support; Owner: -
--

CREATE POLICY "jobscope" ON "support"."ticket" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: message; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."message" ENABLE ROW LEVEL SECURITY;

--
-- Name: sla; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."sla" ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket; Type: ROW SECURITY; Schema: support; Owner: -
--

ALTER TABLE "support"."ticket" ENABLE ROW LEVEL SECURITY;

--
-- Name: attempt appscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "appscope" ON "verification"."attempt" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: device appscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "appscope" ON "verification"."device" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: nonce appscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "appscope" ON "verification"."nonce" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: session appscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "appscope" ON "verification"."session" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: attempt; Type: ROW SECURITY; Schema: verification; Owner: -
--

ALTER TABLE "verification"."attempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: device; Type: ROW SECURITY; Schema: verification; Owner: -
--

ALTER TABLE "verification"."device" ENABLE ROW LEVEL SECURITY;

--
-- Name: attempt jobscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "jobscope" ON "verification"."attempt" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: device jobscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "jobscope" ON "verification"."device" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: nonce jobscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "jobscope" ON "verification"."nonce" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: session jobscope; Type: POLICY; Schema: verification; Owner: -
--

CREATE POLICY "jobscope" ON "verification"."session" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: nonce; Type: ROW SECURITY; Schema: verification; Owner: -
--

ALTER TABLE "verification"."nonce" ENABLE ROW LEVEL SECURITY;

--
-- Name: session; Type: ROW SECURITY; Schema: verification; Owner: -
--

ALTER TABLE "verification"."session" ENABLE ROW LEVEL SECURITY;

--
-- Name: card allocatedscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "allocatedscope" ON "voucher"."card" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."allocation" "allocation"
  WHERE (("allocation"."cardpool_id" = "card"."cardpool_id") AND "access"."scope_allowed"("allocation"."scope_id")))));


--
-- Name: cardpool allocatedscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "allocatedscope" ON "voucher"."cardpool" FOR SELECT TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."allocation" "allocation"
  WHERE (("allocation"."cardpool_id" = "cardpool"."id") AND "access"."scope_allowed"("allocation"."scope_id")))));


--
-- Name: allocation; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."allocation" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."approval" ENABLE ROW LEVEL SECURITY;

--
-- Name: allocation appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."allocation" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: approval appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."approval" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: card appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."card" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."cardpool" "pool"
  WHERE (("pool"."id" = "card"."cardpool_id") AND "access"."scope_allowed"("pool"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "voucher"."cardpool" "pool"
  WHERE (("pool"."id" = "card"."cardpool_id") AND "access"."scope_allowed"("pool"."scope_id")))));


--
-- Name: cardpool appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."cardpool" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: hold appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."hold" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: importerror appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."importerror" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."importjob" "job"
  WHERE (("job"."id" = "importerror"."job_id") AND "access"."scope_allowed"("job"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "voucher"."importjob" "job"
  WHERE (("job"."id" = "importerror"."job_id") AND "access"."scope_allowed"("job"."scope_id")))));


--
-- Name: importjob appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."importjob" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: issuebatch appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."issuebatch" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: program appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."program" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: programversion appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."programversion" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."program" "program"
  WHERE (("program"."id" = "programversion"."program_id") AND "access"."scope_allowed"("program"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "voucher"."program" "program"
  WHERE (("program"."id" = "programversion"."program_id") AND "access"."scope_allowed"("program"."scope_id")))));


--
-- Name: redemption appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."redemption" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: reserve appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."reserve" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: reserverequest appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."reserverequest" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: reversal appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."reversal" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: statusbatch appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."statusbatch" TO "shopapp" USING ("access"."scope_allowed"("scope_id")) WITH CHECK ("access"."scope_allowed"("scope_id"));


--
-- Name: statusevent appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."statusevent" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: statusitem appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."statusitem" TO "shopapp" USING ((EXISTS ( SELECT 1
   FROM "voucher"."statusbatch" "batch"
  WHERE (("batch"."id" = "statusitem"."batch_id") AND "access"."scope_allowed"("batch"."scope_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "voucher"."statusbatch" "batch"
  WHERE (("batch"."id" = "statusitem"."batch_id") AND "access"."scope_allowed"("batch"."scope_id")))));


--
-- Name: voucher appscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "appscope" ON "voucher"."voucher" TO "shopapp" USING (("current_setting"('app.workload'::"text", true) = 'api'::"text")) WITH CHECK (("current_setting"('app.workload'::"text", true) = 'api'::"text"));


--
-- Name: card; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."card" ENABLE ROW LEVEL SECURITY;

--
-- Name: cardpool; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."cardpool" ENABLE ROW LEVEL SECURITY;

--
-- Name: hold; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."hold" ENABLE ROW LEVEL SECURITY;

--
-- Name: importerror; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."importerror" ENABLE ROW LEVEL SECURITY;

--
-- Name: importjob; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."importjob" ENABLE ROW LEVEL SECURITY;

--
-- Name: importrow; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."importrow" ENABLE ROW LEVEL SECURITY;

--
-- Name: issuebatch; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."issuebatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: allocation jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."allocation" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: approval jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."approval" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: card jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."card" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: cardpool jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."cardpool" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: hold jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."hold" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importerror jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."importerror" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importjob jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."importjob" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: importrow jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."importrow" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: issuebatch jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."issuebatch" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: program jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."program" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: programversion jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."programversion" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: redemption jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."redemption" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reserve jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."reserve" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reserverequest jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."reserverequest" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: reversal jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."reversal" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statusbatch jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."statusbatch" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statusevent jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."statusevent" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: statusitem jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."statusitem" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: voucher jobscope; Type: POLICY; Schema: voucher; Owner: -
--

CREATE POLICY "jobscope" ON "voucher"."voucher" TO "shopjob" USING (true) WITH CHECK (true);


--
-- Name: program; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."program" ENABLE ROW LEVEL SECURITY;

--
-- Name: programversion; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."programversion" ENABLE ROW LEVEL SECURITY;

--
-- Name: redemption; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."redemption" ENABLE ROW LEVEL SECURITY;

--
-- Name: reserve; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."reserve" ENABLE ROW LEVEL SECURITY;

--
-- Name: reserverequest; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."reserverequest" ENABLE ROW LEVEL SECURITY;

--
-- Name: reversal; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."reversal" ENABLE ROW LEVEL SECURITY;

--
-- Name: statusbatch; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."statusbatch" ENABLE ROW LEVEL SECURITY;

--
-- Name: statusevent; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."statusevent" ENABLE ROW LEVEL SECURITY;

--
-- Name: statusitem; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."statusitem" ENABLE ROW LEVEL SECURITY;

--
-- Name: voucher; Type: ROW SECURITY; Schema: voucher; Owner: -
--

ALTER TABLE "voucher"."voucher" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 3uBFKepCLnQMyp8yiV6XVnhzZK7Dh2AcpVaLcDQgJV79diOJb8EZOA0NWgLGseu

