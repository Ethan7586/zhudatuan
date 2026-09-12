begin;

select pg_advisory_xact_lock(hashtext('identity:reconciliation-function-ownership:v1'));

alter function identity.realm_contains_account_realm(text,text) owner to zhudatuanroot;
alter function identity.resolve_active_membership_context(text,text,text) owner to zhudatuanroot;
alter function identity.project_member_realm_targets() owner to zhudatuanroot;

insert into runtime.schemaversion(version,checksum)
values('20260912181000','7f572c8552da254682185a5262e6a94bb7ead0f51ed3ab1f46fe386718b0a9e3');

commit;
