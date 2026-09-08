begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028100') then raise exception 'VOUCHER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028200') then raise exception 'VOUCHER_ALREADY_APPLIED'; end if;
  -- Legacy rows are retained under legacy-prefixed table names until the
  -- dedicated assert and retire stages have produced reconciliation evidence.
end $precondition$;

alter table voucher.program rename to legacyprogram;
alter table voucher.programversion rename to legacyprogramversion;
alter table voucher.cardpool rename to legacycardpool;
alter table voucher.card rename to legacycredential;
alter table voucher.allocation rename to legacyallocation;
alter table voucher.reserverequest rename to legacystockrequest;
alter table voucher.approval rename to legacyapproval;
alter table voucher.issuebatch rename to legacyissuebatch;
alter table voucher.voucher rename to legacyvoucher;
alter table voucher.statusevent rename to legacytimeline;
alter table voucher.reserve rename to legacyreserve;
alter table voucher.redemption rename to legacyredemption;
alter table voucher.reversal rename to legacyrefund;
alter table voucher.hold rename to legacyhold;
alter table voucher.statusbatch rename to legacyactionbatch;
alter table voucher.statusitem rename to legacyactionitem;
alter table voucher.importjob rename to legacyimportjob;
alter table voucher.importrow rename to legacyimportrow;
alter table voucher.importerror rename to legacyimporterror;

create table voucher.product(
  id text primary key,
  number text not null unique,
  scope_id text not null,
  customer_id text not null,
  name text not null check(length(name) between 1 and 255),
  face_minor bigint not null check(face_minor>0),
  currency char(3) not null check(currency='CNY'),
  qualification_id text not null,
  pool_id text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  activation text not null check(activation in('automatic','secret','numbersecret')),
  approval_required boolean not null,
  state text not null check(state in('draft','enabled','disabled','retired')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(expires_at>starts_at and updated_at>=created_at),
  unique(scope_id,customer_id,name)
);
create table voucher.productversion(
  product_id text not null references voucher.product(id) on delete cascade,
  scope_id text not null,
  version bigint not null check(version>0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  changed_by text not null,
  changed_at timestamptz not null,
  primary key(product_id,version)
);
create table voucher.credentialpool(
  id text primary key,
  number text not null unique,
  scope_id text not null,
  product_id text not null references voucher.product(id),
  name text not null check(length(name) between 1 and 255),
  mode text not null check(mode in('generated','imported')),
  prefix text not null check(prefix~'^[A-Z0-9]{2,12}$'),
  capacity bigint not null check(capacity>0),
  generated bigint not null check(generated between 0 and capacity),
  state text not null check(state in('open','closed')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,prefix)
);
alter table voucher.product add constraint voucher_product_pool foreign key(pool_id) references voucher.credentialpool(id);
create table voucher.stockrequest(
  id text primary key,
  number text not null unique,
  scope_id text not null,
  customer_id text not null,
  product_id text not null references voucher.product(id),
  pool_id text not null references voucher.credentialpool(id),
  quantity bigint not null check(quantity between 1 and 1000000),
  reason text not null check(length(reason) between 2 and 1000),
  state text not null check(state in('draft','submitted','approved','rejected','cancelled','fulfilled')),
  approval_instance_id text,
  requested_by text not null,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table voucher.issueorder(
  id text primary key,
  number text not null unique,
  scope_id text not null,
  customer_id text not null,
  product_id text not null references voucher.product(id),
  stock_request_id text not null references voucher.stockrequest(id),
  quantity bigint not null check(quantity between 1 and 1000000),
  purpose text not null check(purpose in('benefit','order','campaign','manual')),
  delivery text not null check(delivery in('account','claim')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  recipient_snapshot text not null,
  reason text not null check(length(reason) between 2 and 1000),
  state text not null check(state in('draft','submitted','approved','issuing','completed','failed','cancelled')),
  approval_instance_id text,
  requested_by text not null,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(expires_at>starts_at)
);
create table voucher.issuebatch(
  id text primary key,
  order_id text not null unique references voucher.issueorder(id),
  scope_id text not null,
  state text not null check(state in('queued','running','completed','failed','cancelled')),
  requested bigint not null check(requested>0),
  processed bigint not null check(processed>=0),
  succeeded bigint not null check(succeeded>=0),
  accounted bigint not null default 0 check(accounted between 0 and succeeded),
  failed bigint not null check(failed>=0),
  retryable bigint not null check(retryable between 0 and failed),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(processed=succeeded+failed and processed<=requested)
);
create table voucher.credential(
  id text primary key,
  scope_id text not null,
  pool_id text not null references voucher.credentialpool(id),
  product_id text not null references voucher.product(id),
  number_ciphertext text not null,
  secret_ciphertext text not null,
  number_fingerprint char(64) not null unique check(number_fingerprint~'^[0-9a-f]{64}$'),
  secret_fingerprint char(64) not null unique check(secret_fingerprint~'^[0-9a-f]{64}$'),
  number_masked text not null,
  key_version text not null,
  state text not null check(state in('generated','available','allocated','void')),
  issue_batch_id text references voucher.issuebatch(id),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check((state='allocated')=(issue_batch_id is not null))
);
create table voucher.issueitem(
  batch_id text not null references voucher.issuebatch(id) on delete cascade,
  scope_id text not null,
  ordinal bigint not null check(ordinal>0),
  credential_id text references voucher.credential(id),
  state text not null check(state in('queued','succeeded','failed')),
  error_code text,
  retryable boolean not null,
  idempotency_key text not null unique,
  updated_at timestamptz not null,
  primary key(batch_id,ordinal),
  unique(batch_id,credential_id),
  check((state='failed')=(error_code is not null))
);
create table voucher.voucher(
  id text primary key,
  scope_id text not null,
  product_id text not null references voucher.product(id),
  credential_id text not null unique references voucher.credential(id),
  holder_id text,
  number_fingerprint char(64) not null unique check(number_fingerprint~'^[0-9a-f]{64}$'),
  number_masked text not null,
  initial_minor bigint not null check(initial_minor>0),
  remaining_minor bigint not null check(remaining_minor between 0 and initial_minor),
  currency char(3) not null check(currency='CNY'),
  state text not null check(state in('generated','available','allocated','bound','active','held','redeemed','disabled','void','reversed','expired')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(expires_at>starts_at)
);
create table voucher.holder(
  id text primary key,
  scope_id text not null,
  voucher_id text not null references voucher.voucher(id),
  member_id text not null,
  state text not null check(state in('bound','released')),
  version bigint not null check(version>0),
  bound_at timestamptz not null,
  released_at timestamptz,
  check((state='released')=(released_at is not null))
);
alter table voucher.voucher add constraint voucher_holder_reference foreign key(holder_id) references voucher.holder(id);
create unique index voucher_holder_active on voucher.holder(voucher_id) where state='bound';
create table voucher.timeline(
  voucher_id text not null references voucher.voucher(id) on delete cascade,
  scope_id text not null,
  sequence bigint not null check(sequence>0),
  previous_state text,
  next_state text not null,
  reason text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  redemption_id text,
  primary key(voucher_id,sequence)
);
create table voucher.tenderhold(
  id text primary key,
  scope_id text not null,
  voucher_id text not null references voucher.voucher(id),
  owner_id text not null,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in('active','consumed','released','expired')),
  expires_at timestamptz not null,
  idempotency_key text not null,
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,idempotency_key)
);
create unique index voucher_tenderhold_active on voucher.tenderhold(voucher_id) where state='active';
create table voucher.redemption(
  id text primary key,
  scope_id text not null,
  voucher_id text not null references voucher.voucher(id),
  hold_id text unique references voucher.tenderhold(id),
  verification_id text not null unique,
  order_id text,
  amount_minor bigint not null check(amount_minor>0),
  refunded_minor bigint not null check(refunded_minor between 0 and amount_minor),
  currency char(3) not null check(currency='CNY'),
  state text not null check(state in('succeeded','partiallyrefunded','refunded')),
  idempotency_key text not null,
  version bigint not null check(version>0),
  redeemed_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,idempotency_key)
);
alter table voucher.timeline add constraint voucher_timeline_redemption foreign key(redemption_id) references voucher.redemption(id);
create unique index voucher_timeline_redemption on voucher.timeline(redemption_id) where redemption_id is not null;
create table voucher.refund(
  id text primary key,
  scope_id text not null,
  redemption_id text not null references voucher.redemption(id),
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null check(currency='CNY'),
  reason text not null check(length(reason) between 2 and 1000),
  state text not null check(state='succeeded'),
  rule_version bigint not null check(rule_version>0),
  idempotency_key text not null,
  created_at timestamptz not null,
  unique(scope_id,idempotency_key)
);
create table voucher.actionbatch(
  id text primary key,
  scope_id text not null,
  snapshot_id text not null,
  action text not null check(action in('activate','disable','enable','void','extend')),
  reason text not null check(length(reason) between 2 and 1000),
  expires_at timestamptz,
  state text not null check(state in('queued','running','completed','failed')),
  requested bigint not null check(requested>0),
  processed bigint not null check(processed>=0),
  succeeded bigint not null check(succeeded>=0),
  failed bigint not null check(failed>=0),
  retryable bigint not null check(retryable between 0 and failed),
  version bigint not null check(version>0),
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(processed=succeeded+failed and processed<=requested and (action='extend')=(expires_at is not null))
);
create table voucher.actionitem(
  batch_id text not null references voucher.actionbatch(id) on delete cascade,
  scope_id text not null,
  voucher_id text not null references voucher.voucher(id),
  state text not null check(state in('queued','succeeded','failed')),
  previous_state text,
  next_state text,
  error_code text,
  retryable boolean not null,
  idempotency_key text not null unique,
  updated_at timestamptz not null,
  primary key(batch_id,voucher_id),
  check((state='failed')=(error_code is not null))
);
create table voucher.searchsnapshot(
  id text primary key,
  scope_id text not null,
  filter jsonb not null check(jsonb_typeof(filter)='object'),
  filter_hash char(64) not null check(filter_hash~'^[0-9a-f]{64}$'),
  watermark timestamptz not null,
  result_count bigint not null check(result_count>=0),
  expires_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null,
  unique(scope_id,filter_hash,watermark),
  unique(id,scope_id),
  check(expires_at>created_at)
);
create table voucher.searchsnapshotitem(
  snapshot_id text not null,
  scope_id text not null,
  voucher_id text not null references voucher.voucher(id),
  ordinal bigint not null check(ordinal>0),
  number_masked text not null,
  product_id text not null,
  member_id text,
  remaining_minor bigint not null check(remaining_minor>=0),
  currency char(3) not null,
  state text not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  voucher_version bigint not null check(voucher_version>0),
  primary key(snapshot_id,voucher_id),
  unique(snapshot_id,ordinal),
  foreign key(snapshot_id,scope_id) references voucher.searchsnapshot(id,scope_id) on delete cascade
);
create function voucher.guard_snapshot_item() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  raise exception 'VOUCHER_SNAPSHOT_IMMUTABLE';
end
$function$;
create trigger vouchersnapshotimmutable before update on voucher.searchsnapshotitem for each row execute function voucher.guard_snapshot_item();
alter table voucher.actionbatch add constraint voucher_actionbatch_snapshot foreign key(snapshot_id) references voucher.searchsnapshot(id);
create table voucher.activationattempt(
  id text primary key,
  scope_id text not null,
  actor_id text not null,
  fingerprint char(64) not null check(fingerprint~'^[0-9a-f]{64}$'),
  accepted boolean not null,
  attempted_at timestamptz not null
);

create index voucher_product_scope on voucher.product(scope_id,state,updated_at desc,id) include(customer_id,name,face_minor,currency,version);
create index voucher_pool_scope on voucher.credentialpool(scope_id,state,updated_at desc,id) include(product_id,capacity,generated,version);
create index voucher_credential_pool on voucher.credential(pool_id,state,id) include(product_id,number_masked,version);
create index voucher_stock_scope on voucher.stockrequest(scope_id,state,updated_at desc,id) include(customer_id,product_id,pool_id,quantity,version);
create index voucher_issueorder_scope on voucher.issueorder(scope_id,state,updated_at desc,id) include(customer_id,product_id,quantity,version);
create index voucher_voucher_search on voucher.voucher(scope_id,state,updated_at desc,id) include(product_id,holder_id,number_masked,remaining_minor,expires_at,version);
create index voucher_holder_member on voucher.holder(member_id,state,voucher_id) include(scope_id);
create index voucher_redemption_voucher on voucher.redemption(voucher_id,redeemed_at desc,id) include(amount_minor,refunded_minor,state,version);
create index voucher_activation_limit on voucher.activationattempt(actor_id,attempted_at desc) include(accepted,fingerprint);

insert into voucher.product(id,number,scope_id,customer_id,name,face_minor,currency,qualification_id,pool_id,starts_at,expires_at,activation,approval_required,state,version,created_at,updated_at)
select source.id,'VP'||upper(substr(encode(public.digest(source.id,'sha256'),'hex'),1,16)),source.scope_id,'customer:migrated:'||source.scope_id,source.name,
  greatest(source.value_minor,1),source.currency,'qualification:migrated:'||source.id,null,clock_timestamp()-interval '1 day',
  clock_timestamp()+make_interval(days=>source.default_valid_days),'automatic',source.approval_required,
  case source.status when 'active' then 'disabled' when 'paused' then 'disabled' when 'retired' then 'retired' else 'draft' end,greatest(source.version,1),clock_timestamp(),clock_timestamp()
from voucher.legacyprogram source;
insert into voucher.product(id,number,scope_id,customer_id,name,face_minor,currency,qualification_id,pool_id,starts_at,expires_at,activation,approval_required,state,version,created_at,updated_at)
select 'product:migrated:'||substr(encode(public.digest(pool.id,'sha256'),'hex'),1,24),'VP'||upper(substr(encode(public.digest(pool.id,'sha256'),'hex'),1,16)),pool.scope_id,
  'customer:migrated:'||pool.scope_id,'迁移卡号库产品',1,'CNY','qualification:migrated:'||pool.id,null,clock_timestamp()-interval '1 day',
  clock_timestamp()+interval '10 years','automatic',true,'disabled',1,clock_timestamp(),clock_timestamp()
from voucher.legacycardpool pool where not exists(select 1 from voucher.product product where product.scope_id=pool.scope_id);

insert into voucher.credentialpool(id,number,scope_id,product_id,name,mode,prefix,capacity,generated,state,version,created_at,updated_at)
select pool.id,'CP'||upper(substr(encode(public.digest(pool.id,'sha256'),'hex'),1,16)),pool.scope_id,
  (select product.id from voucher.product product where product.scope_id=pool.scope_id order by product.id limit 1),
  '卡号库 '||pool.code_prefix,pool.mode,rpad(coalesce(nullif(substr(upper(regexp_replace(pool.code_prefix,'[^A-Za-z0-9]','','g')),1,12),''),'VC'),2,'X'),
  greatest(pool.next_sequence-1,(select count(*) from voucher.legacycredential credential where credential.cardpool_id=pool.id),1),
  least(greatest(pool.next_sequence-1,0),greatest(pool.next_sequence-1,(select count(*) from voucher.legacycredential credential where credential.cardpool_id=pool.id),1)),
  case pool.status when 'disabled' then 'closed' else 'open' end,greatest(pool.version,1),clock_timestamp(),clock_timestamp()
from voucher.legacycardpool pool;
update voucher.product product set pool_id=(select pool.id from voucher.credentialpool pool where pool.product_id=product.id order by pool.id limit 1)
where exists(select 1 from voucher.credentialpool pool where pool.product_id=product.id);
insert into voucher.productversion(product_id,scope_id,version,snapshot,changed_by,changed_at)
select product.id,product.scope_id,product.version,jsonb_build_object('customer',product.customer_id,'name',product.name,'faceMinor',product.face_minor,'currency',product.currency,
  'qualification',product.qualification_id,'pool',product.pool_id,'validity',jsonb_build_object('startsAt',product.starts_at,'expiresAt',product.expires_at),
  'activation',product.activation,'approvalRequired',product.approval_required),'migration',product.updated_at from voucher.product product;

insert into voucher.stockrequest(id,number,scope_id,customer_id,product_id,pool_id,quantity,reason,state,approval_instance_id,requested_by,version,created_at,updated_at)
select request.id,request.request_number,request.scope_id,product.customer_id,request.program_id,product.pool_id,request.requested_count,
  case when length(trim(request.reason))<2 then '历史库存申请迁移' else request.reason end,request.state,
  (select approval.id from voucher.legacyapproval approval where approval.request_id=request.id order by approval.sequence desc limit 1),request.requested_by,
  greatest(coalesce(request.program_version,0),1),request.created_at,request.updated_at
from voucher.legacystockrequest request join voucher.product product on product.id=request.program_id where product.pool_id is not null;
insert into voucher.stockrequest(id,number,scope_id,customer_id,product_id,pool_id,quantity,reason,state,approval_instance_id,requested_by,version,created_at,updated_at)
select 'stockrequest:migrated:'||substr(encode(public.digest(batch.id,'sha256'),'hex'),1,24),'SR'||upper(substr(encode(public.digest(batch.id,'sha256'),'hex'),1,16)),product.scope_id,
  product.customer_id,batch.program_id,batch.cardpool_id,batch.requested_count,'历史发行批次迁移','fulfilled',null,'migration',1,batch.created_at,batch.created_at
from voucher.legacyissuebatch batch join voucher.product product on product.id=batch.program_id
where batch.reserve_request_id is null;

insert into voucher.issueorder(id,number,scope_id,customer_id,product_id,stock_request_id,quantity,purpose,delivery,starts_at,expires_at,recipient_snapshot,reason,state,
  approval_instance_id,requested_by,version,created_at,updated_at)
select 'issueorder:'||substr(encode(public.digest(batch.id,'sha256'),'hex'),1,24),'IO'||upper(substr(encode(public.digest(batch.id,'sha256'),'hex'),1,16)),product.scope_id,product.customer_id,
  batch.program_id,coalesce(batch.reserve_request_id,'stockrequest:migrated:'||substr(encode(public.digest(batch.id,'sha256'),'hex'),1,24)),batch.requested_count,'manual','claim',batch.created_at,
  batch.created_at+make_interval(days=>greatest(program.default_valid_days,1)),'migration:'||batch.id,'历史发行批次迁移',
  case batch.state when 'completed' then 'completed' when 'failed' then 'failed' when 'cancelled' then 'cancelled' when 'issuing' then 'issuing' when 'approved' then 'approved' else 'submitted' end,
  null,'migration',greatest(batch.program_version,1),batch.created_at,batch.created_at
from voucher.legacyissuebatch batch join voucher.product product on product.id=batch.program_id join voucher.legacyprogram program on program.id=batch.program_id;
insert into voucher.issuebatch(id,order_id,scope_id,state,requested,processed,succeeded,failed,retryable,version,created_at,updated_at)
select batch.id,'issueorder:'||substr(encode(public.digest(batch.id,'sha256'),'hex'),1,24),product.scope_id,
  case batch.state when 'completed' then 'completed' when 'failed' then 'failed' when 'cancelled' then 'cancelled' when 'issuing' then 'running' else 'queued' end,
  batch.requested_count,batch.issued_count,batch.issued_count,0,0,greatest(batch.program_version,1),batch.created_at,batch.created_at
from voucher.legacyissuebatch batch join voucher.product product on product.id=batch.program_id;

insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,secret_fingerprint,number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
select credential.id,pool.scope_id,credential.cardpool_id,coalesce((select batch.program_id from voucher.legacyissuebatch batch where batch.id=credential.allocated_batch_id),pool.product_id),
  credential.code_ciphertext,credential.code_ciphertext,credential.code_fingerprint,
  encode(public.digest(credential.code_fingerprint||':secret','sha256'),'hex'),'****'||right(credential.code_fingerprint,4),credential.code_key_version,
  case credential.state when 'allocated' then 'allocated' when 'void' then 'void' else 'available' end,credential.allocated_batch_id,greatest(credential.version,1),clock_timestamp(),clock_timestamp()
from voucher.legacycredential credential join voucher.credentialpool pool on pool.id=credential.cardpool_id;
insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,secret_fingerprint,number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
select 'credential:migrated:'||substr(encode(public.digest(source.id,'sha256'),'hex'),1,24),product.scope_id,batch.cardpool_id,source.program_id,
  source.code_ciphertext,source.code_ciphertext,source.code_fingerprint,encode(public.digest(source.code_fingerprint||':secret','sha256'),'hex'),
  '****'||right(source.code_fingerprint,4),source.code_key_version,'allocated',source.batch_id,greatest(source.version,1),batch.created_at,batch.created_at
from voucher.legacyvoucher source join voucher.legacyissuebatch batch on batch.id=source.batch_id join voucher.product product on product.id=source.program_id
where source.card_id is null;

insert into voucher.voucher(id,scope_id,product_id,credential_id,holder_id,number_fingerprint,number_masked,initial_minor,remaining_minor,currency,state,starts_at,expires_at,version,created_at,updated_at)
select source.id,product.scope_id,source.program_id,coalesce(source.card_id,'credential:migrated:'||substr(encode(public.digest(source.id,'sha256'),'hex'),1,24)),null,
  source.code_fingerprint,'****'||right(source.code_fingerprint,4),source.initial_minor,source.remaining_minor,product.currency,
  case source.state when 'inactive' then 'available' when 'active' then case when source.member_id is null then 'available' else 'active' end when 'held' then 'held'
    when 'redeemed' then 'redeemed' when 'reversed' then 'reversed' when 'disabled' then 'disabled' when 'expired' then 'expired' else 'void' end,
  least(batch.created_at,source.expires_at-interval '1 second'),source.expires_at,greatest(source.version,1),batch.created_at,clock_timestamp()
from voucher.legacyvoucher source join voucher.product product on product.id=source.program_id join voucher.legacyissuebatch batch on batch.id=source.batch_id;
insert into voucher.holder(id,scope_id,voucher_id,member_id,state,version,bound_at,released_at)
select 'holder:'||substr(encode(public.digest(voucher.id,'sha256'),'hex'),1,24),voucher.scope_id,voucher.id,source.member_id,'bound',1,voucher.created_at,null
from voucher.legacyvoucher source join voucher.voucher voucher on voucher.id=source.id where source.member_id is not null;
update voucher.voucher voucher set holder_id=holder.id from voucher.holder holder where holder.voucher_id=voucher.id;

insert into voucher.issueitem(batch_id,scope_id,ordinal,credential_id,state,error_code,retryable,idempotency_key,updated_at)
select source.batch_id,target.scope_id,row_number() over(partition by source.batch_id order by source.id),target.credential_id,'succeeded',null,false,
  source.batch_id||':'||row_number() over(partition by source.batch_id order by source.id),target.created_at
from voucher.legacyvoucher source join voucher.voucher target on target.id=source.id;
insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
select source.voucher_id,target.scope_id,source.sequence,
  case source.previous_state when 'inactive' then 'available' else source.previous_state end,
  case source.next_state when 'inactive' then 'available' else source.next_state end,source.reason,source.actor_id,source.occurred_at
from voucher.legacytimeline source join voucher.voucher target on target.id=source.voucher_id;

insert into voucher.tenderhold(id,scope_id,voucher_id,owner_id,amount_minor,state,expires_at,idempotency_key,version,created_at,updated_at)
select source.id,target.scope_id,source.voucher_id,source.owner_id,greatest(target.remaining_minor,1),
  case source.state when 'consumed' then 'consumed' when 'released' then 'released' when 'rejected' then 'released' else 'active' end,
  source.expires_at,'migration:'||source.id,greatest(source.version,1),least(source.expires_at,clock_timestamp()),clock_timestamp()
from voucher.legacyreserve source join voucher.voucher target on target.id=source.voucher_id;
insert into voucher.redemption(id,scope_id,voucher_id,hold_id,verification_id,order_id,amount_minor,refunded_minor,currency,state,idempotency_key,version,redeemed_at,updated_at)
select source.id,target.scope_id,source.voucher_id,(select hold.id from voucher.tenderhold hold where hold.voucher_id=source.voucher_id and hold.owner_id=source.order_id order by hold.created_at desc limit 1),
  source.verification_id,source.order_id,greatest(source.amount_minor,1),least(greatest(coalesce((select sum(refund.amount_minor) from voucher.legacyrefund refund where refund.redemption_id=source.id and refund.state='reversed'),0),0),greatest(source.amount_minor,1)),
  target.currency,case when coalesce((select sum(refund.amount_minor) from voucher.legacyrefund refund where refund.redemption_id=source.id and refund.state='reversed'),0)>=greatest(source.amount_minor,1) then 'refunded'
    when coalesce((select sum(refund.amount_minor) from voucher.legacyrefund refund where refund.redemption_id=source.id and refund.state='reversed'),0)>0 then 'partiallyrefunded' else 'succeeded' end,
  'migration:'||source.id,greatest(source.version,1),source.redeemed_at,coalesce(source.reversed_at,source.redeemed_at)
from voucher.legacyredemption source join voucher.voucher target on target.id=source.voucher_id;
insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at,redemption_id)
select redemption.voucher_id,redemption.scope_id,
  coalesce((select max(event.sequence) from voucher.timeline event where event.voucher_id=redemption.voucher_id),0)
    +row_number() over(partition by redemption.voucher_id order by redemption.redeemed_at,redemption.id),
  null,target.state,'redemption','system:migration',redemption.redeemed_at,redemption.id
from voucher.redemption redemption join voucher.voucher target on target.id=redemption.voucher_id;
insert into voucher.refund(id,scope_id,redemption_id,amount_minor,currency,reason,state,rule_version,idempotency_key,created_at)
select source.id,target.scope_id,source.redemption_id,source.amount_minor,target.currency,source.reason,'succeeded',1,'migration:'||coalesce(source.reference_id,source.id),source.occurred_at
from voucher.legacyrefund source join voucher.redemption redemption on redemption.id=source.redemption_id join voucher.voucher target on target.id=redemption.voucher_id
where source.state='reversed';

insert into voucher.searchsnapshot(id,scope_id,filter,filter_hash,watermark,result_count,expires_at,created_by,created_at)
select 'migration:'||source.id,source.scope_id,jsonb_build_object('migrationActionBatch',source.id),
  encode(public.digest(source.scope_id||':'||source.id,'sha256'),'hex'),source.created_at,
  (select count(*) from voucher.legacyactionitem item join voucher.voucher target on target.id=item.voucher_id where item.batch_id=source.id),
  greatest(source.updated_at,clock_timestamp())+interval '100 years',source.actor_id,source.created_at
from voucher.legacyactionbatch source;
insert into voucher.searchsnapshotitem(snapshot_id,scope_id,voucher_id,ordinal,number_masked,product_id,member_id,remaining_minor,currency,state,starts_at,expires_at,voucher_version)
select 'migration:'||source.batch_id,target.scope_id,source.voucher_id,row_number() over(partition by source.batch_id order by source.voucher_id),
  target.number_masked,target.product_id,holder.member_id,target.remaining_minor,target.currency,target.state,target.starts_at,target.expires_at,target.version
from voucher.legacyactionitem source join voucher.voucher target on target.id=source.voucher_id
left join voucher.holder holder on holder.id=target.holder_id and holder.state='bound';

insert into voucher.actionbatch(id,scope_id,snapshot_id,action,reason,expires_at,state,requested,processed,succeeded,failed,retryable,version,created_by,created_at,updated_at)
select source.id,source.scope_id,'migration:'||source.id,case source.action when 'extend' then 'extend' when 'disable' then 'disable' when 'void' then 'void' else 'activate' end,
  source.reason,source.expires_at,case source.state when 'running' then 'running' when 'completed' then 'completed' when 'failed' then 'failed' else 'queued' end,
  source.requested_count,source.succeeded_count+source.failed_count,source.succeeded_count,source.failed_count,source.failed_count,greatest(source.succeeded_count+source.failed_count,1),
  source.actor_id,source.created_at,source.updated_at from voucher.legacyactionbatch source;
insert into voucher.actionitem(batch_id,scope_id,voucher_id,state,previous_state,next_state,error_code,retryable,idempotency_key,updated_at)
select source.batch_id,target.scope_id,source.voucher_id,source.state,source.previous_state,source.next_state,source.error_code,source.state='failed',source.batch_id||':'||source.voucher_id,source.updated_at
from voucher.legacyactionitem source join voucher.voucher target on target.id=source.voucher_id;

insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,state,rows_total,rows_processed,rows_succeeded,
  rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,created_at,updated_at,retention_until)
select 'import:'||split_part(source.id,':',2),source.scope_id,source.scope_id,'voucher','credential',source.object_ref,source.sha256,'voucher-credentials.csv','text/csv',1,
  case source.state when 'validating' then 'preflight' when 'reporting' then 'running' when 'completed' then 'succeeded' else source.state end,
  source.total_count,source.cursor_value,source.success_count,source.failure_count,source.validation_summary||jsonb_build_object('migratedFrom',source.id),
  source.report_object_ref,'migration:'||source.id,greatest(source.cursor_value,1),'migration:voucher','migration:voucher',source.created_at,source.updated_at,
  greatest(source.updated_at,clock_timestamp())+interval '90 days' from voucher.legacyimportjob source on conflict(id) do nothing;
insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,fencing_token,checkpoint,error_count,version,created_at,updated_at)
select 'importchunk:'||split_part(row.job_id,':',2)||':'||((row.row_number-2)/500)::integer,job.scope_id,job.scope_id,'import:'||split_part(row.job_id,':',2),
  ((row.row_number-2)/500)::integer,min(row.row_number),max(row.row_number),encode(public.digest(jsonb_agg(jsonb_build_object('row',row.row_number,'numberCiphertext',row.code_ciphertext,
  'fingerprint',row.code_fingerprint,'keyVersion',row.code_key_version) order by row.row_number)::text,'sha256'),'hex'),
  jsonb_agg(jsonb_build_object('row',row.row_number,'numberCiphertext',row.code_ciphertext,'fingerprint',row.code_fingerprint,'keyVersion',row.code_key_version) order by row.row_number),
  case when max(row.row_number)-1<=job.cursor_value then 'succeeded' else 'pending' end,null,'{}'::jsonb,count(*) filter(where row.error_code is not null),1,job.created_at,job.updated_at
from voucher.legacyimportrow row join voucher.legacyimportjob job on job.id=row.job_id group by row.job_id,job.scope_id,job.cursor_value,job.created_at,job.updated_at,((row.row_number-2)/500)::integer;
insert into runtime.import_errors(import_id,scope_id,row_number,reason_code,field,detail)
select 'import:'||split_part(error.job_id,':',2),job.scope_id,error.row_number,error.reason_code,error.field,jsonb_build_object('detail',error.detail)
from voucher.legacyimporterror error join voucher.legacyimportjob job on job.id=error.job_id on conflict do nothing;

do $scope$ declare source text; begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into source;
  source=replace(source,'select scope_id into resolved from voucher.program where id=p_resource','select scope_id into resolved from voucher.product where id=p_resource');
  source=replace(source,'select scope_id into resolved from voucher.cardpool where id=p_resource','select scope_id into resolved from voucher.credentialpool where id=p_resource');
  source=replace(source,'select scope_id into resolved from voucher.reserverequest where id=p_resource','select scope_id into resolved from voucher.stockrequest where id=p_resource');
  source=replace(source,'select program.scope_id into resolved from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id where batch.id=p_resource','select scope_id into resolved from voucher.issuebatch where id=p_resource');
  source=replace(source,'select program.scope_id into resolved from voucher.voucher voucher join voucher.program program on program.id=voucher.program_id where voucher.id=p_resource','select scope_id into resolved from voucher.voucher where id=p_resource');
  source=replace(source,'select program.scope_id into resolved from voucher.redemption redemption join voucher.voucher voucher on voucher.id=redemption.voucher_id join voucher.program program on program.id=voucher.program_id where redemption.id=p_resource','select scope_id into resolved from voucher.redemption where id=p_resource');
  source=replace(source,'voucher.programs.manage','voucher.products.create');
  if source like '%voucher.program %' or source like '%voucher.cardpool%' or source like '%voucher.reserverequest%' then raise exception 'VOUCHER_SCOPE_CUTOVER_FAILED'; end if;
  execute source;
end $scope$;


create function voucher.guard_product_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if old.state='retired' and new.state<>old.state then raise exception 'VOUCHER_PRODUCT_FINAL'; end if;
  if new.state='enabled' and (new.pool_id is null or new.expires_at<=clock_timestamp() or not exists(select 1 from voucher.credentialpool pool where pool.id=new.pool_id and pool.product_id=new.id and pool.state='open')) then raise exception 'VOUCHER_PRODUCT_INCOMPLETE'; end if;
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherproducttransition before update on voucher.product for each row execute function voucher.guard_product_transition();
create function voucher.guard_pool_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if old.state='closed' and new is distinct from old then raise exception 'VOUCHER_POOL_CLOSED'; end if;
  if new.generated<old.generated or new.version<>old.version+1 then raise exception 'VOUCHER_POOL_BACKWARD'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherpooltransition before update on voucher.credentialpool for each row execute function voucher.guard_pool_transition();
create function voucher.guard_hold_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if old.state<>'active' and new.state<>old.state then raise exception 'VOUCHER_HOLD_FINAL'; end if;
  if old.state='active' and new.state not in('active','consumed','released','expired') then raise exception 'VOUCHER_HOLD_BACKWARD'; end if;
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherholdtransition before update on voucher.tenderhold for each row execute function voucher.guard_hold_transition();
create function voucher.guard_redemption_refund() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.refunded_minor<old.refunded_minor or new.refunded_minor>new.amount_minor or new.version<>old.version+1 then raise exception 'VOUCHER_REFUND_INVALID'; end if;
  if new.state='succeeded' and new.refunded_minor<>0 or new.state='partiallyrefunded' and new.refunded_minor not between 1 and new.amount_minor-1 or new.state='refunded' and new.refunded_minor<>new.amount_minor then raise exception 'VOUCHER_REFUND_STATE_INVALID'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherredemptionrefund before update on voucher.redemption for each row execute function voucher.guard_redemption_refund();
create trigger voucher_refund_immutable before update or delete on voucher.refund for each row execute function runtime.reject_receipt_mutation();

create function voucher.guard_stockrequest_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  if old.state='draft' and new.state not in('draft','submitted','cancelled')
    or old.state='submitted' and new.state not in('submitted','approved','rejected','cancelled')
    or old.state='approved' and new.state not in('approved','fulfilled','cancelled')
    or old.state in('rejected','cancelled','fulfilled') and new.state<>old.state
  then raise exception 'VOUCHER_STOCKREQUEST_STATE_INVALID'; end if;
  if new.state in('submitted','approved','rejected','fulfilled') and new.approval_instance_id is null then raise exception 'VOUCHER_APPROVAL_REQUIRED'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherstockrequesttransition before update on voucher.stockrequest for each row execute function voucher.guard_stockrequest_transition();

create function voucher.guard_issueorder_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  if old.state='draft' and new.state not in('draft','submitted','cancelled')
    or old.state='submitted' and new.state not in('submitted','approved','cancelled')
    or old.state='approved' and new.state not in('approved','issuing','cancelled')
    or old.state='issuing' and new.state not in('issuing','completed','failed')
    or old.state='failed' and new.state<>'failed' and not(new.state='issuing' and current_setting('app.operation_id',true)='job.voucher.issue'
      and exists(select 1 from voucher.issuebatch batch where batch.order_id=old.id and batch.state in('queued','running')))
    or old.state in('completed','cancelled') and new.state<>old.state
  then raise exception 'VOUCHER_ISSUEORDER_STATE_INVALID'; end if;
  if new.state in('submitted','approved','issuing','completed','failed') and new.approval_instance_id is null then raise exception 'VOUCHER_APPROVAL_REQUIRED'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherissueordertransition before update on voucher.issueorder for each row execute function voucher.guard_issueorder_transition();

create function voucher.guard_credential_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  if old.state='generated' and new.state not in('generated','available','void')
    or old.state='available' and new.state not in('available','allocated','void')
    or old.state='allocated' and new.state not in('allocated','void')
    or old.state='void' and new.state<>'void'
  then raise exception 'VOUCHER_CREDENTIAL_STATE_INVALID'; end if;
  if new.number_ciphertext<>old.number_ciphertext or new.secret_ciphertext<>old.secret_ciphertext
    or new.number_fingerprint<>old.number_fingerprint or new.secret_fingerprint<>old.secret_fingerprint
  then raise exception 'VOUCHER_CREDENTIAL_IMMUTABLE'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger vouchercredentialtransition before update on voucher.credential for each row execute function voucher.guard_credential_transition();

create function voucher.guard_voucher_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 or new.remaining_minor>old.remaining_minor and current_setting('app.operation_id',true) not in('voucher.refunds.create','payment.refunds.request','job.payment.refund') then raise exception 'VOUCHER_VERSION_INVALID'; end if;
  if old.state='generated' and new.state not in('generated','available','void')
    or old.state='available' and new.state not in('available','allocated','bound','active','disabled','void','expired')
    or old.state='allocated' and new.state not in('allocated','bound','active','disabled','void','expired')
    or old.state='bound' and new.state not in('bound','active','disabled','void','expired') and not(current_setting('app.operation_id',true)='voucher.vouchers.unbind' and new.state='available')
    or old.state='active' and new.state not in('active','held','redeemed','disabled','expired') and not(current_setting('app.operation_id',true)='voucher.vouchers.unbind' and new.state='available')
    or old.state='held' and new.state not in('held','active','redeemed','disabled','expired')
    or old.state='disabled' and new.state not in('disabled','active','void','expired') and not(current_setting('app.operation_id',true)='voucher.vouchers.unbind' and new.state='available')
    or old.state='redeemed' and new.state not in('redeemed','reversed')
    or old.state in('void','reversed','expired') and new.state<>old.state
  then raise exception 'VOUCHER_STATE_INVALID'; end if;
  if new.state='redeemed' and new.remaining_minor<>0 then raise exception 'VOUCHER_REDEMPTION_CONFLICT'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger vouchervouchertransition before update on voucher.voucher for each row execute function voucher.guard_voucher_transition();

create function voucher.guard_batch_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
declare retrying boolean := old.state='failed' and new.state='queued' and old.retryable>0;
begin
  if new.version<>old.version+1 or new.processed<>new.succeeded+new.failed or new.processed>new.requested or new.retryable>new.failed
    or retrying and (new.succeeded<>old.succeeded or new.failed<>old.failed-old.retryable or new.retryable<>0)
    or not retrying and (new.processed<old.processed or new.succeeded<old.succeeded or new.failed<old.failed-old.retryable)
  then raise exception 'VOUCHER_BATCH_PROGRESS_INVALID'; end if;
  if old.state='queued' and new.state not in('queued','running','cancelled')
    or old.state='running' and new.state not in('running','completed','failed','cancelled')
    or old.state in('completed','failed') and not(new.state=old.state or new.state='queued' and old.retryable>0)
    or old.state='cancelled' and new.state<>'cancelled'
  then raise exception 'VOUCHER_BATCH_STATE_INVALID'; end if;
  new.updated_at=clock_timestamp(); return new;
end $function$;
create trigger voucherissuebatchtransition before update on voucher.issuebatch for each row execute function voucher.guard_batch_transition();
create trigger voucheractionbatchtransition before update on voucher.actionbatch for each row execute function voucher.guard_batch_transition();

create function voucher.guard_holder_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 or old.state='released' and new is distinct from old then raise exception 'VOUCHER_HOLDER_FINAL'; end if;
  if new.member_id<>old.member_id or new.voucher_id<>old.voucher_id then raise exception 'VOUCHER_HOLDER_IMMUTABLE'; end if;
  return new;
end $function$;
create trigger voucherholdertransition before update on voucher.holder for each row execute function voucher.guard_holder_transition();

create function voucher.create_refund(
  p_id text,p_scope text,p_redemption text,p_amount bigint,p_reason text,p_rule_version bigint,p_idempotency text,p_created_at timestamptz
) returns voucher.refund language plpgsql set search_path=voucher,pg_temp as $function$
declare existing voucher.refund; redeemed voucher.redemption; created voucher.refund; total bigint;
begin
  select * into existing from voucher.refund where scope_id=p_scope and idempotency_key=p_idempotency;
  if found then return existing; end if;
  select * into redeemed from voucher.redemption where id=p_redemption and scope_id=p_scope for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  total=redeemed.refunded_minor+p_amount;
  if p_amount<=0 or total>redeemed.amount_minor then raise exception 'VOUCHER_REFUND_EXCEEDS_REDEMPTION'; end if;
  insert into voucher.refund(id,scope_id,redemption_id,amount_minor,currency,reason,state,rule_version,idempotency_key,created_at)
  values(p_id,p_scope,p_redemption,p_amount,redeemed.currency,p_reason,'succeeded',p_rule_version,p_idempotency,p_created_at) returning * into created;
  update voucher.redemption set refunded_minor=total,state=case when total=amount_minor then 'refunded' else 'partiallyrefunded' end,version=version+1
  where id=redeemed.id;
  return created;
end $function$;
revoke all on function voucher.create_refund(text,text,text,bigint,text,bigint,text,timestamptz) from public;
grant execute on function voucher.create_refund(text,text,text,bigint,text,bigint,text,timestamptz) to shopapp,shopjob;

alter table voucher.product enable row level security;
alter table voucher.product force row level security;
create policy voucherapp on voucher.product for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.product for all to shopjob using(true) with check(true);
revoke all on voucher.product from public;
grant select,insert,update,delete on voucher.product to shopapp,shopjob;
alter table voucher.productversion enable row level security;
alter table voucher.productversion force row level security;
create policy voucherapp on voucher.productversion for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.productversion for all to shopjob using(true) with check(true);
revoke all on voucher.productversion from public;
grant select,insert,update,delete on voucher.productversion to shopapp,shopjob;
alter table voucher.credentialpool enable row level security;
alter table voucher.credentialpool force row level security;
create policy voucherapp on voucher.credentialpool for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.credentialpool for all to shopjob using(true) with check(true);
revoke all on voucher.credentialpool from public;
grant select,insert,update,delete on voucher.credentialpool to shopapp,shopjob;
alter table voucher.credential enable row level security;
alter table voucher.credential force row level security;
create policy voucherapp on voucher.credential for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.credential for all to shopjob using(true) with check(true);
revoke all on voucher.credential from public;
grant select,insert,update,delete on voucher.credential to shopapp,shopjob;
alter table voucher.stockrequest enable row level security;
alter table voucher.stockrequest force row level security;
create policy voucherapp on voucher.stockrequest for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.stockrequest for all to shopjob using(true) with check(true);
revoke all on voucher.stockrequest from public;
grant select,insert,update,delete on voucher.stockrequest to shopapp,shopjob;
alter table voucher.issueorder enable row level security;
alter table voucher.issueorder force row level security;
create policy voucherapp on voucher.issueorder for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.issueorder for all to shopjob using(true) with check(true);
revoke all on voucher.issueorder from public;
grant select,insert,update,delete on voucher.issueorder to shopapp,shopjob;
alter table voucher.issuebatch enable row level security;
alter table voucher.issuebatch force row level security;
create policy voucherapp on voucher.issuebatch for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.issuebatch for all to shopjob using(true) with check(true);
revoke all on voucher.issuebatch from public;
grant select,insert,update,delete on voucher.issuebatch to shopapp,shopjob;
alter table voucher.issueitem enable row level security;
alter table voucher.issueitem force row level security;
create policy voucherapp on voucher.issueitem for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.issueitem for all to shopjob using(true) with check(true);
revoke all on voucher.issueitem from public;
grant select,insert,update,delete on voucher.issueitem to shopapp,shopjob;
alter table voucher.voucher enable row level security;
alter table voucher.voucher force row level security;
create policy voucherapp on voucher.voucher for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.voucher for all to shopjob using(true) with check(true);
revoke all on voucher.voucher from public;
grant select,insert,update,delete on voucher.voucher to shopapp,shopjob;
alter table voucher.holder enable row level security;
alter table voucher.holder force row level security;
create policy voucherapp on voucher.holder for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.holder for all to shopjob using(true) with check(true);
revoke all on voucher.holder from public;
grant select,insert,update,delete on voucher.holder to shopapp,shopjob;
alter table voucher.timeline enable row level security;
alter table voucher.timeline force row level security;
create policy voucherapp on voucher.timeline for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.timeline for all to shopjob using(true) with check(true);
revoke all on voucher.timeline from public;
grant select,insert,update,delete on voucher.timeline to shopapp,shopjob;
alter table voucher.tenderhold enable row level security;
alter table voucher.tenderhold force row level security;
create policy voucherapp on voucher.tenderhold for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.tenderhold for all to shopjob using(true) with check(true);
revoke all on voucher.tenderhold from public;
grant select,insert,update,delete on voucher.tenderhold to shopapp,shopjob;
alter table voucher.redemption enable row level security;
alter table voucher.redemption force row level security;
create policy voucherapp on voucher.redemption for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.redemption for all to shopjob using(true) with check(true);
revoke all on voucher.redemption from public;
grant select,insert,update,delete on voucher.redemption to shopapp,shopjob;
alter table voucher.refund enable row level security;
alter table voucher.refund force row level security;
create policy voucherapp on voucher.refund for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.refund for all to shopjob using(true) with check(true);
revoke all on voucher.refund from public;
grant select,insert,update,delete on voucher.refund to shopapp,shopjob;
alter table voucher.actionbatch enable row level security;
alter table voucher.actionbatch force row level security;
create policy voucherapp on voucher.actionbatch for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.actionbatch for all to shopjob using(true) with check(true);
revoke all on voucher.actionbatch from public;
grant select,insert,update,delete on voucher.actionbatch to shopapp,shopjob;
alter table voucher.actionitem enable row level security;
alter table voucher.actionitem force row level security;
create policy voucherapp on voucher.actionitem for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.actionitem for all to shopjob using(true) with check(true);
revoke all on voucher.actionitem from public;
grant select,insert,update,delete on voucher.actionitem to shopapp,shopjob;
alter table voucher.searchsnapshot enable row level security;
alter table voucher.searchsnapshot force row level security;
create policy voucherapp on voucher.searchsnapshot for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.searchsnapshot for all to shopjob using(true) with check(true);
revoke all on voucher.searchsnapshot from public;
grant select,insert,update,delete on voucher.searchsnapshot to shopapp,shopjob;
alter table voucher.searchsnapshotitem enable row level security;
alter table voucher.searchsnapshotitem force row level security;
create policy voucherapp on voucher.searchsnapshotitem for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.searchsnapshotitem for all to shopjob using(true) with check(true);
revoke all on voucher.searchsnapshotitem from public;
grant select,insert,delete on voucher.searchsnapshotitem to shopapp,shopjob;
alter table voucher.activationattempt enable row level security;
alter table voucher.activationattempt force row level security;
create policy voucherapp on voucher.activationattempt for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy voucherjob on voucher.activationattempt for all to shopjob using(true) with check(true);
revoke all on voucher.activationattempt from public;
grant select,insert,update,delete on voucher.activationattempt to shopapp,shopjob;

delete from capability.dependency where capability_id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse') or depends_on_id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');
delete from capability.entitlementhistory where capability_id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');
delete from capability.entitlement where capability_id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');
delete from capability.operation where operation_id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');
delete from capability.capability where id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');
delete from runtime.operation where id in('voucher.cardlibraries.read','voucher.cardlibraries.create','voucher.cardlibraries.allocate','voucher.imports.read','voucher.programs.read','voucher.programs.manage','voucher.reserves.read','voucher.reserves.request','voucher.reserves.decide','voucher.batches.read','voucher.batches.issue','voucher.batches.retry','voucher.status.batch','voucher.statusbatches.read','voucher.bindings.read','voucher.bindings.manage','voucher.redemptions.read','voucher.history.read','voucher.redemptions.reverse');

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:voucher.action.manage','voucher.action.manage','critical','active','执行卡券批量动作'),
  ('permission:voucher.action.read','voucher.action.read','high','active','查看卡券批量动作'),
  ('permission:voucher.credential.export','voucher.credential.export','critical','active','导出卡号和密钥'),
  ('permission:voucher.credential.manage','voucher.credential.manage','critical','active','管理平台卡号库'),
  ('permission:voucher.credential.read','voucher.credential.read','low','active','查看脱敏凭证'),
  ('permission:voucher.export.manage','voucher.export.manage','high','active','创建卡券业务导出'),
  ('permission:voucher.export.read','voucher.export.read','high','active','领取卡券导出结果'),
  ('permission:voucher.holder.manage','voucher.holder.manage','high','active','管理卡券持有人'),
  ('permission:voucher.holder.read','voucher.holder.read','low','active','查看持有卡券'),
  ('permission:voucher.issue.manage','voucher.issue.manage','critical','active','提交和执行发券'),
  ('permission:voucher.issue.read','voucher.issue.read','high','active','查看发券记录'),
  ('permission:voucher.job.read','voucher.job.read','low','active','查看卡券任务'),
  ('permission:voucher.product.manage','voucher.product.manage','high','active','管理卡券产品'),
  ('permission:voucher.product.read','voucher.product.read','low','active','查看卡券产品'),
  ('permission:voucher.refund.manage','voucher.refund.manage','critical','active','执行卡券退款'),
  ('permission:voucher.search.read','voucher.search.read','high','active','检索卡券'),
  ('permission:voucher.stockrequest.manage','voucher.stockrequest.manage','critical','active','管理卡券库存申请'),
  ('permission:voucher.stockrequest.read','voucher.stockrequest.read','high','active','查看卡券库存申请');

create temporary table voucherpermissionmap(legacycode text not null,targetcode text not null,primary key(legacycode,targetcode)) on commit drop;
insert into voucherpermissionmap(legacycode,targetcode) values
  ('voucher.batch.read','voucher.job.read'),('voucher.batch.read','voucher.issue.read'),
  ('voucher.binding.manage','voucher.holder.manage'),('voucher.binding.read','voucher.holder.read'),('voucher.binding.read','voucher.search.read'),
  ('voucher.cardlibrary.allocate','voucher.credential.export'),('voucher.cardlibrary.allocate','voucher.credential.manage'),
  ('voucher.cardlibrary.create','voucher.credential.manage'),('voucher.cardlibrary.manage','voucher.credential.manage'),
  ('voucher.cardlibrary.read','voucher.credential.read'),('voucher.history.read','voucher.action.read'),('voucher.history.read','voucher.search.read'),
  ('voucher.issue','voucher.issue.manage'),('voucher.program.manage','voucher.product.manage'),('voucher.program.read','voucher.product.read'),
  ('voucher.redemption.reverse','voucher.refund.manage'),('voucher.reserve.decide','voucher.stockrequest.manage'),
  ('voucher.reserve.request','voucher.stockrequest.manage'),('voucher.reserve.read','voucher.stockrequest.read'),
  ('voucher.status.manage','voucher.action.manage'),('reporting.export.manage','voucher.export.manage'),('reporting.export.read','voucher.export.read');

insert into access.rolepermission(role_id,permission_id,effect)
select source.role_id,target.id,case when bool_or(source.effect='deny') then 'deny' else 'allow' end
from access.rolepermission source
join access.permission legacy on legacy.id=source.permission_id
join voucherpermissionmap mapping on mapping.legacycode=legacy.code
join access.permission target on target.code=mapping.targetcode
group by source.role_id,target.id
on conflict(role_id,permission_id) do update set effect=case when access.rolepermission.effect='deny' or excluded.effect='deny' then 'deny' else 'allow' end;

-- Different time windows cannot be losslessly folded into the single override row.
-- Require an explicit entitlement reconciliation rather than silently extending access.
do $overridepreflight$ begin
  if exists(
    select source.membership_id,mapping.targetcode
    from access.membershipoverride source join access.permission legacy on legacy.id=source.permission_id
    join voucherpermissionmap mapping on mapping.legacycode=legacy.code
    group by source.membership_id,mapping.targetcode
    having count(distinct jsonb_build_array(source.effective_at,source.expires_at,source.revoked_at))>1
  ) then raise exception 'VOUCHER_OVERRIDE_WINDOW_RECONCILIATION_REQUIRED'; end if;
end $overridepreflight$;

insert into access.membershipoverride(membership_id,permission_id,effect,granted_by,reason,effective_at,expires_at,revoked_at)
select source.membership_id,target.id,case when bool_or(source.effect='deny') then 'deny' else 'allow' end,
  min(source.granted_by),string_agg(distinct source.reason,'；'),source.effective_at,source.expires_at,source.revoked_at
from access.membershipoverride source
join access.permission legacy on legacy.id=source.permission_id
join voucherpermissionmap mapping on mapping.legacycode=legacy.code
join access.permission target on target.code=mapping.targetcode
group by source.membership_id,target.id,source.effective_at,source.expires_at,source.revoked_at
on conflict(membership_id,permission_id) do update set effect=case when access.membershipoverride.effect='deny' or excluded.effect='deny' then 'deny' else 'allow' end,granted_by=excluded.granted_by,reason=excluded.reason,
  effective_at=excluded.effective_at,expires_at=excluded.expires_at,revoked_at=excluded.revoked_at;

insert into access.separationrule(id,left_permission,right_permission,reason,state,version,created_at,updated_at)
values('separationrule:vouchercredentialissue','voucher.credential.manage','voucher.issue.manage','凭证生产与卡券发放必须职责分离','active',1,clock_timestamp(),clock_timestamp());
update access.permission set status='retired',name_zh='旧卡券权限（已硬切）'
where code in('voucher.batch.read','voucher.binding.manage','voucher.binding.read','voucher.cardlibrary.allocate','voucher.cardlibrary.create','voucher.cardlibrary.manage','voucher.cardlibrary.read',
  'voucher.history.read','voucher.issue','voucher.program.manage','voucher.program.read','voucher.redemption.reverse','voucher.reserve.decide','voucher.reserve.read','voucher.reserve.request','voucher.status.manage');

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('voucher.products.create','voucher','POST','/api/v1/vouchers/products','5.0.0'),
  ('voucher.products.revise','voucher','POST','/api/v1/vouchers/products/{productid}/versions','5.0.0'),
  ('voucher.products.enable','voucher','POST','/api/v1/vouchers/products/{productid}/enable','5.0.0'),
  ('voucher.products.disable','voucher','POST','/api/v1/vouchers/products/{productid}/disable','5.0.0'),
  ('voucher.products.get','voucher','GET','/api/v1/vouchers/products/{productid}','5.0.0'),
  ('voucher.products.list','voucher','GET','/api/v1/vouchers/products','5.0.0'),
  ('voucher.productoptions.list','voucher','GET','/api/v1/vouchers/product-options','5.0.0'),
  ('voucher.credentialpools.create','voucher','POST','/api/v1/vouchers/credential-pools','5.0.0'),
  ('voucher.credentials.generate','voucher','POST','/api/v1/vouchers/credential-pools/{poolid}/generate','5.0.0'),
  ('voucher.credentials.import','voucher','POST','/api/v1/vouchers/credential-pools/{poolid}/imports','5.0.0'),
  ('voucher.credentialpools.close','voucher','POST','/api/v1/vouchers/credential-pools/{poolid}/close','5.0.0'),
  ('voucher.credentialpools.get','voucher','GET','/api/v1/vouchers/credential-pools/{poolid}','5.0.0'),
  ('voucher.credentialpools.list','voucher','GET','/api/v1/vouchers/credential-pools','5.0.0'),
  ('voucher.credentials.list','voucher','GET','/api/v1/vouchers/credentials','5.0.0'),
  ('voucher.credentials.get','voucher','GET','/api/v1/vouchers/credentials/{credentialid}','5.0.0'),
  ('voucher.credentialexports.create','voucher','POST','/api/v1/vouchers/credential-exports','5.0.0'),
  ('voucher.jobs.get','voucher','GET','/api/v1/vouchers/jobs/{jobid}','5.0.0'),
  ('voucher.stockrequests.create','voucher','POST','/api/v1/vouchers/stock-requests','5.0.0'),
  ('voucher.stockrequests.update','voucher','PATCH','/api/v1/vouchers/stock-requests/{requestid}','5.0.0'),
  ('voucher.stockrequests.submit','voucher','POST','/api/v1/vouchers/stock-requests/{requestid}/submit','5.0.0'),
  ('voucher.stockrequests.cancel','voucher','POST','/api/v1/vouchers/stock-requests/{requestid}/cancel','5.0.0'),
  ('voucher.stockrequests.get','voucher','GET','/api/v1/vouchers/stock-requests/{requestid}','5.0.0'),
  ('voucher.stockrequests.list','voucher','GET','/api/v1/vouchers/stock-requests','5.0.0'),
  ('voucher.stockrequestoptions.list','voucher','GET','/api/v1/vouchers/stock-request-options','5.0.0'),
  ('voucher.issueorders.create','voucher','POST','/api/v1/vouchers/issue-orders','5.0.0'),
  ('voucher.issueorders.update','voucher','PATCH','/api/v1/vouchers/issue-orders/{orderid}','5.0.0'),
  ('voucher.issueorders.submit','voucher','POST','/api/v1/vouchers/issue-orders/{orderid}/submit','5.0.0'),
  ('voucher.issueorders.cancel','voucher','POST','/api/v1/vouchers/issue-orders/{orderid}/cancel','5.0.0'),
  ('voucher.issueorders.get','voucher','GET','/api/v1/vouchers/issue-orders/{orderid}','5.0.0'),
  ('voucher.issueorders.list','voucher','GET','/api/v1/vouchers/issue-orders','5.0.0'),
  ('voucher.issuebatches.retry','voucher','POST','/api/v1/vouchers/issue-batches/{batchid}/retry','5.0.0'),
  ('voucher.issuebatches.get','voucher','GET','/api/v1/vouchers/issue-batches/{batchid}','5.0.0'),
  ('voucher.issueorderexports.create','voucher','POST','/api/v1/vouchers/issue-order-exports','5.0.0'),
  ('voucher.actionbatches.create','voucher','POST','/api/v1/vouchers/action-batches','5.0.0'),
  ('voucher.actionbatches.get','voucher','GET','/api/v1/vouchers/action-batches/{actionbatchid}','5.0.0'),
  ('voucher.actionbatches.list','voucher','GET','/api/v1/vouchers/action-batches','5.0.0'),
  ('voucher.actionbatches.retry','voucher','POST','/api/v1/vouchers/action-batches/{actionbatchid}/retry','5.0.0'),
  ('voucher.actionexports.create','voucher','POST','/api/v1/vouchers/action-exports','5.0.0'),
  ('voucher.search.read','voucher','GET','/api/v1/vouchers/search','5.0.0'),
  ('voucher.activations.secret','voucher','POST','/api/v1/vouchers/activation/secret','5.0.0'),
  ('voucher.activations.numbersecret','voucher','POST','/api/v1/vouchers/activation/number-secret','5.0.0'),
  ('voucher.vouchers.bind','voucher','POST','/api/v1/vouchers/{voucherid}/bind','5.0.0'),
  ('voucher.vouchers.unbind','voucher','POST','/api/v1/vouchers/{voucherid}/unbind','5.0.0'),
  ('voucher.vouchers.get','voucher','GET','/api/v1/vouchers/{voucherid}','5.0.0'),
  ('voucher.vouchers.getbynumber','voucher','GET','/api/v1/vouchers/by-number/{number}','5.0.0'),
  ('voucher.vouchers.timeline','voucher','GET','/api/v1/vouchers/{voucherid}/timeline','5.0.0'),
  ('voucher.redemptions.quote','voucher','POST','/api/v1/vouchers/redemptions/quote','5.0.0'),
  ('voucher.tenderholds.create','voucher','POST','/api/v1/vouchers/tender-holds','5.0.0'),
  ('voucher.tenderholds.consume','voucher','POST','/api/v1/vouchers/tender-holds/{holdid}/consume','5.0.0'),
  ('voucher.tenderholds.release','voucher','POST','/api/v1/vouchers/tender-holds/{holdid}/release','5.0.0'),
  ('voucher.redemptions.create','voucher','POST','/api/v1/vouchers/redemptions','5.0.0'),
  ('voucher.refunds.create','voucher','POST','/api/v1/vouchers/redemptions/{redemptionid}/refunds','5.0.0'),
  ('voucher.redemptions.get','voucher','GET','/api/v1/vouchers/redemptions/{redemptionid}','5.0.0'),
  ('voucher.searchfacets.read','voucher','GET','/api/v1/vouchers/search/facets','5.0.0'),
  ('voucher.searchsnapshots.create','voucher','POST','/api/v1/vouchers/search-snapshots','5.0.0'),
  ('voucher.searchexports.create','voucher','POST','/api/v1/vouchers/search-exports','5.0.0'),
  ('voucher.exports.get','voucher','GET','/api/v1/vouchers/exports/{exportid}','5.0.0');
insert into capability.capability(id,kind,name,version,status) values
  ('voucher.products.create','operation','voucher.products.create','1','active'),
  ('voucher.products.revise','operation','voucher.products.revise','1','active'),
  ('voucher.products.enable','operation','voucher.products.enable','1','active'),
  ('voucher.products.disable','operation','voucher.products.disable','1','active'),
  ('voucher.products.get','operation','voucher.products.get','1','active'),
  ('voucher.products.list','operation','voucher.products.list','1','active'),
  ('voucher.productoptions.list','operation','voucher.productoptions.list','1','active'),
  ('voucher.credentialpools.create','operation','voucher.credentialpools.create','1','active'),
  ('voucher.credentials.generate','operation','voucher.credentials.generate','1','active'),
  ('voucher.credentials.import','operation','voucher.credentials.import','1','active'),
  ('voucher.credentialpools.close','operation','voucher.credentialpools.close','1','active'),
  ('voucher.credentialpools.get','operation','voucher.credentialpools.get','1','active'),
  ('voucher.credentialpools.list','operation','voucher.credentialpools.list','1','active'),
  ('voucher.credentials.list','operation','voucher.credentials.list','1','active'),
  ('voucher.credentials.get','operation','voucher.credentials.get','1','active'),
  ('voucher.credentialexports.create','operation','voucher.credentialexports.create','1','active'),
  ('voucher.jobs.get','operation','voucher.jobs.get','1','active'),
  ('voucher.stockrequests.create','operation','voucher.stockrequests.create','1','active'),
  ('voucher.stockrequests.update','operation','voucher.stockrequests.update','1','active'),
  ('voucher.stockrequests.submit','operation','voucher.stockrequests.submit','1','active'),
  ('voucher.stockrequests.cancel','operation','voucher.stockrequests.cancel','1','active'),
  ('voucher.stockrequests.get','operation','voucher.stockrequests.get','1','active'),
  ('voucher.stockrequests.list','operation','voucher.stockrequests.list','1','active'),
  ('voucher.stockrequestoptions.list','operation','voucher.stockrequestoptions.list','1','active'),
  ('voucher.issueorders.create','operation','voucher.issueorders.create','1','active'),
  ('voucher.issueorders.update','operation','voucher.issueorders.update','1','active'),
  ('voucher.issueorders.submit','operation','voucher.issueorders.submit','1','active'),
  ('voucher.issueorders.cancel','operation','voucher.issueorders.cancel','1','active'),
  ('voucher.issueorders.get','operation','voucher.issueorders.get','1','active'),
  ('voucher.issueorders.list','operation','voucher.issueorders.list','1','active'),
  ('voucher.issuebatches.retry','operation','voucher.issuebatches.retry','1','active'),
  ('voucher.issuebatches.get','operation','voucher.issuebatches.get','1','active'),
  ('voucher.issueorderexports.create','operation','voucher.issueorderexports.create','1','active'),
  ('voucher.actionbatches.create','operation','voucher.actionbatches.create','1','active'),
  ('voucher.actionbatches.get','operation','voucher.actionbatches.get','1','active'),
  ('voucher.actionbatches.list','operation','voucher.actionbatches.list','1','active'),
  ('voucher.actionbatches.retry','operation','voucher.actionbatches.retry','1','active'),
  ('voucher.actionexports.create','operation','voucher.actionexports.create','1','active'),
  ('voucher.search.read','operation','voucher.search.read','1','active'),
  ('voucher.activations.secret','operation','voucher.activations.secret','1','active'),
  ('voucher.activations.numbersecret','operation','voucher.activations.numbersecret','1','active'),
  ('voucher.vouchers.bind','operation','voucher.vouchers.bind','1','active'),
  ('voucher.vouchers.unbind','operation','voucher.vouchers.unbind','1','active'),
  ('voucher.vouchers.get','operation','voucher.vouchers.get','1','active'),
  ('voucher.vouchers.getbynumber','operation','voucher.vouchers.getbynumber','1','active'),
  ('voucher.vouchers.timeline','operation','voucher.vouchers.timeline','1','active'),
  ('voucher.redemptions.quote','operation','voucher.redemptions.quote','1','active'),
  ('voucher.tenderholds.create','operation','voucher.tenderholds.create','1','active'),
  ('voucher.tenderholds.consume','operation','voucher.tenderholds.consume','1','active'),
  ('voucher.tenderholds.release','operation','voucher.tenderholds.release','1','active'),
  ('voucher.redemptions.create','operation','voucher.redemptions.create','1','active'),
  ('voucher.refunds.create','operation','voucher.refunds.create','1','active'),
  ('voucher.redemptions.get','operation','voucher.redemptions.get','1','active'),
  ('voucher.searchfacets.read','operation','voucher.searchfacets.read','1','active'),
  ('voucher.searchsnapshots.create','operation','voucher.searchsnapshots.create','1','active'),
  ('voucher.searchexports.create','operation','voucher.searchexports.create','1','active'),
  ('voucher.exports.get','operation','voucher.exports.get','1','active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('voucher.products.create','voucher.products.create','voucher.product.manage','console',array['console']::text[]),
  ('voucher.products.revise','voucher.products.revise','voucher.product.manage','console',array['console']::text[]),
  ('voucher.products.enable','voucher.products.enable','voucher.product.manage','console',array['console']::text[]),
  ('voucher.products.disable','voucher.products.disable','voucher.product.manage','console',array['console']::text[]),
  ('voucher.products.get','voucher.products.get','voucher.product.read','console',array['console']::text[]),
  ('voucher.products.list','voucher.products.list','voucher.product.read','console',array['console']::text[]),
  ('voucher.productoptions.list','voucher.productoptions.list','voucher.product.read','console',array['console']::text[]),
  ('voucher.credentialpools.create','voucher.credentialpools.create','voucher.credential.manage','console',array['console']::text[]),
  ('voucher.credentials.generate','voucher.credentials.generate','voucher.credential.manage','console',array['console']::text[]),
  ('voucher.credentials.import','voucher.credentials.import','voucher.credential.manage','console',array['console']::text[]),
  ('voucher.credentialpools.close','voucher.credentialpools.close','voucher.credential.manage','console',array['console']::text[]),
  ('voucher.credentialpools.get','voucher.credentialpools.get','voucher.credential.read','console',array['console']::text[]),
  ('voucher.credentialpools.list','voucher.credentialpools.list','voucher.credential.read','console',array['console']::text[]),
  ('voucher.credentials.list','voucher.credentials.list','voucher.credential.read','console',array['console']::text[]),
  ('voucher.credentials.get','voucher.credentials.get','voucher.credential.read','console',array['console']::text[]),
  ('voucher.credentialexports.create','voucher.credentialexports.create','voucher.credential.export','console',array['console']::text[]),
  ('voucher.jobs.get','voucher.jobs.get','voucher.job.read','console',array['console']::text[]),
  ('voucher.stockrequests.create','voucher.stockrequests.create','voucher.stockrequest.manage','console',array['console']::text[]),
  ('voucher.stockrequests.update','voucher.stockrequests.update','voucher.stockrequest.manage','console',array['console']::text[]),
  ('voucher.stockrequests.submit','voucher.stockrequests.submit','voucher.stockrequest.manage','console',array['console']::text[]),
  ('voucher.stockrequests.cancel','voucher.stockrequests.cancel','voucher.stockrequest.manage','console',array['console']::text[]),
  ('voucher.stockrequests.get','voucher.stockrequests.get','voucher.stockrequest.read','console',array['console']::text[]),
  ('voucher.stockrequests.list','voucher.stockrequests.list','voucher.stockrequest.read','console',array['console']::text[]),
  ('voucher.stockrequestoptions.list','voucher.stockrequestoptions.list','voucher.stockrequest.read','console',array['console']::text[]),
  ('voucher.issueorders.create','voucher.issueorders.create','voucher.issue.manage','console',array['console']::text[]),
  ('voucher.issueorders.update','voucher.issueorders.update','voucher.issue.manage','console',array['console']::text[]),
  ('voucher.issueorders.submit','voucher.issueorders.submit','voucher.issue.manage','console',array['console']::text[]),
  ('voucher.issueorders.cancel','voucher.issueorders.cancel','voucher.issue.manage','console',array['console']::text[]),
  ('voucher.issueorders.get','voucher.issueorders.get','voucher.issue.read','console',array['console']::text[]),
  ('voucher.issueorders.list','voucher.issueorders.list','voucher.issue.read','console',array['console']::text[]),
  ('voucher.issuebatches.retry','voucher.issuebatches.retry','voucher.issue.manage','console',array['console']::text[]),
  ('voucher.issuebatches.get','voucher.issuebatches.get','voucher.issue.read','console',array['console']::text[]),
  ('voucher.issueorderexports.create','voucher.issueorderexports.create','voucher.export.manage','console',array['console']::text[]),
  ('voucher.actionbatches.create','voucher.actionbatches.create','voucher.action.manage','console',array['console']::text[]),
  ('voucher.actionbatches.get','voucher.actionbatches.get','voucher.action.read','console',array['console']::text[]),
  ('voucher.actionbatches.list','voucher.actionbatches.list','voucher.action.read','console',array['console']::text[]),
  ('voucher.actionbatches.retry','voucher.actionbatches.retry','voucher.action.manage','console',array['console']::text[]),
  ('voucher.actionexports.create','voucher.actionexports.create','voucher.export.manage','console',array['console']::text[]),
  ('voucher.search.read','voucher.search.read','voucher.search.read','public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.activations.secret','voucher.activations.secret',null,'public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.activations.numbersecret','voucher.activations.numbersecret',null,'public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.vouchers.bind','voucher.vouchers.bind','voucher.holder.manage','console',array['console','store']::text[]),
  ('voucher.vouchers.unbind','voucher.vouchers.unbind','voucher.holder.manage','console',array['console','store']::text[]),
  ('voucher.vouchers.get','voucher.vouchers.get','voucher.holder.read','public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.vouchers.getbynumber','voucher.vouchers.getbynumber','voucher.search.read','console',array['console','store']::text[]),
  ('voucher.vouchers.timeline','voucher.vouchers.timeline','voucher.holder.read','public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.redemptions.quote','voucher.redemptions.quote','verification.verify','console',array['console','store']::text[]),
  ('voucher.tenderholds.create','voucher.tenderholds.create','verification.verify','console',array['console','store']::text[]),
  ('voucher.tenderholds.consume','voucher.tenderholds.consume','verification.verify','console',array['console','store']::text[]),
  ('voucher.tenderholds.release','voucher.tenderholds.release','verification.verify','console',array['console','store']::text[]),
  ('voucher.redemptions.create','voucher.redemptions.create','verification.verify','console',array['console','store']::text[]),
  ('voucher.refunds.create','voucher.refunds.create','voucher.refund.manage','console',array['console','store']::text[]),
  ('voucher.redemptions.get','voucher.redemptions.get','voucher.redemption.read','public',array['console','storefront','miniapp','store','supplier']::text[]),
  ('voucher.searchfacets.read','voucher.searchfacets.read','voucher.search.read','console',array['console']::text[]),
  ('voucher.searchsnapshots.create','voucher.searchsnapshots.create','voucher.search.read','console',array['console']::text[]),
  ('voucher.searchexports.create','voucher.searchexports.create','voucher.export.manage','console',array['console']::text[]),
  ('voucher.exports.get','voucher.exports.get','voucher.export.read','console',array['console']::text[]);
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration:voucher','richvoucherpublish'
from capability.capability capability where capability.id in('voucher.products.create','voucher.products.revise','voucher.products.enable','voucher.products.disable','voucher.products.get','voucher.products.list','voucher.productoptions.list','voucher.credentialpools.create','voucher.credentials.generate','voucher.credentials.import','voucher.credentialpools.close','voucher.credentialpools.get','voucher.credentialpools.list','voucher.credentials.list','voucher.credentials.get','voucher.credentialexports.create','voucher.jobs.get','voucher.stockrequests.create','voucher.stockrequests.update','voucher.stockrequests.submit','voucher.stockrequests.cancel','voucher.stockrequests.get','voucher.stockrequests.list','voucher.stockrequestoptions.list','voucher.issueorders.create','voucher.issueorders.update','voucher.issueorders.submit','voucher.issueorders.cancel','voucher.issueorders.get','voucher.issueorders.list','voucher.issuebatches.retry','voucher.issuebatches.get','voucher.issueorderexports.create','voucher.actionbatches.create','voucher.actionbatches.get','voucher.actionbatches.list','voucher.actionbatches.retry','voucher.actionexports.create','voucher.search.read','voucher.activations.secret','voucher.activations.numbersecret','voucher.vouchers.bind','voucher.vouchers.unbind','voucher.vouchers.get','voucher.vouchers.getbynumber','voucher.vouchers.timeline','voucher.redemptions.quote','voucher.tenderholds.create','voucher.tenderholds.consume','voucher.tenderholds.release','voucher.redemptions.create','voucher.refunds.create','voucher.redemptions.get','voucher.searchfacets.read','voucher.searchsnapshots.create','voucher.searchexports.create','voucher.exports.get');
insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':richvoucherpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration:voucher','richvoucherpublish',clock_timestamp()
from capability.entitlement entitlement where entitlement.capability_id in('voucher.products.create','voucher.products.revise','voucher.products.enable','voucher.products.disable','voucher.products.get','voucher.products.list','voucher.productoptions.list','voucher.credentialpools.create','voucher.credentials.generate','voucher.credentials.import','voucher.credentialpools.close','voucher.credentialpools.get','voucher.credentialpools.list','voucher.credentials.list','voucher.credentials.get','voucher.credentialexports.create','voucher.jobs.get','voucher.stockrequests.create','voucher.stockrequests.update','voucher.stockrequests.submit','voucher.stockrequests.cancel','voucher.stockrequests.get','voucher.stockrequests.list','voucher.stockrequestoptions.list','voucher.issueorders.create','voucher.issueorders.update','voucher.issueorders.submit','voucher.issueorders.cancel','voucher.issueorders.get','voucher.issueorders.list','voucher.issuebatches.retry','voucher.issuebatches.get','voucher.issueorderexports.create','voucher.actionbatches.create','voucher.actionbatches.get','voucher.actionbatches.list','voucher.actionbatches.retry','voucher.actionexports.create','voucher.search.read','voucher.activations.secret','voucher.activations.numbersecret','voucher.vouchers.bind','voucher.vouchers.unbind','voucher.vouchers.get','voucher.vouchers.getbynumber','voucher.vouchers.timeline','voucher.redemptions.quote','voucher.tenderholds.create','voucher.tenderholds.consume','voucher.tenderholds.release','voucher.redemptions.create','voucher.refunds.create','voucher.redemptions.get','voucher.searchfacets.read','voucher.searchsnapshots.create','voucher.searchexports.create','voucher.exports.get');
insert into capability.dependency(capability_id,depends_on_id) values
  ('voucher.products.create','voucher.lifecycle'),
  ('voucher.products.revise','voucher.lifecycle'),
  ('voucher.products.enable','voucher.lifecycle'),
  ('voucher.products.disable','voucher.lifecycle'),
  ('voucher.products.get','voucher.lifecycle'),
  ('voucher.products.list','voucher.lifecycle'),
  ('voucher.productoptions.list','voucher.lifecycle'),
  ('voucher.credentialpools.create','voucher.lifecycle'),
  ('voucher.credentials.generate','voucher.lifecycle'),
  ('voucher.credentials.import','voucher.lifecycle'),
  ('voucher.credentials.import','runtime.importing'),
  ('voucher.credentialpools.close','voucher.lifecycle'),
  ('voucher.credentialpools.get','voucher.lifecycle'),
  ('voucher.credentialpools.list','voucher.lifecycle'),
  ('voucher.credentials.list','voucher.lifecycle'),
  ('voucher.credentials.get','voucher.lifecycle'),
  ('voucher.credentialexports.create','voucher.lifecycle'),
  ('voucher.credentialexports.create','approval.workflow'),
  ('voucher.jobs.get','voucher.lifecycle'),
  ('voucher.stockrequests.create','voucher.lifecycle'),
  ('voucher.stockrequests.create','approval.workflow'),
  ('voucher.stockrequests.update','voucher.lifecycle'),
  ('voucher.stockrequests.update','approval.workflow'),
  ('voucher.stockrequests.submit','voucher.lifecycle'),
  ('voucher.stockrequests.submit','approval.workflow'),
  ('voucher.stockrequests.cancel','voucher.lifecycle'),
  ('voucher.stockrequests.cancel','approval.workflow'),
  ('voucher.stockrequests.get','voucher.lifecycle'),
  ('voucher.stockrequests.get','approval.workflow'),
  ('voucher.stockrequests.list','voucher.lifecycle'),
  ('voucher.stockrequests.list','approval.workflow'),
  ('voucher.stockrequestoptions.list','voucher.lifecycle'),
  ('voucher.issueorders.create','voucher.lifecycle'),
  ('voucher.issueorders.create','approval.workflow'),
  ('voucher.issueorders.update','voucher.lifecycle'),
  ('voucher.issueorders.update','approval.workflow'),
  ('voucher.issueorders.submit','voucher.lifecycle'),
  ('voucher.issueorders.submit','approval.workflow'),
  ('voucher.issueorders.cancel','voucher.lifecycle'),
  ('voucher.issueorders.cancel','approval.workflow'),
  ('voucher.issueorders.get','voucher.lifecycle'),
  ('voucher.issueorders.get','approval.workflow'),
  ('voucher.issueorders.list','voucher.lifecycle'),
  ('voucher.issueorders.list','approval.workflow'),
  ('voucher.issuebatches.retry','voucher.lifecycle'),
  ('voucher.issuebatches.get','voucher.lifecycle'),
  ('voucher.issueorderexports.create','voucher.lifecycle'),
  ('voucher.issueorderexports.create','approval.workflow'),
  ('voucher.actionbatches.create','voucher.lifecycle'),
  ('voucher.actionbatches.get','voucher.lifecycle'),
  ('voucher.actionbatches.list','voucher.lifecycle'),
  ('voucher.actionbatches.retry','voucher.lifecycle'),
  ('voucher.actionexports.create','voucher.lifecycle'),
  ('voucher.actionexports.create','approval.workflow'),
  ('voucher.search.read','voucher.lifecycle'),
  ('voucher.activations.secret','voucher.lifecycle'),
  ('voucher.activations.numbersecret','voucher.lifecycle'),
  ('voucher.vouchers.bind','voucher.lifecycle'),
  ('voucher.vouchers.unbind','voucher.lifecycle'),
  ('voucher.vouchers.get','voucher.lifecycle'),
  ('voucher.vouchers.getbynumber','voucher.lifecycle'),
  ('voucher.vouchers.timeline','voucher.lifecycle'),
  ('voucher.redemptions.quote','voucher.lifecycle'),
  ('voucher.tenderholds.create','voucher.lifecycle'),
  ('voucher.tenderholds.consume','voucher.lifecycle'),
  ('voucher.tenderholds.release','voucher.lifecycle'),
  ('voucher.redemptions.create','voucher.lifecycle'),
  ('voucher.refunds.create','voucher.lifecycle'),
  ('voucher.redemptions.get','voucher.lifecycle'),
  ('voucher.searchfacets.read','voucher.lifecycle'),
  ('voucher.searchsnapshots.create','voucher.lifecycle'),
  ('voucher.searchexports.create','voucher.lifecycle'),
  ('voucher.searchexports.create','approval.workflow'),
  ('voucher.exports.get','voucher.lifecycle'),
  ('voucher.exports.get','approval.workflow');

alter table runtime.errorcontract disable row level security;
insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version) values
  ('VOUCHER_APPROVAL_REQUIRED',409,false,true,'message','5.0.0'),
  ('VOUCHER_BATCH_NOT_RETRYABLE',409,false,true,'message','5.0.0'),
  ('VOUCHER_CREDENTIAL_CONFLICT',409,false,true,'message','5.0.0'),
  ('VOUCHER_EXPORT_NOT_READY',409,true,false,'retry','5.0.0'),
  ('VOUCHER_HOLD_CONFLICT',409,false,true,'message','5.0.0'),
  ('VOUCHER_HOLD_EXPIRED',409,false,true,'message','5.0.0'),
  ('VOUCHER_NOT_REDEEMABLE',409,false,false,'message','5.0.0'),
  ('VOUCHER_NOT_USABLE',409,false,false,'message','5.0.0'),
  ('VOUCHER_POOL_CLOSED',409,false,true,'message','5.0.0'),
  ('VOUCHER_PRODUCT_INCOMPLETE',422,false,true,'message','5.0.0'),
  ('VOUCHER_REDEMPTION_CONFLICT',409,false,false,'message','5.0.0'),
  ('VOUCHER_REFUND_EXCEEDS_REDEMPTION',409,false,true,'message','5.0.0'),
  ('VOUCHER_SECRET_INVALID',400,false,true,'message','5.0.0'),
  ('VOUCHER_STATE_INVALID',409,false,false,'message','5.0.0'),
  ('VOUCHER_STOCK_INSUFFICIENT',409,false,true,'message','5.0.0')
on conflict(code) do update set status=excluded.status,retryable=excluded.retryable,audit=excluded.audit,client=excluded.client,contract_version=excluded.contract_version;
alter table runtime.errorcontract enable row level security;

update runtime.contractcatalog set checksum='f52c095d7f81a423575e327072693d0356b261d05d5b7138f01d867cf89505bd',operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp() where artifact='commerce' and version='5.0.0' and status='active';
select runtime.record_migration_evidence('20260904028200',(select count(*) from voucher.voucher),(select count(*) from voucher.voucher),0,0,
  'select state,count(*),sum(remaining_minor) remaining_minor from voucher.voucher group by state;',
  'select state,count(*),sum(amount_minor) amount_minor from voucher.redemption group by state;');
insert into runtime.schemaversion(version,checksum) values('20260904028200',encode(public.digest('20260904028200_prepare_voucher','sha256'),'hex'));

do $assert$ begin
  if exists(select voucher_id from voucher.tenderhold where state='active' group by voucher_id having count(*)>1) then raise exception 'VOUCHER_ACTIVE_HOLD_DUPLICATE'; end if;
  if exists(select 1 from voucher.credential where number_ciphertext='' or secret_ciphertext='' or number_fingerprint!~'^[0-9a-f]{64}$') then raise exception 'VOUCHER_CREDENTIAL_PROTECTION_INVALID'; end if;
  if exists(select 1 from voucher.issuebatch where processed<>succeeded+failed or retryable>failed) then raise exception 'VOUCHER_BATCH_PROGRESS_INVALID'; end if;
  if (select count(*) from runtime.operation)<>356 then raise exception 'VOUCHER_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>144 then raise exception 'VOUCHER_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
