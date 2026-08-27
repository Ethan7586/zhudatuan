begin;

create index benefit_account_member_kind on benefit.account(member_id,kind,id);
create index voucher_member_expiry on voucher.voucher(member_id,expires_at,id);
create index voucher_program_expiry on voucher.voucher(program_id,expires_at,id);
create index voucher_redemption_time on voucher.redemption(redeemed_at desc,id desc);
create index catalog_pool_scope_name on catalog.pool(scope_id,name,id);
create index catalog_source_scope_time on catalog.sourcelisting(scope_id,observed_at desc,id desc);
create index catalog_listing_scope_time on catalog.listing(scope_id,updated_at desc,id desc);
create index inventory_stock_scope_time on inventory.stockitem(scope_id,updated_at desc,id desc);
create index finance_journal_state_time on finance.journal(state,posted_at desc,id desc);
create index finance_statement_scope_period on finance.statement(scope_id,state,period_end desc,id desc);
create index invoice_profile_owner on invoice.profile(owner_id,id);
create index invoice_request_profile_time on invoice.request(profile_id,created_at desc,id desc);
create index partner_scope_time on partner.partner(scope_id,updated_at desc,id desc);
create index marketing_scope_time on marketing.campaign(scope_id,updated_at desc,id desc);
create index checkout_address_member on checkout.address(member_id,status,id);
create index experience_application_scope_time on experience.application(scope_id,updated_at desc,id desc);
create index extension_installation_scope_time on extension.installation(scope_id,installed_at desc,id desc);
create index notification_dispatch_recipient_time on notification.dispatch(recipient_ref,created_at desc,id desc);
create index verification_session_subject_time on verification.session(subject_id,expires_at desc,id desc);
create index verification_attempt_session_time on verification.attempt(session_id,attempted_at desc,id desc);
create index verification_device_scope_label on verification.device(scope_id,label,id);
create index qualification_policy_scope_time on qualification.policy(scope_id,updated_at desc,id desc);
create index capability_entitlement_scope on capability.entitlement(scope_id,capability_id,id);
create index risk_policy_scope_id on risk.policy(scope_id,id);
create index ordering_scope_time on ordering.orderrecord(scope_id,created_at desc,id desc);
create index ordering_member_time on ordering.orderrecord(member_id,created_at desc,id desc);
create index ordering_aftersale_time on ordering.aftersale(created_at desc,id desc);
create index reporting_fact_scope_time on reporting.fact(scope_id,period_end desc,metric_id);
create index channel_distributor_time on channel.distributor(updated_at desc,id desc);
create index channel_syncrun_connection_time on channel.syncrun(connection_id,started_at desc,id desc);
create index channel_operation_scope_time on channel.provideroperation(scope_id,updated_at desc,id desc);
create index support_case_scope_time on support.case(scope_id,updated_at desc,id desc);
create index support_case_member_time on support.case(member_id,updated_at desc,id desc);
create index support_message_case_time on support.message(case_id,created_at,id);
create index support_event_case_sequence on support.caseevent(case_id,sequence);

insert into runtime.schemaversion(version,checksum)
values('20260821038000','2a1ca1870b000ab5ea8848d92e2587e41ec80dff7c0b951258b49039bce414e5');

do $assert$
begin
  if to_regclass('catalog.catalog_listing_scope_time') is null then raise exception 'CATALOG_KEYSET_INDEX_MISSING'; end if;
  if to_regclass('ordering.ordering_member_time') is null then raise exception 'ORDER_KEYSET_INDEX_MISSING'; end if;
  if to_regclass('support.support_message_case_time') is null then raise exception 'SUPPORT_KEYSET_INDEX_MISSING'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821038000') then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
