begin;

do $contract$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,12);
  test_scope text:='scope:referral-contract:'||suffix;
  other_scope text:='scope:referral-other:'||suffix;
  category_id text:='category:referral-contract:'||suffix;
  product_id text:='product:referral-contract:'||suffix;
  sku_id text:='sku:referral-contract:'||suffix;
  customer_a text:='member:referral-customer-a:'||suffix;
  customer_b text:='member:referral-customer-b:'||suffix;
  profile_a text:='member:referral-a:'||suffix;
  profile_b text:='member:referral-b:'||suffix;
  referral_a text:='referral-member:a:'||suffix;
  referral_b text:='referral-member:b:'||suffix;
  order_id text:='order:referral-contract:'||suffix;
  line_id text:='line:referral-contract:'||suffix;
  original_journal text;
  partial_journal text;
  recovery_journal text;
  future_journal text;
  offset_journal text;
  first_result record;
  retained_result record;
  expired_result record;
  replaced_result record;
begin
  insert into member.profile(
    id,principal_id,display_name,status,created_at,updated_at
  ) values
    (customer_a,'principal:referral-customer-a:'||suffix,'推荐契约客户甲','active',now(),now()),
    (customer_b,'principal:referral-customer-b:'||suffix,'推荐契约客户乙','active',now(),now()),
    (profile_a,'principal:referral-a:'||suffix,'推荐契约成员甲','active',now(),now()),
    (profile_b,'principal:referral-b:'||suffix,'推荐契约成员乙','active',now(),now());

  insert into catalog.category(id,code,name,status,sort_order)
  values(category_id,'referral-contract-'||suffix,'推荐契约分类','active',0);
  insert into catalog.product(
    id,category_id,title,product_type,attributes,status,created_at,updated_at
  ) values(product_id,category_id,'推荐契约商品','physical','{}','active',now(),now());
  insert into catalog.sku(id,product_id,code,specifications,status)
  values(sku_id,product_id,'REFERRAL-'||upper(suffix),'{}','active');

  insert into ordering.orderrecord(
    id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
    payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,
    address_snapshot,invoice_snapshot,delivery_snapshot,created_at,updated_at
  ) values(
    order_id,'REFERRAL-'||upper(suffix),test_scope,customer_a,'mall:referral-contract:'||suffix,
    'checkout:referral-contract:'||suffix,'CNY',1000,'paid','delivered','none','active','{}',
    'null','null','{}',now(),now()
  );
  insert into ordering.line(
    id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,evidence
  ) values(line_id,order_id,sku_id,'listing:referral-contract:'||suffix,'推荐契约商品',1,1000,1000,'{}');

  insert into referral.setting(
    id,scope_id,enabled,recruit_enabled,review_required,reward_enabled,binding_mode,binding_days,
    settle_trigger,settle_delay_days,withdraw_min_minor,withdraw_monthly_max
  ) values(
    'referral-setting:'||suffix,test_scope,true,true,true,true,'days',1,'on_paid',7,100,10
  );
  insert into referral.product(
    id,scope_id,sku_id,commission_bps,reward_bps,enabled
  ) values('referral-product:'||suffix,test_scope,sku_id,1250,250,true);
  insert into referral.member(
    id,scope_id,member_id,inviter_member_id,state,approved_by,approved_at
  ) values
    (referral_a,test_scope,profile_a,null,'active','contract-reviewer',now()),
    (referral_b,test_scope,profile_b,referral_a,'active','contract-reviewer',now());

  select * into first_result from referral.bind_first_touch(
    'referral-binding:a:'||suffix,test_scope,customer_a,referral_a,now()
  );
  select * into retained_result from referral.bind_first_touch(
    'referral-binding:b:'||suffix,test_scope,customer_a,referral_b,now()+interval '1 minute'
  );
  if not first_result.created or first_result.winner_referral_member_id<>referral_a
    or retained_result.created or retained_result.winner_referral_member_id<>referral_a
    or retained_result.winner_bound_at<>first_result.winner_bound_at
  then raise exception 'REFERRAL_FIRST_TOUCH_CONTRACT_FAILED'; end if;

  select * into expired_result from referral.bind_first_touch(
    'referral-binding:expired:'||suffix,test_scope,customer_b,referral_a,now()-interval '2 days'
  );
  select * into replaced_result from referral.bind_first_touch(
    'referral-binding:replacement:'||suffix,test_scope,customer_b,referral_b,now()
  );
  if not expired_result.created or not replaced_result.created
    or replaced_result.winner_referral_member_id<>referral_b
  then raise exception 'REFERRAL_EXPIRED_BINDING_REPLACEMENT_FAILED'; end if;

  begin
    insert into referral.binding(
      id,scope_id,customer_member_id,referral_member_id,bound_at
    ) values('referral-binding:cross-scope:'||suffix,other_scope,customer_a,referral_a,now());
    raise exception 'REFERRAL_CROSS_SCOPE_BINDING_ALLOWED';
  exception when foreign_key_violation then null;
  end;

  insert into referral.commission(
    id,scope_id,order_id,order_line_id,sku_id,beneficiary_member_id,kind,currency,
    base_minor,rate_bps,amount_minor,state,origin_event_id,setting_version,product_version,
    settle_trigger,settle_delay_days
  ) values(
    'referral-commission:pending:'||suffix,test_scope,order_id,line_id,sku_id,profile_a,'commission','CNY',
    999,1250,124,'pending','event:order-placed:pending:'||suffix,0,0,'on_paid',7
  );
  begin
    insert into referral.commission(
      id,scope_id,order_id,order_line_id,sku_id,beneficiary_member_id,kind,currency,
      base_minor,rate_bps,amount_minor,state,origin_event_id,setting_version,product_version,
      settle_trigger,settle_delay_days
    ) values(
      'referral-commission:replay:'||suffix,test_scope,order_id,line_id,sku_id,profile_a,'commission','CNY',
      999,1250,124,'pending','event:order-placed:pending:'||suffix,0,0,'on_paid',7
    );
    raise exception 'REFERRAL_COMMISSION_REPLAY_ALLOWED';
  exception when unique_violation then null;
  end;

  insert into referral.commissionmovement(
    id,scope_id,commission_id,beneficiary_member_id,origin_event_id,kind,base_minor,amount_minor
  ) values(
    'referral-movement:pending-partial:'||suffix,test_scope,'referral-commission:pending:'||suffix,profile_a,
    'event:payment-refunded:pending:'||suffix,'reversal',400,50
  );
  if not exists(
    select 1 from referral.commission
    where id='referral-commission:pending:'||suffix and state='pending'
      and reversed_base_minor=400 and reversed_minor=50 and journal_id is null
  ) then raise exception 'REFERRAL_PENDING_PARTIAL_REVERSAL_FAILED'; end if;
  insert into referral.commissionmovement(
    id,scope_id,commission_id,beneficiary_member_id,origin_event_id,kind,base_minor,amount_minor
  ) values(
    'referral-movement:full:'||suffix,test_scope,'referral-commission:pending:'||suffix,profile_a,
    'event:order-cancelled:'||suffix,'reversal',599,74
  );
  if not exists(
    select 1 from referral.commission
    where id='referral-commission:pending:'||suffix and state='reversed'
      and reversed_base_minor=base_minor and reversed_minor=amount_minor
      and reversal_event_id='event:order-cancelled:'||suffix
  ) then raise exception 'REFERRAL_FULL_REVERSAL_CONTRACT_FAILED'; end if;
  insert into referral.commissionmovement(
    id,scope_id,commission_id,beneficiary_member_id,origin_event_id,kind,base_minor,amount_minor
  ) values(
    'referral-movement:full-replay:'||suffix,test_scope,'referral-commission:pending:'||suffix,profile_a,
    'event:order-cancelled:'||suffix,'reversal',599,74
  );
  if (select count(*) from referral.commissionmovement
      where scope_id=test_scope and commission_id='referral-commission:pending:'||suffix)<>2
    or not exists(select 1 from referral.commission
      where id='referral-commission:pending:'||suffix and reversed_base_minor=999 and reversed_minor=124)
  then raise exception 'REFERRAL_REVERSAL_REPLAY_CONTRACT_FAILED'; end if;

  original_journal:=finance.post(
    test_scope,'order.placed','referral-original:'||suffix,'CNY','Referral contract original',
    'order.receivable.referral-contract','asset','commerce.revenue','income',100,now()
  );
  partial_journal:=finance.post(
    test_scope,'order.placed','referral-partial:'||suffix,'CNY','Referral contract partial reversal',
    'order.receivable.referral-contract','asset','commerce.revenue','income',40,now()
  );
  insert into referral.commission(
    id,scope_id,order_id,order_line_id,sku_id,beneficiary_member_id,kind,currency,
    base_minor,rate_bps,amount_minor,state,origin_event_id,setting_version,product_version,
    settle_trigger,settle_delay_days,eligible_at,journal_id,settling_at,settled_at
  ) values(
    'referral-commission:settled:'||suffix,test_scope,order_id,line_id,sku_id,profile_b,'reward','CNY',
    1000,1000,100,'settled','event:order-placed:settled:'||suffix,0,0,'on_paid',7,
    now()-interval '1 day',original_journal,now()-interval '1 day',now()-interval '1 hour'
  );
  insert into referral.commissionmovement(
    id,scope_id,commission_id,beneficiary_member_id,origin_event_id,refund_id,kind,
    base_minor,amount_minor,journal_id
  ) values(
    'referral-movement:partial:'||suffix,test_scope,'referral-commission:settled:'||suffix,profile_b,
    'event:payment-refunded:'||suffix,'refund:referral-contract:'||suffix,'reversal',400,40,partial_journal
  );
  if not exists(
    select 1 from referral.commission
    where id='referral-commission:settled:'||suffix and state='settled'
      and reversed_base_minor=400 and reversed_minor=40 and reversal_event_id is null
  ) then raise exception 'REFERRAL_PARTIAL_REVERSAL_CONTRACT_FAILED'; end if;

  recovery_journal:=finance.post(
    test_scope,'referral.commission.recovery.accrued','referral-recovery-accrual:'||suffix,'CNY',
    'Referral contract recovery accrual','referral.commission.receivable.'||profile_b,'asset',
    'referral.commission.payable.'||profile_b,'liability',10,now()
  );
  insert into referral.recoverymovement(
    id,scope_id,beneficiary_member_id,kind,source_commission_id,settlement_commission_id,
    reversal_movement_id,recovery_id,origin_event_id,currency,amount_minor,journal_id,created_at
  ) values(
    'referral-recovery:accrual:'||suffix,test_scope,profile_b,'accrual',
    'referral-commission:settled:'||suffix,null,'referral-movement:partial:'||suffix,null,
    'event:payment-refunded:'||suffix,'CNY',10,recovery_journal,now()
  );
  future_journal:=finance.post(
    test_scope,'referral.commission.accrued','referral-future-accrual:'||suffix,'CNY',
    'Referral contract future accrual','referral.commission.expense','expense',
    'referral.commission.payable.'||profile_b,'liability',50,now()
  );
  insert into referral.commission(
    id,scope_id,order_id,order_line_id,sku_id,beneficiary_member_id,kind,currency,
    base_minor,rate_bps,amount_minor,state,origin_event_id,setting_version,product_version,
    settle_trigger,settle_delay_days,eligible_at,journal_id,settling_at,settled_at
  ) values(
    'referral-commission:future:'||suffix,test_scope,order_id,line_id,sku_id,profile_b,'commission','CNY',
    500,1000,50,'settled','event:order-placed:future:'||suffix,0,0,'on_paid',7,
    now()-interval '1 hour',future_journal,now()-interval '1 hour',now()
  );
  offset_journal:=finance.post(
    test_scope,'referral.commission.recovery.offset','referral-recovery-offset:'||suffix,'CNY',
    'Referral contract recovery offset','referral.commission.payable.'||profile_b,'liability',
    'referral.commission.receivable.'||profile_b,'asset',10,now()
  );
  insert into referral.recoverymovement(
    id,scope_id,beneficiary_member_id,kind,source_commission_id,settlement_commission_id,
    reversal_movement_id,recovery_id,origin_event_id,currency,amount_minor,journal_id,created_at
  ) values(
    'referral-recovery:offset:'||suffix,test_scope,profile_b,'offset',
    'referral-commission:settled:'||suffix,'referral-commission:future:'||suffix,null,
    'referral-recovery:accrual:'||suffix,'event:order-placed:future:'||suffix,'CNY',10,offset_journal,now()
  );
  if (select sum(case kind when 'accrual' then amount_minor else -amount_minor end)
      from referral.recoverymovement where scope_id=test_scope and source_commission_id='referral-commission:settled:'||suffix)<>0
  then raise exception 'REFERRAL_RECOVERY_OFFSET_BALANCE_FAILED'; end if;
  begin
    update referral.recoverymovement set amount_minor=9 where id='referral-recovery:offset:'||suffix;
    raise exception 'REFERRAL_RECOVERY_MOVEMENT_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_RECOVERY_MOVEMENT_IMMUTABLE%' then raise; end if;
  end;
  begin
    insert into referral.withdrawalclaim(
      id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
    ) values(
      'referral-claim:offset-excess:'||suffix,test_scope,profile_b,
      'referral-commission:future:'||suffix,41,'reserved'
    );
    raise exception 'REFERRAL_RECOVERY_OFFSET_OVERCLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAWAL_CLAIM_AMOUNT_EXCEEDS_AVAILABLE%' then raise; end if;
  end;

  begin
    update referral.commissionmovement set amount_minor=39
    where id='referral-movement:partial:'||suffix;
    raise exception 'REFERRAL_MOVEMENT_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_COMMISSION_MOVEMENT_IMMUTABLE%' then raise; end if;
  end;

  insert into referral.withdrawalclaim(
    id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
  ) values(
    'referral-claim:first:'||suffix,test_scope,profile_b,'referral-commission:settled:'||suffix,20,'reserved'
  );
  insert into referral.withdrawalclaim(
    id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
  ) values(
    'referral-claim:second:'||suffix,test_scope,profile_b,'referral-commission:settled:'||suffix,40,'reserved'
  );
  begin
    insert into referral.withdrawalclaim(
      id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
    ) values(
      'referral-claim:excess:'||suffix,test_scope,profile_b,'referral-commission:settled:'||suffix,1,'reserved'
    );
    raise exception 'REFERRAL_COMMISSION_OVERCLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAWAL_CLAIM_AMOUNT_EXCEEDS_AVAILABLE%' then raise; end if;
  end;
  insert into referral.withdrawalclaim(
    id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
  ) values(
    'referral-claim:guard:'||suffix,test_scope,profile_b,'referral-commission:future:'||suffix,1,'reserved'
  );
  insert into referral.withdrawalclaim(
    id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
  ) values(
    'referral-claim:uncertain:'||suffix,test_scope,profile_b,'referral-commission:future:'||suffix,1,'reserved'
  );
  insert into finance.withdrawal(
    id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,requested_by,reason,evidence,
    created_at,updated_at,source_kind,source_id,beneficiary_member_id
  ) values(
    'withdrawal:referral-contract:'||suffix,test_scope,null,20,'CNY','destination:referral-contract',
    'submitted',profile_b,'referral contract','{}',now(),now(),'referral',
    referral_b,profile_b
  );
  perform set_config('app.scope_id',test_scope,true);
  perform * from referral.attach_withdrawal_claims(
    test_scope,'withdrawal:referral-contract:'||suffix,array['referral-claim:first:'||suffix]
  );
  update finance.withdrawal set state='rejected',updated_at=now(),version=version+1
  where id='withdrawal:referral-contract:'||suffix;
  if not exists(select 1 from referral.withdrawalclaim
    where id='referral-claim:first:'||suffix and state='rejected')
  then raise exception 'REFERRAL_WITHDRAWAL_CLAIM_STATE_NOT_SYNCED'; end if;
  begin
    update finance.withdrawal set state='submitted',approved_by=null,
      updated_at=now(),version=version+1 where id='withdrawal:referral-contract:'||suffix;
    raise exception 'REFERRAL_TERMINAL_WITHDRAWAL_REOPENED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID%' then raise; end if;
  end;
  insert into referral.withdrawalclaim(
    id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
  ) values(
    'referral-claim:released-capacity:'||suffix,test_scope,profile_b,
    'referral-commission:settled:'||suffix,20,'reserved'
  );
  begin
    insert into referral.withdrawalclaim(
      id,scope_id,beneficiary_member_id,commission_id,amount_minor,state
    ) values(
      'referral-claim:wrong-member:'||suffix,test_scope,profile_a,'referral-commission:settled:'||suffix,1,'reserved'
    );
    raise exception 'REFERRAL_CROSS_BENEFICIARY_CLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_COMMISSION_NOT_FOUND%' then raise; end if;
  end;

  insert into finance.withdrawal(
    id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,requested_by,reason,evidence,
    created_at,updated_at,source_kind,source_id,beneficiary_member_id
  ) values(
    'withdrawal:referral-guard:'||suffix,test_scope,null,1,'CNY','destination:referral-guard',
    'submitted',profile_b,'referral reversal guard','{}',now(),now(),'referral',referral_b,profile_b
  );
  perform * from referral.attach_withdrawal_claims(
    test_scope,'withdrawal:referral-guard:'||suffix,array['referral-claim:guard:'||suffix]
  );
  insert into finance.withdrawal(
    id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,requested_by,reason,evidence,
    created_at,updated_at,source_kind,source_id,beneficiary_member_id
  ) values(
    'withdrawal:referral-uncertain:'||suffix,test_scope,null,1,'CNY','destination:referral-uncertain',
    'submitted',profile_b,'referral uncertain resolution','{}',now(),now(),'referral',referral_b,profile_b
  );
  perform * from referral.attach_withdrawal_claims(
    test_scope,'withdrawal:referral-uncertain:'||suffix,array['referral-claim:uncertain:'||suffix]
  );
  update finance.withdrawal set state='approved',approved_by='contract-finance-reviewer',
    updated_at=now(),version=version+1 where id='withdrawal:referral-uncertain:'||suffix;
  update finance.withdrawal set state='processing',updated_at=now(),version=version+1
    where id='withdrawal:referral-uncertain:'||suffix;
  update finance.withdrawal set state='uncertain',updated_at=now(),version=version+1
    where id='withdrawal:referral-uncertain:'||suffix;
  insert into finance.withdrawal(
    id,scope_id,settlement_id,amount_minor,currency,destination_ref,state,requested_by,reason,evidence,
    created_at,updated_at,source_kind,source_id,beneficiary_member_id
  ) values(
    'withdrawal:referral-orphan:'||suffix,test_scope,null,1,'CNY','destination:referral-orphan',
    'submitted',profile_b,'referral orphan guard','{}',now(),now(),'referral',referral_b,profile_b
  );
  begin
    update finance.withdrawal set state='approved',approved_by='contract-finance-reviewer',
      updated_at=now(),version=version+1 where id='withdrawal:referral-orphan:'||suffix;
    raise exception 'REFERRAL_WITHDRAWAL_WITHOUT_CLAIMS_APPROVED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH%' then raise; end if;
  end;
  insert into runtime.outbox(
    id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at
  ) values(
    'event:referral-guard:'||suffix,'payment.refunded',1,'refund','refund:referral-guard:'||suffix,
    test_scope,jsonb_build_object('order',order_id,'refund','refund:referral-guard:'||suffix),
    'trace:referral-guard:'||suffix,now(),now()
  );
  update finance.withdrawal set state='processing',updated_at=now(),version=version+1
    where id='withdrawal:referral-uncertain:'||suffix;
  if not exists(select 1 from referral.withdrawalclaim
    where id='referral-claim:uncertain:'||suffix and state='processing')
  then raise exception 'REFERRAL_UNCERTAIN_REVERSAL_RESOLUTION_BLOCKED'; end if;
  update finance.withdrawal set state='failed',updated_at=now(),version=version+1
    where id='withdrawal:referral-uncertain:'||suffix;
  begin
    update finance.withdrawal set state='approved',updated_at=now(),version=version+1
      where id='withdrawal:referral-uncertain:'||suffix;
    raise exception 'REFERRAL_FAILED_PAYOUT_RETRIED_DURING_REVERSAL';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAW_REVERSAL_PENDING%' then raise; end if;
  end;
  begin
    update finance.withdrawal set state='approved',approved_by='contract-finance-reviewer',
      updated_at=now(),version=version+1 where id='withdrawal:referral-guard:'||suffix;
    raise exception 'REFERRAL_OUTBOX_RELAY_GAP_PAYOUT_ADVANCED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAW_REVERSAL_PENDING%' then raise; end if;
  end;
  insert into runtime.inbox(
    consumer,event_id,event_type,event_version,trace_id,payload,received_at
  ) values(
    'job:referral','event:referral-guard:'||suffix,'payment.refunded',1,'trace:referral-guard:'||suffix,
    jsonb_build_object('order',order_id,'refund','refund:referral-guard:'||suffix),now()
  );
  begin
    update finance.withdrawal set state='approved',approved_by='contract-finance-reviewer',
      updated_at=now(),version=version+1 where id='withdrawal:referral-guard:'||suffix;
    raise exception 'REFERRAL_PENDING_REVERSAL_PAYOUT_ADVANCED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAW_REVERSAL_PENDING%' then raise; end if;
  end;

  begin
    update referral.withdrawalclaim set amount_minor=2 where id='referral-claim:guard:'||suffix;
    raise exception 'REFERRAL_WITHDRAWAL_CLAIM_IDENTITY_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAWAL_CLAIM_IDENTITY_IMMUTABLE%' then raise; end if;
  end;

  begin
    update referral.withdrawalclaim set state='cancelled',withdrawal_id=null,
      updated_at=now(),version=version+1 where id='referral-claim:guard:'||suffix;
    raise exception 'REFERRAL_WITHDRAWAL_CLAIM_RELEASE_ALLOWED';
  exception when others then
    if sqlerrm not like '%REFERRAL_WITHDRAWAL_CLAIM_IDENTITY_IMMUTABLE%'
      and sqlerrm not like '%REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH%'
    then raise; end if;
  end;

  if (select count(*) from pg_policies where schemaname='referral')<>16
    or not exists(
      select 1 from pg_policies where schemaname='referral' and tablename='commission'
        and policyname='appscope' and qual like '%scope_allowed%'
    )
    or not exists(
      select 1 from pg_policies where schemaname='referral' and tablename='commission'
        and policyname='jobscope' and qual='true'
    )
  then raise exception 'REFERRAL_RLS_CONTRACT_FAILED'; end if;
  if has_table_privilege('shopapp','referral.commission','INSERT')
    or has_table_privilege('shopapp','referral.commission','UPDATE')
    or has_table_privilege('shopapp','referral.commission','DELETE')
    or has_table_privilege('shopapp','referral.recoverymovement','INSERT')
    or has_table_privilege('shopapp','referral.withdrawalclaim','UPDATE')
    or has_table_privilege('shopjob','referral.withdrawalclaim','INSERT')
    or has_table_privilege('shopjob','referral.withdrawalclaim','UPDATE')
  then raise exception 'REFERRAL_APP_MONETARY_MUTATION_PRIVILEGE_OPEN'; end if;
end;
$contract$;

rollback;
