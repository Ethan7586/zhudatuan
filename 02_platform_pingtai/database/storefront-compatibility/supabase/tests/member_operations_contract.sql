begin;

do $$
declare
  invite jsonb; created jsonb; updated jsonb; report jsonb; center jsonb; password_changed boolean;
  test_username text:='contract.member.'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  target_membership text;
begin
  invite:=public.api_create_membership_invite(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    '契约测试邀请',encode(digest('CONTRACT-'||gen_random_uuid()::text,'sha256'),'base64'),3,now()+interval '1 day',
    'member-ops-invite','contract-test','{}'::jsonb
  );
  if invite->>'status'<>'active' then raise exception 'CONTRACT_INVITATION_NOT_CREATED'; end if;
  if (select r.code from public.membership_registration_invites i join public.roles r on r.id=i.role_id where i.id=invite->>'id')<>'employee' then
    raise exception 'CONTRACT_INVITATION_MINTED_NON_EMPLOYEE';
  end if;

  created:=public.api_admin_create_member(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    test_username,'pbkdf2-sha256$310000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    '契约测试员工','CONTRACT-'||upper(substr(test_username,17)),null,'department-digital',
    'member-ops-create','contract-test','{}'::jsonb
  );
  if created->>'status'<>'active' then raise exception 'CONTRACT_MEMBER_NOT_CREATED'; end if;
  target_membership:=created->>'membershipId';
  if exists(select 1 from public.memberships where id=target_membership and target<>'storefront') then raise exception 'CONTRACT_ADMIN_MEMBERSHIP_CREATED'; end if;
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target_membership and r.is_owner) then raise exception 'CONTRACT_OWNER_CREATED'; end if;
  if not exists(select 1 from public.member_credentials c join public.memberships m on m.member_id=c.member_id where m.id=target_membership and c.must_reset_password) then raise exception 'CONTRACT_PASSWORD_RESET_NOT_REQUIRED'; end if;

  password_changed:=public.api_initial_change_local_password(
    created->>'memberId','pbkdf2-sha256$310000$BBBBBBBBBBBBBBBBBBBBBB==$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    'member-ops-initial-password','contract-test'
  );
  if not password_changed or exists(select 1 from public.member_credentials c where c.member_id=created->>'memberId' and c.must_reset_password) then
    raise exception 'CONTRACT_INITIAL_PASSWORD_CHANGE_FAILED';
  end if;

  updated:=public.api_update_member_profile(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    target_membership,'契约测试员工新名','contract@example.com',null,'契约测试资料更新',
    'member-ops-update','contract-test','{}'::jsonb
  );
  if updated->>'status'<>'updated' then raise exception 'CONTRACT_MEMBER_NOT_UPDATED'; end if;

  begin
    perform public.api_update_member_profile(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
      'membership-test-owner-admin','试图修改Owner',null,null,'契约测试Owner保护',
      'member-ops-owner','contract-test','{}'::jsonb
    );
    raise exception 'CONTRACT_OWNER_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%OWNER_MEMBERSHIP_PROTECTED%' then raise; end if;
  end;

  report:=public.api_record_member_import(
    'contract-import-'||gen_random_uuid()::text,'membership-test-owner-admin','tenant-smart-wing','enterprise-demo','mall-demo',
    'contract.csv',2,1,jsonb_build_array(jsonb_build_object('rowNumber',3,'code','INVALID_MEMBER_INPUT','message','错误行','input',jsonb_build_object('username','bad')))
  );
  if report->>'status'<>'partial' or report->>'failedRows'<>'1' then raise exception 'CONTRACT_IMPORT_REPORT_INVALID'; end if;

  center:=public.api_member_operations_center('membership-test-owner-admin','tenant-smart-wing','enterprise-demo','mall-demo',true,true,true);
  if center is null or jsonb_array_length(center->'profiles')<1 or jsonb_array_length(center->'history')<2 then raise exception 'CONTRACT_CENTER_INCOMPLETE'; end if;
end;
$$;

rollback;
