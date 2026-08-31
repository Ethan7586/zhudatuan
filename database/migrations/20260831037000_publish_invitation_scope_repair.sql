begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831036000') then
    raise exception 'INVITATION_SCOPE_PUBLISH_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831037000') then
    raise exception 'INVITATION_SCOPE_PUBLISH_ALREADY_APPLIED';
  end if;
  if position('identity.invitations.read' in pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure))=0 then
    raise exception 'INVITATION_READ_SCOPE_REPAIR_MISSING';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831037000',1,1,0,0,
  'select pg_get_functiondef(''access.resource_scope(text,text,text)''::regprocedure);',
  'select version,checksum from runtime.schemaversion where version in(''20260831036000'',''20260831037000'') order by version;');

insert into runtime.schemaversion(version,checksum)
values('20260831037000','848ae95b92bde2a45498e83e442ed5832593d8571117324076517128c0fc01d0');

commit;
