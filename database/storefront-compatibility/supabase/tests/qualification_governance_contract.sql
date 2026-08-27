begin;

do $$
declare
  v_payload jsonb:=jsonb_build_object(
    'status','active','code','GOV_TEST_ZONE','name','治理测试城市专区','appliesTo','both',
    'cities',jsonb_build_array(jsonb_build_object('code','310000','name','上海')),
    'resources',jsonb_build_array(jsonb_build_object('kind','sku','id','sku-rice-5kg'))
  );
  v_request jsonb; v_review jsonb; v_history jsonb; v_snapshot jsonb; v_stale_request jsonb; v_stale_review jsonb;
  v_change_id text; v_zone_id text; v_error text;
begin
  v_request:=public.api_request_qualification_change(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner','membership-test-owner-admin',
    'city_zone','',0,v_payload,'发布治理测试城市专区','governance-request-0001','0123456789abcdef',
    'governance-request','contract-test','{}'::jsonb
  );
  if v_request->>'status'<>'pending' or not (v_request->>'approvalRequired')::boolean then raise exception 'CONTRACT_REQUEST_NOT_PENDING'; end if;
  v_change_id:=v_request->>'changeRequestId';

  begin
    perform public.api_review_qualification_change(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner','membership-test-owner-admin',
      v_change_id,'approve','申请人尝试自行审批','self-review','contract-test','{}'::jsonb
    );
    raise exception 'CONTRACT_SELF_APPROVAL_WAS_ALLOWED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error not like '%QUALIFICATION_SELF_APPROVAL_FORBIDDEN%' then raise; end if;
  end;

  v_review:=public.api_review_qualification_change(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-admin-001','membership-test-admin-001',
    v_change_id,'approve','另一位管理员核对通过','peer-review','contract-test','{}'::jsonb
  );
  if v_review->>'status'<>'applied' then raise exception 'CONTRACT_APPROVAL_NOT_APPLIED'; end if;
  v_zone_id:=v_review->>'id';
  if not exists(select 1 from public.city_zones where id=v_zone_id and status='active' and version=1) then raise exception 'CONTRACT_ZONE_NOT_ACTIVE'; end if;

  v_history:=public.api_qualification_history('tenant-smart-wing','mall-demo','city_zone',v_zone_id);
  if jsonb_array_length(v_history)<>1 or v_history->0->>'version'<>'1' then raise exception 'CONTRACT_HISTORY_MISSING'; end if;
  v_snapshot:=public.api_qualification_rollback_snapshot('tenant-smart-wing','mall-demo','city_zone',v_zone_id,v_history->0->>'auditId');
  if v_snapshot<>v_payload then raise exception 'CONTRACT_ROLLBACK_SNAPSHOT_CHANGED'; end if;

  v_stale_request:=public.api_request_qualification_change(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner','membership-test-owner-admin',
    'city_zone',v_zone_id,1,v_payload||jsonb_build_object('status','disabled'),'停用治理测试城市专区',
    'governance-request-0002','fedcba9876543210','governance-stale','contract-test','{}'::jsonb
  );
  update public.city_zones set version=version+1 where id=v_zone_id;
  v_stale_review:=public.api_review_qualification_change(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-admin-001','membership-test-admin-001',
    v_stale_request->>'changeRequestId','approve','审批时版本已变化','stale-review','contract-test','{}'::jsonb
  );
  if v_stale_review->>'status'<>'stale' then raise exception 'CONTRACT_STALE_CHANGE_APPLIED'; end if;

  insert into public.employee_qualification_tags(tenant_id,user_id,tag_code,source)
  values('tenant-smart-wing','user-demo','HR_LOCKED','hr');
  begin
    perform public.api_update_employee_qualification(
      'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner','membership-test-owner-admin','user-demo',0,
      '310000','上海','active','{}'::jsonb,jsonb_build_array(jsonb_build_object('code','HR_LOCKED')),
      '尝试覆盖外部标签','employee-conflict','contract-test','{}'::jsonb
    );
    raise exception 'CONTRACT_EXTERNAL_TAG_WAS_OVERWRITTEN';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error not like '%EMPLOYEE_QUALIFICATION_TAG_SOURCE_CONFLICT%' then raise; end if;
  end;
  perform public.api_update_employee_qualification(
    'tenant-smart-wing','enterprise-demo','mall-demo','user-test-owner','membership-test-owner-admin','user-demo',0,
    '310000','上海','active','{}'::jsonb,jsonb_build_array(jsonb_build_object('code','EAST_MANUAL')),
    '初始化人工资格标签','employee-update','contract-test','{}'::jsonb
  );
  if not exists(select 1 from public.employee_qualification_tags where user_id='user-demo' and tag_code='HR_LOCKED' and source='hr')
    or not exists(select 1 from public.employee_qualification_tags where user_id='user-demo' and tag_code='EAST_MANUAL' and source='manual') then
    raise exception 'CONTRACT_TAG_SOURCES_NOT_PRESERVED';
  end if;
end;
$$;

rollback;
