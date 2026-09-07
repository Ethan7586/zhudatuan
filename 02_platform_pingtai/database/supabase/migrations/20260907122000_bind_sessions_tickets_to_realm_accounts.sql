begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:bind-sessions-tickets-to-realm-accounts:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_REALM_SESSION_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907121000'
        and checksum='13c5a9190640b6dd12827e83a336e202d639c74a41ec83053e9a20926a67fc3a')
    or exists(select 1 from runtime.schemaversion where version>'20260907121000') then
    raise exception 'IDENTITY_REALM_SESSION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table access.membership add constraint membership_id_account_realm_unique unique(id,account_id,realm_id);

alter table identity.session add column realm_id text;
alter table identity.session add column account_id text;
alter table identity.session add column auth_target text;

update identity.session session
set realm_id=membership.realm_id,
  account_id=membership.account_id,
  auth_target=coalesce(
    (select ticket.target from identity.authticket ticket
      join identity.realmtarget target on target.realm_id=membership.realm_id and target.target=ticket.target
      where ticket.session_id=session.id order by ticket.created_at desc,ticket.id limit 1),
    (select min(target.target) from identity.realmtarget target
      where target.realm_id=membership.realm_id and target.membership_client=session.client
        and target.membership_organization_id=membership.organization_id)
  )
from access.membership membership
where membership.id=session.membership_id and membership.account_id is not null and membership.realm_id is not null;

update identity.session set revoked_at=coalesce(revoked_at,clock_timestamp()),
  revoked_reason=coalesce(revoked_reason,'realm_account_unclassified')
where revoked_at is null and (realm_id is null or account_id is null or auth_target is null);

alter table identity.session add constraint identity_session_realm_account
  foreign key(account_id,realm_id) references identity.account(id,realm_id);
alter table identity.session add constraint identity_session_membership_account_realm
  foreign key(membership_id,account_id,realm_id) references access.membership(id,account_id,realm_id);
alter table identity.session add constraint identity_session_realm_target
  foreign key(realm_id,auth_target) references identity.realmtarget(realm_id,target);
alter table identity.session add constraint identity_session_active_realm_account
  check(revoked_at is not null or (realm_id is not null and account_id is not null and auth_target is not null));
alter table identity.session add constraint identity_session_id_account_realm_unique unique(id,account_id,realm_id);
create index identity_session_account_active_idx on identity.session(account_id,realm_id,last_seen_at desc)
  where revoked_at is null;

alter table identity.authticket add column realm_id text;
alter table identity.authticket add column account_id text;
update identity.authticket ticket set realm_id=session.realm_id,account_id=session.account_id
from identity.session session where session.id=ticket.session_id;
update identity.authticket ticket set consumed_at=coalesce(ticket.consumed_at,clock_timestamp())
where ticket.consumed_at is null and (ticket.realm_id is null or ticket.account_id is null
  or not exists(select 1 from identity.session session where session.id=ticket.session_id
    and session.account_id=ticket.account_id and session.realm_id=ticket.realm_id and session.auth_target=ticket.target
    and session.revoked_at is null));
alter table identity.authticket add constraint identity_authticket_session_account_realm
  foreign key(session_id,account_id,realm_id) references identity.session(id,account_id,realm_id) on delete cascade;
alter table identity.authticket add constraint identity_authticket_realm_target
  foreign key(realm_id,target) references identity.realmtarget(realm_id,target);
alter table identity.authticket add constraint identity_authticket_active_realm_account
  check(consumed_at is not null or (realm_id is not null and account_id is not null));
create index identity_authticket_realm_account_active_idx on identity.authticket(realm_id,account_id,expires_at)
  where consumed_at is null;

drop function identity.resolve_session(text);
create function identity.resolve_session(p_token_hash text,p_entry_host text)
returns table(actor_id text,account_id text,realm_id text,session_id text,membership_id text,
  credential_version bigint,access_version bigint,target text,assurance_level smallint,assurance_verified_at timestamptz)
language sql stable security definer set search_path=identity,member,access,public,pg_temp as $function$
  select account.legacy_principal_id,account.id,account.realm_id,session.id,session.membership_id,
    session.credential_version,session.access_version,
    case target.membership_client when 'operator' then 'console' else target.membership_client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null and phone.verified_at is not null
      then stepup.verified_at else null end
  from identity.session session
  join identity.account account on account.id=session.account_id and account.realm_id=session.realm_id
  join access.membership membership on membership.id=session.membership_id
    and membership.account_id=account.id and membership.realm_id=account.realm_id
  join identity.realmtarget target on target.realm_id=session.realm_id and target.target=session.auth_target
    and target.membership_client=membership.client and target.membership_organization_id=membership.organization_id
  join identity.realmentry entry on entry.realm_id=session.realm_id and entry.host=p_entry_host and entry.status='active'
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.account_id=account.id and evidence.realm_id=account.realm_id
      and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1) phone on true
  left join lateral (select evidence.verified_at from identity.assurance evidence
    where evidence.account_id=account.id and evidence.realm_id=account.realm_id and evidence.level>=3
      and evidence.evidence_hash=encode(public.digest(session.id::text,'sha256'),'hex')
      and evidence.verified_at>=clock_timestamp()-interval '15 minutes'
      and evidence.verified_at<=clock_timestamp()
      and evidence.expires_at is not null and evidence.expires_at>clock_timestamp()
    order by evidence.level desc,evidence.verified_at desc limit 1) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=account.credential_version and account.status='active'
    and account.legacy_principal_id=session.principal_id and membership.status='active'
    and session.access_version=membership.access_version and session.client=membership.client
$function$;
revoke all on function identity.resolve_session(text,text) from public;
grant execute on function identity.resolve_session(text,text) to shopapp,zhudatuanidentityapi;
grant execute on function identity.resolve_session(text,text)
  to shopconsole,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;

insert into runtime.schemaversion(version,checksum)
values('20260907122000','19f181de3eae51676173fd003c496f83ac3e82de5e40be21537acc3020167700');

do $assert$
begin
  if exists(select 1 from identity.session session where session.revoked_at is null
      and (session.realm_id is null or session.account_id is null or session.auth_target is null))
    or exists(select 1 from identity.session session join access.membership membership on membership.id=session.membership_id
      where session.revoked_at is null
        and (session.account_id<>membership.account_id or session.realm_id<>membership.realm_id))
    or exists(select 1 from identity.authticket ticket where ticket.consumed_at is null
      and (ticket.realm_id is null or ticket.account_id is null))
    or not exists(select 1 from runtime.schemaversion
      where version='20260907122000'
        and checksum='19f181de3eae51676173fd003c496f83ac3e82de5e40be21537acc3020167700') then
    raise exception 'IDENTITY_REALM_SESSION_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
