begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031200') then raise exception 'SUPPORT_MESSAGE_UNIFICATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031300') then raise exception 'SUPPORT_MESSAGE_UNIFICATION_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table support_message_before on commit drop as
select count(*) rows_count from support.message;

alter table support.message add column kind text;
alter table support.message add column visibility text;
update support.message set kind='text',visibility='external';
alter table support.message alter column kind set not null;
alter table support.message alter column visibility set not null;
alter table support.message add constraint support_message_kind check(kind in('text','attachment','system'));
alter table support.message add constraint support_message_visibility check(visibility in('external','internal'));
alter table support.message add constraint support_message_audience check(
  (author_type='member' and visibility='external' and kind<>'system')
  or(author_type='agent' and kind<>'system')
  or(author_type='system' and author_id='system' and visibility='internal' and kind='system')
);
alter table support.message drop constraint support_message_author_type;
alter table support.message add constraint support_message_author_type check(author_type in('member','agent','system'));

select runtime.record_migration_evidence(
  '20260904031300',before.rows_count,after.rows_count,0,0,
  'select conversation_id,sequence,kind,visibility,author_type from support.message order by conversation_id,sequence;',
  'select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid=''support.message''::regclass order by conname;'
)
from support_message_before before cross join(select count(*) rows_count from support.message) after;

insert into runtime.schemaversion(version,checksum)
values('20260904031300',encode(public.digest('20260904031300_unify_support_messages','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from support.message where kind not in('text','attachment','system') or visibility not in('external','internal')) then raise exception 'SUPPORT_MESSAGE_CLASSIFICATION_INVALID'; end if;
  if exists(select 1 from support.message where author_type='member' and visibility<>'external') then raise exception 'SUPPORT_MEMBER_MESSAGE_VISIBILITY_INVALID'; end if;
  if exists(select 1 from support.message where author_type='system' and(kind<>'system' or visibility<>'internal' or author_id<>'system')) then raise exception 'SUPPORT_SYSTEM_MESSAGE_VISIBILITY_INVALID'; end if;
end
$assert$;

commit;
