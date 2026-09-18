-- Static, copyable L-kernel standard; no Realm, Node or Membership instances.
-- This catalog publishes L-5..L11 without changing the existing runtime parser.
begin;

create schema if not exists lkernel;

create table lkernel.signed_level_code (
  code text primary key,
  level_number smallint not null unique,
  segment text not null
);

insert into lkernel.signed_level_code(code,level_number,segment) values
  ('L-5',-5,'supply_side'),
  ('L-4',-4,'supply_side'),
  ('L-3',-3,'supply_side'),
  ('L-2',-2,'supply_side'),
  ('L-1',-1,'supply_side'),
  ('L0',0,'member_l0_l5'),
  ('L1',1,'member_l0_l5'),
  ('L2',2,'member_l0_l5'),
  ('L3',3,'member_l0_l5'),
  ('L4',4,'member_l0_l5'),
  ('L5',5,'member_l0_l5'),
  ('L6',6,'member_l6_l11'),
  ('L7',7,'member_l6_l11'),
  ('L8',8,'member_l6_l11'),
  ('L9',9,'member_l6_l11'),
  ('L10',10,'member_l6_l11'),
  ('L11',11,'member_l6_l11');

commit;
