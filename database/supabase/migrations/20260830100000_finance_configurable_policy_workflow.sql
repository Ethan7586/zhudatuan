begin;

-- Configurable finance policies are edited as expiring previews and append-only
-- revisions.  finance.policy remains the approved active/retired pointer only.
alter table finance.policy drop constraint if exists policy_scope_id_kind_key;
alter table finance.policy drop constraint if exists finance_policy_scope_id_kind_key;
create unique index finance_policy_legacy_scope_kind on finance.policy(scope_id,kind)
where kind not in('tax','field-definition');

create table finance.policypreview(
  id text primary key,
  policy_id text not null,
  scope_id text not null,
  action text not null check(action in('saveDraft','submit','approve','reject')),
  kind text not null,
  rule jsonb not null check(jsonb_typeof(rule)='object'),
  desired_state text not null check(desired_state in('active','retired')),
  effective_from date not null,
  effective_to date,
  source_version bigint not null check(source_version>=0),
  source_hash char(64) not null,
  preview_hash char(64) not null unique,
  proposed_by text not null,
  idempotency_key text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_revision_version bigint check(consumed_revision_version>0),
  unique(scope_id,idempotency_key),
  check(effective_to is null or effective_to>=effective_from),
  check(expires_at>created_at),
  check((consumed_at is null)=(consumed_revision_version is null))
);

create table finance.policyrevision(
  policy_id text not null,
  version bigint not null check(version>=0),
  scope_id text not null,
  kind text not null,
  rule jsonb not null check(jsonb_typeof(rule)='object'),
  state text not null check(state in('draft','submitted','active','rejected','retired')),
  desired_state text not null check(desired_state in('active','retired')),
  effective_from date not null,
  effective_to date,
  source_version bigint not null check(source_version>=0 and source_version<=version),
  source_hash char(64) not null,
  revision_hash char(64) not null unique,
  preview_hash char(64) not null unique,
  action text not null check(action in('saveDraft','submit','approve','reject')),
  proposed_by text not null,
  submitted_by text,
  approved_by text,
  rejected_by text,
  acted_by text not null,
  reason text not null check(reason<>'' and length(reason)<=1000),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  idempotency_key text not null,
  request_hash char(64) not null check(request_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  primary key(policy_id,version),
  unique(scope_id,idempotency_key),
  check(effective_to is null or effective_to>=effective_from),
  check(approved_by is null or approved_by<>proposed_by),
  check(rejected_by is null or rejected_by<>proposed_by),
  check(
    (state='draft' and action='saveDraft' and submitted_by is null and approved_by is null
      and rejected_by is null and submitted_at is null and decided_at is null)
    or (state='submitted' and action='submit' and submitted_by=proposed_by and approved_by is null
      and rejected_by is null and submitted_at is not null and decided_at is null)
    or (state in('active','retired') and action='approve' and submitted_by=proposed_by
      and approved_by is not null and rejected_by is null and submitted_at is not null and decided_at is not null
      and state=desired_state)
    or (state='rejected' and action='reject' and submitted_by=proposed_by and approved_by is null
      and rejected_by is not null and submitted_at is not null and decided_at is not null)
  )
);

create table access.policyactionauthorization(
  transaction_id bigint not null,
  actor_id text not null,
  scope_id text not null,
  operation text not null check(operation='finance.policies.manage'),
  resource_id text not null,
  idempotency_key text not null,
  expected_version bigint not null check(expected_version>=0),
  request_hash char(64) not null,
  primary key(transaction_id,operation,idempotency_key)
);

create or replace function finance.reject_policy_revision_mutation()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin
  raise exception 'FINANCE_POLICY_REVISION_IMMUTABLE';
end $function$;

create or replace function finance.guard_policy_preview_consumption()
returns trigger language plpgsql set search_path=finance,pg_temp as $function$
begin
  if tg_op='DELETE' then raise exception 'FINANCE_POLICY_PREVIEW_IMMUTABLE'; end if;
  if row(new.id,new.policy_id,new.scope_id,new.action,new.kind,new.rule,new.desired_state,
      new.effective_from,new.effective_to,new.source_version,new.source_hash,new.preview_hash,
      new.proposed_by,new.idempotency_key,new.created_at,new.expires_at)
    is distinct from
    row(old.id,old.policy_id,old.scope_id,old.action,old.kind,old.rule,old.desired_state,
      old.effective_from,old.effective_to,old.source_version,old.source_hash,old.preview_hash,
      old.proposed_by,old.idempotency_key,old.created_at,old.expires_at)
    or old.consumed_at is not null or new.consumed_at is null or new.consumed_revision_version is null
  then raise exception 'FINANCE_POLICY_PREVIEW_IMMUTABLE'; end if;
  return new;
end $function$;

create trigger finance_policyrevision_immutable before update or delete
on finance.policyrevision for each row execute function finance.reject_policy_revision_mutation();
create trigger finance_policypreview_guard before update or delete
on finance.policypreview for each row execute function finance.guard_policy_preview_consumption();

-- Preserve the current approved pointer as the first immutable revision.  No
-- historical state is invented: legacy rows contribute only their current fact.
insert into finance.policyrevision(
  policy_id,version,scope_id,kind,rule,state,desired_state,effective_from,effective_to,
  source_version,source_hash,revision_hash,preview_hash,action,proposed_by,submitted_by,
  approved_by,rejected_by,acted_by,reason,evidence,idempotency_key,request_hash,created_at,submitted_at,decided_at
)
select policy.id,policy.version,policy.scope_id,policy.kind,policy.rule,
  case policy.state when 'draft' then 'draft' when 'retired' then 'retired' else 'active' end,
  case policy.state when 'retired' then 'retired' else 'active' end,
  '1970-01-01',null,greatest(policy.version-1,0),
  encode(public.digest('legacy-source:'||policy.id||':'||policy.version,'sha256'),'hex'),
  encode(public.digest(jsonb_build_object(
    'policyId',policy.id,'scopeId',policy.scope_id,'version',policy.version,
    'state',case policy.state when 'draft' then 'draft' when 'retired' then 'retired' else 'active' end,
    'desiredState',case policy.state when 'retired' then 'retired' else 'active' end,
    'kind',policy.kind,'rule',policy.rule,'effectiveFrom','1970-01-01'::date,'effectiveTo',null::date,
    'sourceVersion',greatest(policy.version-1,0),
    'sourceHash',encode(public.digest('legacy-source:'||policy.id||':'||policy.version,'sha256'),'hex'),
    'previewHash',encode(public.digest('legacy-preview:'||policy.id||':'||policy.version,'sha256'),'hex'),
    'action',case policy.state when 'draft' then 'saveDraft' else 'approve' end,
    'proposedBy','system:finance-policy-migration',
    'submittedBy',case when policy.state='draft' then null else 'system:finance-policy-migration' end,
    'approvedBy',case when policy.state='draft' then null else 'system:finance-policy-migration-reviewer' end,
    'rejectedBy',null::text,'actedBy','system:finance-policy-migration',
    'reason','Legacy current policy sealed as first revision','evidence','{}'::jsonb,
    'idempotencyKey','migration:'||policy.id||':'||policy.version,
    'requestHash',encode(public.digest('migration-request:'||policy.id||':'||policy.version,'sha256'),'hex')
  )::text,'sha256'),'hex'),
  encode(public.digest('legacy-preview:'||policy.id||':'||policy.version,'sha256'),'hex'),
  case policy.state when 'draft' then 'saveDraft' else 'approve' end,
  'system:finance-policy-migration',
  case when policy.state='draft' then null else 'system:finance-policy-migration' end,
  case when policy.state='draft' then null else 'system:finance-policy-migration-reviewer' end,
  null,'system:finance-policy-migration','Legacy current policy sealed as first revision','{}'::jsonb,
  'migration:'||policy.id||':'||policy.version,
  encode(public.digest('migration-request:'||policy.id||':'||policy.version,'sha256'),'hex'),clock_timestamp(),
  case when policy.state='draft' then null else clock_timestamp() end,
  case when policy.state='draft' then null else clock_timestamp() end
from finance.policy policy;

create or replace function finance.assert_configurable_policy(
  p_kind text,p_rule jsonb,p_effective_from date,p_effective_to date
) returns boolean language plpgsql stable security definer
set search_path=finance,pg_temp as $function$
declare
  datatype text;
  rulefrom date;
  ruleto date;
  optioncount bigint;
  distinctoptions bigint;
begin
  if p_kind is null or p_kind='' or p_rule is null or jsonb_typeof(p_rule)<>'object'
    or p_effective_from is null or not isfinite(p_effective_from)
    or (p_effective_to is not null and (not isfinite(p_effective_to) or p_effective_to<p_effective_from))
  then raise exception 'FINANCE_CONFIG_POLICY_INVALID'; end if;

  if p_kind in('tax','field-definition') then
    if jsonb_typeof(p_rule->'effectiveFrom')<>'string'
      or (p_rule ? 'effectiveTo' and jsonb_typeof(p_rule->'effectiveTo')<>'string')
    then raise exception 'FINANCE_CONFIG_POLICY_EFFECTIVE_RANGE_INVALID'; end if;
    begin
      rulefrom:=(p_rule->>'effectiveFrom')::date;
      ruleto:=case when p_rule ? 'effectiveTo' then (p_rule->>'effectiveTo')::date else null end;
    exception when others then
      raise exception 'FINANCE_CONFIG_POLICY_EFFECTIVE_RANGE_INVALID';
    end;
    if rulefrom is distinct from p_effective_from or ruleto is distinct from p_effective_to
      or ruleto is not null and ruleto<rulefrom
    then raise exception 'FINANCE_CONFIG_POLICY_EFFECTIVE_RANGE_INVALID'; end if;
  end if;

  if p_kind='field-definition' then
    if not p_rule ?& array['code','label','appliesTo','dataType','required','options','effectiveFrom']
      or exists(select 1 from jsonb_object_keys(p_rule) key where key not in(
        'code','label','appliesTo','dataType','required','unit','options','description','effectiveFrom','effectiveTo'))
      or jsonb_typeof(p_rule->'code')<>'string' or jsonb_typeof(p_rule->'label')<>'string'
      or jsonb_typeof(p_rule->'appliesTo')<>'string' or jsonb_typeof(p_rule->'dataType')<>'string'
      or coalesce(p_rule->>'code','')!~'^[a-z][a-z0-9_.-]{1,63}$'
      or coalesce(p_rule->>'label','')='' or length(p_rule->>'label')>80
      or p_rule->>'appliesTo' not in('tax_rule','invoice','settlement','reconciliation','journal',
        'accounts_receivable','accounts_payable','channel_clearing','distributor_commission','withdrawal','period_close')
      or p_rule->>'dataType' not in('text','integer','decimal','date','datetime','boolean','select','multiselect',
        'country','region','currency','money','percentage','reference')
      or jsonb_typeof(p_rule->'required')<>'boolean'
      or (p_rule ? 'unit' and (jsonb_typeof(p_rule->'unit')<>'string' or length(p_rule->>'unit')>24
        or p_rule->>'unit'<>btrim(p_rule->>'unit')))
      or (p_rule ? 'description' and (jsonb_typeof(p_rule->'description')<>'string' or length(p_rule->>'description')>240
        or p_rule->>'description'<>btrim(p_rule->>'description')))
      or jsonb_typeof(p_rule->'options')<>'array' or jsonb_array_length(p_rule->'options')>100
      or exists(select 1 from jsonb_array_elements(p_rule->'options') option
        where jsonb_typeof(option)<>'string' or length(option#>>'{}')=0 or length(option#>>'{}')>80
          or option#>>'{}'<>btrim(option#>>'{}'))
    then raise exception 'FINANCE_FIELD_DEFINITION_INVALID'; end if;
    datatype:=p_rule->>'dataType';
    select count(*),count(distinct value) into optioncount,distinctoptions
    from jsonb_array_elements_text(p_rule->'options');
    if optioncount<>distinctoptions or (datatype in('select','multiselect'))<>(optioncount>0)
    then raise exception 'FINANCE_FIELD_OPTIONS_INVALID'; end if;
  elsif p_kind='tax' then
    if not p_rule ?& array['name','countryCode','taxType','productTaxCategory','ratePpm','priceInclusive',
        'calculationMethod','roundingMode','priority','effectiveFrom','sourceReference']
      or exists(select 1 from jsonb_object_keys(p_rule) key where key not in(
        'name','countryCode','regionCode','taxType','productTaxCategory','hsCode','ratePpm','priceInclusive',
        'calculationMethod','roundingMode','priority','effectiveFrom','effectiveTo','sourceReference'))
      or jsonb_typeof(p_rule->'name')<>'string' or jsonb_typeof(p_rule->'countryCode')<>'string'
      or jsonb_typeof(p_rule->'taxType')<>'string' or jsonb_typeof(p_rule->'productTaxCategory')<>'string'
      or jsonb_typeof(p_rule->'calculationMethod')<>'string' or jsonb_typeof(p_rule->'roundingMode')<>'string'
      or jsonb_typeof(p_rule->'sourceReference')<>'string'
      or coalesce(p_rule->>'name','')='' or length(p_rule->>'name')>120 or p_rule->>'name'<>btrim(p_rule->>'name')
      or coalesce(p_rule->>'countryCode','')!~'^[A-Z]{2}$'
      or (p_rule ? 'regionCode' and (jsonb_typeof(p_rule->'regionCode')<>'string' or length(p_rule->>'regionCode')>64
        or p_rule->>'regionCode'<>btrim(p_rule->>'regionCode')))
      or p_rule->>'taxType' not in('vat','gst','sales_tax','excise','customs')
      or coalesce(p_rule->>'productTaxCategory','')='' or length(p_rule->>'productTaxCategory')>80
        or p_rule->>'productTaxCategory'<>btrim(p_rule->>'productTaxCategory')
      or (p_rule ? 'hsCode' and (jsonb_typeof(p_rule->'hsCode')<>'string' or length(p_rule->>'hsCode')>64
        or p_rule->>'hsCode'<>btrim(p_rule->>'hsCode')))
      or jsonb_typeof(p_rule->'ratePpm')<>'number' or p_rule->>'ratePpm'!~'^(0|[1-9][0-9]*)$'
      or (p_rule->>'ratePpm')::numeric>1000000
      or jsonb_typeof(p_rule->'priceInclusive')<>'boolean'
      or p_rule->>'calculationMethod' not in('exclusive','inclusive','compound')
      or p_rule->>'roundingMode' not in('line','order','invoice')
      or jsonb_typeof(p_rule->'priority')<>'number' or p_rule->>'priority'!~'^(0|[1-9][0-9]*)$'
      or (p_rule->>'priority')::numeric>10000
      or coalesce(p_rule->>'sourceReference','')='' or length(p_rule->>'sourceReference')>500
        or p_rule->>'sourceReference'<>btrim(p_rule->>'sourceReference')
    then raise exception 'FINANCE_TAX_RULE_INVALID'; end if;
  end if;
  return true;
end $function$;

create or replace function finance.assert_configurable_policy_conflict(
  p_policy text,p_scope text,p_kind text,p_rule jsonb,p_effective_from date,p_effective_to date
) returns boolean language plpgsql stable security definer
set search_path=finance,pg_temp as $function$
begin
  if p_kind not in('tax','field-definition') then
    if exists(select 1 from finance.policy where scope_id=p_scope and kind=p_kind and id<>p_policy)
    then raise exception 'FINANCE_POLICY_KIND_CONFLICT'; end if;
    return true;
  end if;
  if exists(
    select 1 from finance.policy policy
    where policy.scope_id=p_scope and policy.kind=p_kind and policy.state='active'
      and not exists(select 1 from finance.policyrevision revision
        where revision.policy_id=policy.id and revision.scope_id=policy.scope_id
          and revision.version=policy.version and revision.state='active')
  ) then raise exception 'FINANCE_POLICY_ACTIVE_POINTER_INVALID'; end if;
  if p_kind='field-definition' and exists(
    with latest as(
      select distinct on(policy_id) policy_id,rule,state,desired_state,effective_from,effective_to
      from finance.policyrevision where scope_id=p_scope and kind='field-definition'
      order by policy_id,version desc
    ),candidate as(
      select policy_id,rule,effective_from,effective_to from latest
      where state in('draft','submitted') and desired_state='active'
      union all
      select policy.id,policy.rule,revision.effective_from,revision.effective_to
      from finance.policy policy join finance.policyrevision revision
        on revision.policy_id=policy.id and revision.scope_id=policy.scope_id and revision.version=policy.version
      where policy.scope_id=p_scope and policy.kind='field-definition' and policy.state='active'
    ) select 1 from candidate where policy_id<>p_policy and rule->>'code'=p_rule->>'code'
      and daterange(effective_from,effective_to,'[]') && daterange(p_effective_from,p_effective_to,'[]')
  ) then raise exception 'FINANCE_FIELD_DEFINITION_OVERLAP'; end if;
  if p_kind='tax' and exists(
    with latest as(
      select distinct on(policy_id) policy_id,rule,state,desired_state,effective_from,effective_to
      from finance.policyrevision where scope_id=p_scope and kind='tax'
      order by policy_id,version desc
    ),candidate as(
      select policy_id,rule,effective_from,effective_to from latest
      where state in('draft','submitted') and desired_state='active'
      union all
      select policy.id,policy.rule,revision.effective_from,revision.effective_to
      from finance.policy policy join finance.policyrevision revision
        on revision.policy_id=policy.id and revision.scope_id=policy.scope_id and revision.version=policy.version
      where policy.scope_id=p_scope and policy.kind='tax' and policy.state='active'
    ) select 1 from candidate where policy_id<>p_policy
      and rule->>'countryCode'=p_rule->>'countryCode'
      and coalesce(rule->>'regionCode','')=coalesce(p_rule->>'regionCode','')
      and rule->>'taxType'=p_rule->>'taxType'
      and rule->>'productTaxCategory'=p_rule->>'productTaxCategory'
      and coalesce(rule->>'hsCode','')=coalesce(p_rule->>'hsCode','')
      and daterange(effective_from,effective_to,'[]') && daterange(p_effective_from,p_effective_to,'[]')
  ) then raise exception 'FINANCE_TAX_RULE_OVERLAP'; end if;
  return true;
end $function$;

create or replace function finance.configurable_policy_receipt(
  p_policy text,p_scope text,p_version bigint default null
) returns jsonb language sql stable security definer
set search_path=finance,pg_temp as $function$
  select jsonb_build_object('policy',jsonb_build_object(
    'id',revision.policy_id,'scopeId',revision.scope_id,'kind',revision.kind,'rule',revision.rule,
    'state',revision.state,'desiredState',revision.desired_state,'version',revision.version,
    'effectiveFrom',revision.effective_from,'effectiveTo',revision.effective_to,
    'sourceHash',revision.source_hash,'revisionHash',revision.revision_hash,
    'previewHash',revision.preview_hash,'proposedBy',revision.proposed_by,
    'submittedBy',revision.submitted_by,'approvedBy',revision.approved_by,
    'rejectedBy',revision.rejected_by,'actedBy',revision.acted_by,
    'reason',revision.reason,'evidence',revision.evidence,'createdAt',revision.created_at,
    'submittedAt',revision.submitted_at,'decidedAt',revision.decided_at
  )) from finance.policyrevision revision
  where revision.policy_id=p_policy and revision.scope_id=p_scope
    and (p_version is null or revision.version=p_version)
  order by revision.version desc limit 1
$function$;

create or replace function finance.policy_preview_receipt(p_preview text,p_scope text)
returns jsonb language sql stable security definer
set search_path=finance,pg_temp as $function$
  select jsonb_build_object('preview',jsonb_build_object(
    'id',preview.id,'policyId',preview.policy_id,'scopeId',preview.scope_id,
    'action',preview.action,'kind',preview.kind,'rule',preview.rule,
    'desiredState',preview.desired_state,'effectiveFrom',preview.effective_from,
    'effectiveTo',preview.effective_to,'sourceVersion',preview.source_version,
    'sourceHash',preview.source_hash,'previewHash',preview.preview_hash,
    'expiresAt',preview.expires_at,'proposedBy',preview.proposed_by
  )) from finance.policypreview preview
  where preview.id=p_preview and preview.scope_id=p_scope
$function$;

create or replace function finance.preview_configurable_policy(
  p_policy text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,
  p_action text,p_kind text,p_rule jsonb,p_desired_state text,
  p_effective_from date,p_effective_to date
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,pg_temp as $function$
declare
  currentrevision finance.policyrevision%rowtype;
  replay finance.policypreview%rowtype;
  currenthash char(64);
  previewid text;
  previewhash char(64);
  createdat timestamptz:=clock_timestamp();
begin
  if p_policy is null or p_policy='' or length(p_policy)>255 or p_scope is null or p_scope=''
    or p_actor is null or p_actor='' or p_idempotency is null or p_idempotency=''
    or length(p_idempotency)>255 or p_expected_version is null or p_expected_version<0
    or p_action not in('saveDraft','submit','approve','reject')
    or p_desired_state not in('active','retired')
  then raise exception 'FINANCE_POLICY_PREVIEW_INVALID'; end if;
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_POLICY_CONTEXT_INVALID'; end if;
  perform finance.assert_configurable_policy(p_kind,p_rule,p_effective_from,p_effective_to);

  select * into replay from finance.policypreview
  where scope_id=p_scope and idempotency_key=p_idempotency;
  if replay.id is not null then
    if replay.policy_id<>p_policy or replay.proposed_by<>p_actor or replay.source_version<>p_expected_version
      or replay.action<>p_action or replay.kind<>p_kind or replay.rule<>p_rule
      or replay.desired_state<>p_desired_state or replay.effective_from<>p_effective_from
      or replay.effective_to is distinct from p_effective_to
    then raise exception 'FINANCE_POLICY_IDEMPOTENCY_MISMATCH'; end if;
    return finance.policy_preview_receipt(replay.id,p_scope);
  end if;

  select * into currentrevision from finance.policyrevision
  where policy_id=p_policy and scope_id=p_scope order by version desc limit 1 for update;
  if currentrevision.policy_id is null then
    if exists(select 1 from finance.policy where id=p_policy)
      or exists(select 1 from finance.policyrevision where policy_id=p_policy)
      then raise exception 'FINANCE_POLICY_SCOPE_MISMATCH'; end if;
    if p_expected_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
    currenthash:=encode(public.digest('absent:'||p_scope||':'||p_policy,'sha256'),'hex');
  else
    if currentrevision.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
    if currentrevision.kind<>p_kind then raise exception 'FINANCE_POLICY_KIND_IMMUTABLE'; end if;
    currenthash:=currentrevision.revision_hash;
  end if;
  if p_kind not in('tax','field-definition') and(
      exists(select 1 from finance.policyrevision where scope_id=p_scope and kind=p_kind and policy_id<>p_policy)
      or exists(select 1 from finance.policy where scope_id=p_scope and kind=p_kind and id<>p_policy))
  then raise exception 'FINANCE_POLICY_KIND_CONFLICT'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope||':'||p_kind,0));
  if p_action<>'reject' and p_desired_state='active' then
    perform finance.assert_configurable_policy_conflict(
      p_policy,p_scope,p_kind,p_rule,p_effective_from,p_effective_to);
  end if;

  if p_action='saveDraft' then
    if currentrevision.state='submitted'
      or currentrevision.state='draft' and currentrevision.proposed_by<>p_actor
      or p_desired_state='retired' and currentrevision.policy_id is null
    then raise exception 'FINANCE_POLICY_STATE_INVALID'; end if;
  elsif p_action='submit' then
    if currentrevision.state<>'draft' or currentrevision.proposed_by<>p_actor
      or currentrevision.kind<>p_kind or currentrevision.rule<>p_rule
      or currentrevision.desired_state<>p_desired_state
      or currentrevision.effective_from<>p_effective_from
      or currentrevision.effective_to is distinct from p_effective_to
    then raise exception 'FINANCE_POLICY_STATE_INVALID'; end if;
  else
    if currentrevision.state<>'submitted' or currentrevision.proposed_by=p_actor
      or currentrevision.kind<>p_kind or currentrevision.rule<>p_rule
      or currentrevision.desired_state<>p_desired_state
      or currentrevision.effective_from<>p_effective_from
      or currentrevision.effective_to is distinct from p_effective_to
    then raise exception 'FINANCE_POLICY_SEPARATION_REQUIRED'; end if;
  end if;

  previewid:='policypreview:'||substr(encode(public.digest(p_scope||':'||p_idempotency,'sha256'),'hex'),1,40);
  previewhash:=encode(public.digest(jsonb_build_object(
    'policyId',p_policy,'scopeId',p_scope,'actorId',p_actor,'idempotencyKey',p_idempotency,
    'sourceVersion',p_expected_version,'action',p_action,'kind',p_kind,'rule',p_rule,
    'desiredState',p_desired_state,'effectiveFrom',p_effective_from,'effectiveTo',p_effective_to,
    'sourceHash',currenthash
  )::text,'sha256'),'hex');
  insert into finance.policypreview(
    id,policy_id,scope_id,action,kind,rule,desired_state,effective_from,effective_to,
    source_version,source_hash,preview_hash,proposed_by,idempotency_key,created_at,expires_at
  ) values(
    previewid,p_policy,p_scope,p_action,p_kind,p_rule,p_desired_state,p_effective_from,p_effective_to,
    p_expected_version,currenthash,previewhash,p_actor,p_idempotency,createdat,createdat+interval '5 minutes'
  );
  return finance.policy_preview_receipt(previewid,p_scope);
end $function$;

create or replace function finance.require_policy_action_proof(
  p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,p_request_hash text
) returns boolean language plpgsql volatile security definer
set search_path=access,finance,pg_temp as $function$
declare accepted boolean:=false;
begin
  delete from access.policyactionauthorization marker
  where marker.transaction_id=txid_current() and marker.actor_id=p_actor
    and marker.scope_id=p_scope and marker.operation='finance.policies.manage'
    and marker.resource_id=p_scope and marker.idempotency_key=p_idempotency
    and marker.expected_version=p_expected_version and marker.request_hash=p_request_hash
  returning true into accepted;
  if accepted is not true then raise exception 'ACTION_PROOF_REQUIRED'; end if;
  return true;
end $function$;

create or replace function finance.manage_configurable_policy(
  p_policy text,p_scope text,p_actor text,p_idempotency text,p_expected_version bigint,
  p_action text,p_preview_hash text,p_reason text,p_evidence jsonb,p_request_hash text
) returns jsonb language plpgsql volatile security definer
set search_path=finance,access,pg_temp as $function$
declare
  preview finance.policypreview%rowtype;
  currentrevision finance.policyrevision%rowtype;
  replay finance.policyrevision%rowtype;
  newversion bigint;
  newstate text;
  proposer text;
  submitter text;
  pointerversion bigint;
  authoritativeversion bigint;
  revisionhash char(64);
  changed bigint;
  actedat timestamptz:=clock_timestamp();
begin
  if p_policy is null or p_policy='' or p_scope is null or p_scope='' or p_actor is null or p_actor=''
    or p_idempotency is null or p_idempotency='' or length(p_idempotency)>255
    or p_expected_version is null or p_expected_version<0
    or p_action not in('saveDraft','submit','approve','reject')
    or p_preview_hash is null or p_preview_hash!~'^[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash!~'^[0-9a-f]{64}$'
    or p_reason is null or p_reason='' or length(p_reason)>1000
    or p_evidence is null or jsonb_typeof(p_evidence)<>'object'
  then raise exception 'FINANCE_POLICY_MANAGE_INVALID'; end if;
  if current_setting('app.workload',true)<>'api'
    or current_setting('app.scope_id',true) is distinct from p_scope
    or current_setting('app.actor_id',true) is distinct from p_actor
    or not access.scope_allowed(p_scope)
  then raise exception 'FINANCE_POLICY_CONTEXT_INVALID'; end if;

  select * into replay from finance.policyrevision
  where scope_id=p_scope and idempotency_key=p_idempotency;
  if replay.policy_id is not null then
    if replay.policy_id<>p_policy or replay.acted_by<>p_actor or replay.source_version<>p_expected_version
      or replay.action<>p_action or replay.preview_hash<>p_preview_hash
      or replay.reason<>p_reason or replay.evidence<>p_evidence or replay.request_hash<>p_request_hash
    then raise exception 'FINANCE_POLICY_IDEMPOTENCY_MISMATCH'; end if;
    return finance.configurable_policy_receipt(p_policy,p_scope,replay.version);
  end if;

  select * into preview from finance.policypreview
  where policy_id=p_policy and scope_id=p_scope and preview_hash=p_preview_hash for update;
  if preview.id is null or preview.action<>p_action or preview.proposed_by<>p_actor
    or preview.source_version<>p_expected_version or preview.consumed_at is not null
  then raise exception 'FINANCE_POLICY_PREVIEW_MISMATCH'; end if;
  if preview.expires_at<=actedat then raise exception 'FINANCE_POLICY_PREVIEW_EXPIRED'; end if;

  select * into currentrevision from finance.policyrevision
  where policy_id=p_policy and scope_id=p_scope order by version desc limit 1 for update;
  if currentrevision.policy_id is null then
    if p_expected_version<>0 or preview.source_hash<>
      encode(public.digest('absent:'||p_scope||':'||p_policy,'sha256'),'hex')
    then raise exception 'VERSION_CONFLICT'; end if;
  elsif currentrevision.version<>p_expected_version or currentrevision.revision_hash<>preview.source_hash then
    raise exception 'VERSION_CONFLICT';
  elsif currentrevision.kind<>preview.kind then
    raise exception 'FINANCE_POLICY_KIND_IMMUTABLE';
  end if;
  perform finance.assert_configurable_policy(preview.kind,preview.rule,preview.effective_from,preview.effective_to);
  perform pg_advisory_xact_lock(hashtextextended(p_scope||':'||preview.kind,0));
  if p_action<>'reject' and preview.desired_state='active' then
    perform finance.assert_configurable_policy_conflict(
      p_policy,p_scope,preview.kind,preview.rule,preview.effective_from,preview.effective_to);
  end if;
  perform finance.require_policy_action_proof(
    p_scope,p_actor,p_idempotency,p_expected_version,p_request_hash);

  if p_action='saveDraft' then
    if currentrevision.state='submitted' or currentrevision.state='draft' and currentrevision.proposed_by<>p_actor
    then raise exception 'FINANCE_POLICY_STATE_INVALID'; end if;
    newstate:='draft'; proposer:=p_actor; submitter:=null;
  elsif p_action='submit' then
    if currentrevision.state<>'draft' or currentrevision.proposed_by<>p_actor
    then raise exception 'FINANCE_POLICY_STATE_INVALID'; end if;
    newstate:='submitted'; proposer:=currentrevision.proposed_by; submitter:=p_actor;
  elsif p_action='approve' then
    if currentrevision.state<>'submitted' or currentrevision.proposed_by=p_actor
    then raise exception 'FINANCE_POLICY_SEPARATION_REQUIRED'; end if;
    newstate:=preview.desired_state; proposer:=currentrevision.proposed_by; submitter:=currentrevision.submitted_by;
  else
    if currentrevision.state<>'submitted' or currentrevision.proposed_by=p_actor
    then raise exception 'FINANCE_POLICY_SEPARATION_REQUIRED'; end if;
    newstate:='rejected'; proposer:=currentrevision.proposed_by; submitter:=currentrevision.submitted_by;
  end if;

  if p_action='approve' then
    select policy.version into pointerversion from finance.policy policy
    where policy.id=p_policy and policy.scope_id=p_scope for update;
    select revision.version into authoritativeversion
    from finance.policy policy join finance.policyrevision revision
      on revision.policy_id=policy.id and revision.scope_id=policy.scope_id and revision.version=policy.version
    where policy.id=p_policy and policy.scope_id=p_scope and revision.kind=policy.kind
      and revision.rule=policy.rule and revision.state=policy.state;
    if pointerversion is distinct from authoritativeversion
    then raise exception 'FINANCE_POLICY_ACTIVE_POINTER_STALE'; end if;
  end if;

  newversion:=p_expected_version+1;
  -- Timestamps are deliberately excluded so an identical authoritative action
  -- has a deterministic content hash; every state, actor and audit input is bound.
  revisionhash:=encode(public.digest(jsonb_build_object(
    'policyId',p_policy,'scopeId',p_scope,'version',newversion,'state',newstate,
    'desiredState',preview.desired_state,'kind',preview.kind,'rule',preview.rule,
    'effectiveFrom',preview.effective_from,'effectiveTo',preview.effective_to,
    'sourceVersion',p_expected_version,'sourceHash',preview.source_hash,
    'previewHash',preview.preview_hash,'action',p_action,'proposedBy',proposer,
    'submittedBy',submitter,'approvedBy',case when p_action='approve' then p_actor else null end,
    'rejectedBy',case when p_action='reject' then p_actor else null end,'actedBy',p_actor,
    'reason',p_reason,'evidence',p_evidence,'idempotencyKey',p_idempotency,'requestHash',p_request_hash
  )::text,'sha256'),'hex');
  insert into finance.policyrevision(
    policy_id,version,scope_id,kind,rule,state,desired_state,effective_from,effective_to,
    source_version,source_hash,revision_hash,preview_hash,action,proposed_by,submitted_by,
    approved_by,rejected_by,acted_by,reason,evidence,idempotency_key,request_hash,created_at,submitted_at,decided_at
  ) values(
    p_policy,newversion,p_scope,preview.kind,preview.rule,newstate,preview.desired_state,
    preview.effective_from,preview.effective_to,p_expected_version,preview.source_hash,revisionhash,
    preview.preview_hash,p_action,proposer,submitter,
    case when p_action='approve' then p_actor else null end,
    case when p_action='reject' then p_actor else null end,
    p_actor,p_reason,p_evidence,p_idempotency,p_request_hash,actedat,
    case when p_action in('submit','approve','reject') then coalesce(currentrevision.submitted_at,actedat) else null end,
    case when p_action in('approve','reject') then actedat else null end
  );

  if p_action='approve' then
    if pointerversion is null then
      insert into finance.policy(id,scope_id,kind,rule,state,version)
      values(p_policy,p_scope,preview.kind,preview.rule,preview.desired_state,newversion);
    else
      update finance.policy set rule=preview.rule,state=preview.desired_state,version=newversion
      where id=p_policy and scope_id=p_scope and version=pointerversion and kind=preview.kind;
    end if;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'VERSION_CONFLICT'; end if;
  end if;
  update finance.policypreview set consumed_at=actedat,consumed_revision_version=newversion
  where id=preview.id and consumed_at is null;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FINANCE_POLICY_PREVIEW_MISMATCH'; end if;
  return finance.configurable_policy_receipt(p_policy,p_scope,newversion);
end $function$;

-- Preserve the repair proof marker while adding a transaction-bound marker for
-- policy management.  A direct SECURITY DEFINER call cannot bypass Level 3.
create or replace function access.consume_action_proof(
  p_token_hash text,p_actor text,p_session text,p_membership text,p_scope text,p_operation text,
  p_resource text,p_idempotency text,p_expected_version bigint,p_request_hash text
) returns boolean language plpgsql volatile security definer
set search_path=access,identity,capability,pg_temp as $function$
declare consumed boolean:=false;
begin
  update access.actionproof proof set consumed_at=clock_timestamp()
  where proof.token_hash=p_token_hash and proof.actor_id=p_actor and proof.session_id=p_session
    and proof.membership_id=p_membership and proof.scope_id=p_scope and proof.operation=p_operation
    and proof.resource_id=p_resource and proof.idempotency_key=p_idempotency
    and proof.expected_version is not distinct from p_expected_version
    and proof.request_hash=p_request_hash
    and proof.consumed_at is null and proof.expires_at>clock_timestamp()
    and exists(select 1 from identity.session session
      join identity.principal principal on principal.id=session.principal_id
      join access.membership membership on membership.id=session.membership_id
      where session.id=p_session and session.principal_id=p_actor and session.membership_id=p_membership
        and session.revoked_at is null and session.expires_at>clock_timestamp() and session.assurance_level>=3
        and principal.status='active' and session.credential_version=principal.credential_version
        and membership.status='active' and session.access_version=membership.access_version
        and exists(select 1 from capability.membership_operations(p_membership) granted
          join capability.operation operation on operation.operation_id=granted.operation_id
          join capability.capability capability on capability.id=operation.capability_id and capability.status='active'
          left join access.permission permission on permission.code=operation.permission_code
          where granted.operation_id=p_operation
            and (operation.permission_code is null or permission.status='active')))
    and exists(select 1 from identity.assurance assurance where assurance.id=proof.assurance_id
      and assurance.principal_id=p_actor and assurance.session_id=p_session and assurance.level=3
      and (assurance.expires_at is null or assurance.expires_at>clock_timestamp()));
  consumed:=found;
  if consumed and p_operation in('finance.reconciliationrepairs.submit',
      'finance.reconciliationrepairs.decide','finance.reconciliationrepairs.reverse')
  then
    insert into access.repairactionauthorization(transaction_id,actor_id,scope_id,operation,
      resource_id,idempotency_key,expected_version,request_hash)
    values(txid_current(),p_actor,p_scope,p_operation,p_resource,p_idempotency,p_expected_version,p_request_hash);
  elsif consumed and p_operation='finance.policies.manage' then
    insert into access.policyactionauthorization(transaction_id,actor_id,scope_id,operation,
      resource_id,idempotency_key,expected_version,request_hash)
    values(txid_current(),p_actor,p_scope,p_operation,p_resource,p_idempotency,p_expected_version,p_request_hash);
  end if;
  return consumed;
end $function$;

create or replace function finance.assert_expected_version(
  p_operation text,p_resource text,p_scope text,p_expected_version bigint
) returns boolean language plpgsql volatile security definer
set search_path=finance,invoice,pg_temp as $function$
declare valid boolean:=false; currentversion bigint;
begin
  if p_expected_version is null then raise exception 'EXPECTED_VERSION_REQUIRED'; end if;
  if p_expected_version<0 then raise exception 'EXPECTED_VERSION_INVALID'; end if;
  if p_operation in('finance.reconciliations.manage','finance.reconciliationrepairs.preview') then
    select true into valid from finance.reconciliation where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.reconciliationrepairs.submit','finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.reverse') then
    select true into valid from finance.reconciliationrepair where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.settlements.decide','finance.settlements.adjust',
      'finance.withdrawals.create','invoice.requests.create') then
    select true into valid from finance.settlement where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.withdrawals.decide','finance.withdrawals.recover') then
    select true into valid from finance.withdrawal where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation='finance.periods.manage' then
    select true into valid from finance.periodclose where scope_id=p_scope and period=p_resource
      and version=p_expected_version for update;
    if valid is not true and p_expected_version=0 and exists(select 1 from finance.period where scope_id=p_scope and period=p_resource)
      and not exists(select 1 from finance.periodclose where scope_id=p_scope and period=p_resource)
    then valid:=true; end if;
  elsif p_operation='finance.backfills.decide' then
    select true into valid from finance.backfill where id=p_resource and scope_id=p_scope
      and version=p_expected_version for update;
  elsif p_operation in('finance.policies.preview','finance.policies.manage') then
    select version into currentversion from finance.policyrevision
    where policy_id=p_resource and scope_id=p_scope order by version desc limit 1 for update;
    if currentversion is null then
      if exists(select 1 from finance.policy where id=p_resource) then valid:=false;
      else valid:=p_expected_version=0; end if;
    else valid:=currentversion=p_expected_version; end if;
  elsif p_operation='invoice.profiles.manage' then
    select true into valid from invoice.profile where id=p_resource and owner_id=p_scope
      and version=p_expected_version for update;
    if valid is not true and p_expected_version=0 and not exists(select 1 from invoice.profile where id=p_resource)
    then valid:=true; end if;
  elsif p_operation in('invoice.requests.cancel','invoice.requests.decide','invoice.requests.red') then
    select true into valid from invoice.request request join invoice.requestprofile profile on profile.request_id=request.id
      where request.id=p_resource and profile.owner_id=p_scope and request.version=p_expected_version for update of request;
  else raise exception 'EXPECTED_VERSION_INVALID'; end if;
  if valid is not true then raise exception 'VERSION_CONFLICT'; end if;
  return true;
end $function$;

alter table finance.policypreview enable row level security;
alter table finance.policyrevision enable row level security;
alter table access.policyactionauthorization enable row level security;
create policy appscope on finance.policyrevision for select to shopapp using(access.scope_allowed(scope_id));

revoke all on table finance.policypreview,finance.policyrevision,access.policyactionauthorization
from public,anon,authenticated,service_role,shopapp,shopjob;
grant select on table finance.policyrevision to shopapp;
revoke insert,update,delete on table finance.policy from shopapp,shopjob;

revoke all on function
  finance.assert_configurable_policy(text,jsonb,date,date),
  finance.assert_configurable_policy_conflict(text,text,text,jsonb,date,date),
  finance.configurable_policy_receipt(text,text,bigint),
  finance.policy_preview_receipt(text,text),
  finance.preview_configurable_policy(text,text,text,text,bigint,text,text,jsonb,text,date,date),
  finance.require_policy_action_proof(text,text,text,bigint,text),
  finance.manage_configurable_policy(text,text,text,text,bigint,text,text,text,jsonb,text),
  finance.reject_policy_revision_mutation(),finance.guard_policy_preview_consumption()
from public,anon,authenticated,service_role,shopapp,shopjob;
grant execute on function
  finance.preview_configurable_policy(text,text,text,text,bigint,text,text,jsonb,text,date,date),
  finance.manage_configurable_policy(text,text,text,text,bigint,text,text,text,jsonb,text)
to shopapp;

revoke all on function finance.assert_expected_version(text,text,text,bigint),
  access.consume_action_proof(text,text,text,text,text,text,text,text,bigint,text)
from public,anon,authenticated,service_role,shopapp,shopjob;
grant execute on function finance.assert_expected_version(text,text,text,bigint),
  access.consume_action_proof(text,text,text,text,text,text,text,text,bigint,text)
to shopapp;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('finance.policies.preview','finance','POST','/api/v1/finance/policies/{policyid}/preview','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,
  contract_version=excluded.contract_version;
insert into capability.capability(id,kind,name,version,status) values
  ('finance.policies.preview','operation','finance.policies.preview',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('finance.policies.preview','finance.policies.preview','finance.policy.manage','operator')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'finance-policy-preview:'||encode(public.digest(source.scope_id,'sha256'),'hex'),source.scope_id,
  'finance.policies.preview',source.state,source.quota,source.effective_at,source.expires_at,source.version
from capability.entitlement source where source.capability_id='finance.policies.manage'
on conflict(scope_id,capability_id,effective_at) do nothing;
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:finance.policies.preview','organization-platform-root','finance.policies.preview','enabled',null,
    '1970-01-01T00:00:00Z',null,0)
on conflict(scope_id,capability_id,effective_at) do nothing;

-- Configurable policy writes remain critical (Level 3 + action-bound proof + four-eyes),
-- but the canonical platform owner must be able to propose and submit them.
insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.code='finance.policy.manage' and permission.status='active'
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260830100000','d8be5d3aec61c976e48f41bb2c7a52441bd0df2d487b951c544ce882ec57cb5f');

do $assert$
begin
  if not exists(select 1 from pg_class where oid='finance.policypreview'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='finance.policyrevision'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='access.policyactionauthorization'::regclass and relrowsecurity)
  then raise exception 'FINANCE_POLICY_WORKFLOW_RLS_MISSING'; end if;
  if to_regprocedure('finance.preview_configurable_policy(text,text,text,text,bigint,text,text,jsonb,text,date,date)') is null
    or to_regprocedure('finance.manage_configurable_policy(text,text,text,text,bigint,text,text,text,jsonb,text)') is null
    or to_regprocedure('finance.assert_configurable_policy(text,jsonb,date,date)') is null
  then raise exception 'FINANCE_POLICY_WORKFLOW_FUNCTION_MISSING'; end if;
  if has_table_privilege('shopapp','finance.policypreview','SELECT')
    or has_table_privilege('shopapp','finance.policyrevision','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopapp','access.policyactionauthorization','SELECT')
    or has_table_privilege('shopapp','finance.policy','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopjob','finance.policy','INSERT,UPDATE,DELETE')
  then raise exception 'FINANCE_POLICY_RAW_WRITE_BOUNDARY_OPEN'; end if;
  if not has_function_privilege('shopapp',
      'finance.preview_configurable_policy(text,text,text,text,bigint,text,text,jsonb,text,date,date)','EXECUTE')
    or not has_function_privilege('shopapp',
      'finance.manage_configurable_policy(text,text,text,text,bigint,text,text,text,jsonb,text)','EXECUTE')
    or has_function_privilege('shopapp','finance.assert_configurable_policy(text,jsonb,date,date)','EXECUTE')
    or has_function_privilege('shopapp','finance.require_policy_action_proof(text,text,text,bigint,text)','EXECUTE')
  then raise exception 'FINANCE_POLICY_FUNCTION_PRIVILEGE_INVALID'; end if;
  if not exists(select 1 from runtime.operation where id='finance.policies.preview'
      and method='POST' and path='/api/v1/finance/policies/{policyid}/preview')
    or not exists(select 1 from capability.operation where operation_id='finance.policies.preview'
      and permission_code='finance.policy.manage')
    or not exists(select 1 from capability.entitlement where scope_id='organization-platform-root'
      and capability_id='finance.policies.preview' and state='enabled')
  then raise exception 'FINANCE_POLICY_PREVIEW_CAPABILITY_INVALID'; end if;
  if not exists(
    select 1 from access.rolepermission mapping
    join access.permission permission on permission.id=mapping.permission_id
    where mapping.role_id='role-platform-owner-v2'
      and permission.code='finance.policy.manage'
      and permission.status='active'
      and mapping.effect='allow')
  then raise exception 'PLATFORM_OWNER_FINANCE_POLICY_MANAGE_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgname='finance_policyrevision_immutable' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgname='finance_policypreview_guard' and not tgisinternal)
    or not exists(select 1 from runtime.schemaversion where version='20260830100000')
  then raise exception 'FINANCE_POLICY_WORKFLOW_INCOMPLETE'; end if;
end $assert$;

commit;
