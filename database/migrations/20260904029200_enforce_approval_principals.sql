begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029100') then raise exception 'APPROVAL_PRINCIPAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029200') then raise exception 'APPROVAL_PRINCIPAL_ALREADY_APPLIED'; end if;
  -- Existing membership bindings are not evidence of the principal at the time of a historical decision.
  if exists(select 1 from approval.instances) then raise exception 'APPROVAL_PRINCIPAL_EVIDENCE_REQUIRED'; end if;
end
$precondition$;

create function access.subject_principal(p_membership text,p_active boolean)
returns text language sql stable security definer set search_path=pg_catalog,access,identity,pg_temp as $$
  select principal.id from access.membership membership
  join identity.principal principal on principal.id=membership.principal_id
  where membership.id=p_membership and (not p_active or membership.status='active' and principal.status='active')
$$;

create function access.memberships_independent(p_maker text,p_checker text)
returns boolean language sql stable security definer set search_path=pg_catalog,access,pg_temp as $$
  select coalesce(access.subject_principal(p_maker,true)<>access.subject_principal(p_checker,true),false)
$$;

create function access.guard_membership_principal()
returns trigger language plpgsql set search_path=pg_catalog,access,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'MEMBERSHIP_PRINCIPAL_IMMUTABLE'; end if;
  if new.id<>old.id or new.principal_id<>old.principal_id then raise exception 'MEMBERSHIP_PRINCIPAL_IMMUTABLE'; end if;
  return new;
end
$$;
create trigger access_membership_principal_immutable before update or delete on access.membership
for each row execute function access.guard_membership_principal();

create function access.guard_proof_separation()
returns trigger language plpgsql set search_path=pg_catalog,access,pg_temp as $$
begin
  if not access.memberships_independent(new.maker_membership_id,new.checker_membership_id) then
    raise exception 'MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;
  if tg_op='UPDATE' and (new.maker_membership_id<>old.maker_membership_id or new.checker_membership_id<>old.checker_membership_id) then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  return new;
end
$$;
create trigger access_actionproof_separation before insert or update on access.actionproof
for each row execute function access.guard_proof_separation();
create trigger identity_stepuprequest_separation before insert or update on identity.stepuprequest
for each row execute function access.guard_proof_separation();

alter table approval.instances add column requester_principal_id text not null;
alter table approval.decisions add column actor_principal_id text not null;
alter table approval.decisions drop constraint decisions_task_id_actor_id_key;
alter table approval.decisions add constraint approval_decision_principal unique(task_id,actor_principal_id);

create function approval.guard_requester()
returns trigger language plpgsql set search_path=pg_catalog,approval,access,pg_temp as $$
declare principal text;
begin
  if tg_op='UPDATE' then
    if (new.id,new.tenant_id,new.scope_id,new.requester_id,new.requester_principal_id,new.amount_minor,new.currency,new.created_at,new.expires_at)
      is distinct from (old.id,old.tenant_id,old.scope_id,old.requester_id,old.requester_principal_id,old.amount_minor,old.currency,old.created_at,old.expires_at) then
      raise exception 'APPROVAL_INSTANCE_BINDING_IMMUTABLE';
    end if;
    return new;
  end if;
  principal:=access.subject_principal(new.requester_id,true);
  if principal is null or (new.requester_principal_id is not null and new.requester_principal_id<>principal)
    or (nullif(current_setting('app.membership_id',true),'') is not null and current_setting('app.membership_id',true)<>new.requester_id)
    or (nullif(current_setting('app.actor_id',true),'') is not null and current_setting('app.actor_id',true)<>principal) then
    raise exception 'AUTHORIZATION_DENIED';
  end if;
  new.requester_principal_id:=principal;
  return new;
end
$$;
create trigger approval_requester_capture before insert or update on approval.instances
for each row execute function approval.guard_requester();

create or replace function approval.guard_decision()
returns trigger language plpgsql set search_path=pg_catalog,approval,access,pg_temp as $$
declare requester text; principal text;
begin
  if tg_op<>'INSERT' then raise exception 'APPROVAL_DECISION_IMMUTABLE'; end if;
  select instance.requester_principal_id into requester from approval.instances instance
  join approval.tasks task on task.instance_id=instance.id and task.scope_id=instance.scope_id and task.tenant_id=instance.tenant_id
  where instance.id=new.instance_id and instance.scope_id=new.scope_id and instance.tenant_id=new.tenant_id and task.id=new.task_id
  for key share of instance,task;
  if requester is null then raise exception 'APPROVAL_DECISION_SUBJECT_INVALID'; end if;
  principal:=access.subject_principal(new.actor_id,true);
  if principal is null or (new.actor_principal_id is not null and new.actor_principal_id<>principal)
    or (nullif(current_setting('app.membership_id',true),'') is not null and current_setting('app.membership_id',true)<>new.actor_id)
    or (nullif(current_setting('app.actor_id',true),'') is not null and current_setting('app.actor_id',true)<>principal) then
    raise exception 'AUTHORIZATION_DENIED';
  end if;
  if requester=principal then raise exception 'APPROVAL_SELF_DECISION_FORBIDDEN'; end if;
  new.actor_principal_id:=principal;
  return new;
end
$$;

create function approval.guard_proof_subject()
returns trigger language plpgsql set search_path=pg_catalog,approval,access,pg_temp as $$
declare instance approval.instances%rowtype; principal text;
begin
  select * into instance from approval.instances where id=new.instance_id and scope_id=new.scope_id and tenant_id=new.tenant_id;
  principal:=access.subject_principal(new.checker_id,true);
  if instance.id is null or instance.state<>'approved' or principal is null then raise exception 'APPROVAL_PROOF_INVALID'; end if;
  if principal=instance.requester_principal_id then raise exception 'APPROVAL_SELF_DECISION_FORBIDDEN'; end if;
  if (new.subject_kind,new.subject_id,new.subject_version,new.action,new.evidence_hash,new.amount_minor,new.currency,new.constraints)
    is distinct from (instance.subject_kind,instance.subject_id,instance.subject_version,instance.action,instance.evidence_hash,instance.amount_minor,instance.currency,instance.constraints)
    or not exists(select 1 from approval.decisions decision where decision.instance_id=instance.id and decision.scope_id=instance.scope_id
      and decision.actor_id=new.checker_id and decision.actor_principal_id=principal and decision.outcome='approved' and decision.proof_id=new.id) then
    raise exception 'APPROVAL_PROOF_INVALID';
  end if;
  return new;
end
$$;
create trigger approval_proof_subject before insert or update on approval.proofs
for each row execute function approval.guard_proof_subject();

revoke all on function access.subject_principal(text,boolean),access.memberships_independent(text,text),access.guard_membership_principal(),access.guard_proof_separation(),approval.guard_requester(),approval.guard_proof_subject() from public;
grant execute on function access.subject_principal(text,boolean),access.memberships_independent(text,text) to shopapp,shopjob;

select runtime.record_migration_evidence('20260904029200',0,0,0,0,
  'select count(*) from approval.decisions where actor_principal_id is null;',
  'select task_id,actor_principal_id,count(*) from approval.decisions group by task_id,actor_principal_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260904029200',encode(public.digest('20260904029200_enforce_approval_principals','sha256'),'hex'));

commit;
