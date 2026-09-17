begin;

-- Retire L1's disposable four-character OP assignments only. The shared-host
-- database still serves L0, whose existing codes and runtime are unchanged.
delete from identity_display.code_mapping mapping
where mapping.kind='operator' and (
  mapping.context_id='mall:d1708f04df2dd8a61736852c4900fb43'
  or exists(select 1 from access.membership membership
    where membership.id=mapping.membership_id and membership.realm_id='realm:l1')
);

alter table identity_display.code_mapping drop constraint code_mapping_check;
alter table identity_display.code_mapping add constraint code_mapping_check
  check((kind='operator' and (code ~ '^OP-[2-9A-HJKMNP-Z]{4}$'
    or code ~ '^OP-[2-9A-HJKMNP-Z]{6}$'))
    or (kind='member' and code ~ '^MB-[2-9A-HJKMNP-Z]{6}$'));

create unique index identity_display_operator_code_unique
  on identity_display.code_mapping(code)
  where kind='operator' and code ~ '^OP-[2-9A-HJKMNP-Z]{6}$';
create unique index identity_display_operator_membership_unique
  on identity_display.code_mapping(membership_id)
  where kind='operator' and code ~ '^OP-[2-9A-HJKMNP-Z]{6}$';

insert into runtime.schemaversion(version,checksum)
values('20260917170000',encode(public.digest('operator-display-code-six:v1','sha256'),'hex'));

commit;
