begin;

-- OP codes are presentation identifiers. Retire the four-character assignments;
-- Membership, realms, roles and sessions remain unchanged.
do $precondition$
begin
  if exists(select 1 from identity_display.code_mapping mapping
    left join access.membership membership on membership.id=mapping.membership_id
    where mapping.kind='operator' and (membership.realm_id is distinct from 'realm:l1'
      or membership.client is distinct from 'operator')) then
    raise exception 'L1_OPERATOR_CODE_DATABASE_BOUNDARY_INVALID';
  end if;
end
$precondition$;

delete from identity_display.code_mapping where kind='operator';

alter table identity_display.code_mapping drop constraint code_mapping_check;
alter table identity_display.code_mapping add constraint code_mapping_check
  check((kind='operator' and code ~ '^OP-[2-9A-HJKMNP-Z]{6}$')
    or (kind='member' and code ~ '^MB-[2-9A-HJKMNP-Z]{6}$'));

create unique index identity_display_operator_code_unique
  on identity_display.code_mapping(code) where kind='operator';
create unique index identity_display_operator_membership_unique
  on identity_display.code_mapping(membership_id) where kind='operator';

insert into runtime.schemaversion(version,checksum)
values('20260917170000',encode(public.digest('operator-display-code-six:v1','sha256'),'hex'));

commit;
