begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:console-support-review-attachments:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260914231500'
      and checksum='f5e2c63f3351f910d32434b4ad829f88fece45b83b30ca9e30a903fc0b30ffb4') then
    raise exception 'CONSOLE_SUPPORT_REVIEW_PREDECESSOR_MISSING';
  end if;
  if to_regrole('shopconsole') is null
    or to_regclass('support.evidence') is null
    or to_regclass('support.history') is null then
    raise exception 'CONSOLE_SUPPORT_REVIEW_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

alter table support.evidence add column file_name text not null default '附件';
alter table support.evidence add constraint support_evidence_file_name_check
  check(length(btrim(file_name)) between 1 and 160);
alter table support.evidence add column visibility text not null default 'public';
alter table support.evidence add constraint support_evidence_visibility_check
  check(visibility in('public','internal'));

grant insert on support.evidence to shopconsole;

create policy consolesupportevidenceinsert on support.evidence for insert to shopconsole
with check(access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260916123000','566f98cc283cabf3d9327186f1f591f68b16ffb8f9326747db87f26bc2f39a24');

do $assert$
begin
  if not has_table_privilege('shopconsole','support.evidence','SELECT,INSERT')
    or has_table_privilege('shopconsole','support.evidence','UPDATE,DELETE')
    or not exists(select 1 from pg_attribute
      where attrelid='support.evidence'::regclass and attname='file_name' and attnotnull)
    or not exists(select 1 from pg_attribute
      where attrelid='support.evidence'::regclass and attname='visibility' and attnotnull)
    or not exists(select 1 from pg_policies
      where schemaname='support' and tablename='evidence' and policyname='consolesupportevidenceinsert')
    or not exists(select 1 from runtime.schemaversion
      where version='20260916123000'
        and checksum='566f98cc283cabf3d9327186f1f591f68b16ffb8f9326747db87f26bc2f39a24') then
    raise exception 'CONSOLE_SUPPORT_REVIEW_SCHEMA_INVALID';
  end if;
end
$assert$;

commit;
