begin;

do $contract$
declare suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  mall_a text:='mall:fulfillment-a:'||suffix;
  mall_b text:='mall:fulfillment-b:'||suffix;
  fulfillment_a text:='fulfillment:a:'||suffix;
  fulfillment_b text:='fulfillment:b:'||suffix;
  shared_reference text:='external:shared:'||suffix;
  source_effect text:='effect:shared:'||suffix;
  suborder text:='suborder:shared:'||suffix;
  resolved text;
begin
  insert into fulfillment.fulfillmentorder(id,mall_id,member_id,provider_scope_id,order_id,suborder_id,provider,kind,state,
    external_reference,source_effect_id,created_at,updated_at,version)
  values
    (fulfillment_a,mall_a,'member:a','provider-scope:a','missing-order:a:'||suffix,suborder,'shared','shipment','accepted',
      shared_reference,source_effect,clock_timestamp(),clock_timestamp(),0),
    (fulfillment_b,mall_b,'member:b','provider-scope:b','missing-order:b:'||suffix,suborder,'shared','shipment','accepted',
      shared_reference,source_effect,clock_timestamp(),clock_timestamp(),0);

  insert into fulfillment.line(mall_id,fulfillment_id,order_line_id,quantity)
  values(mall_a,fulfillment_a,'missing-line:'||suffix,1),(mall_b,fulfillment_b,'missing-line:'||suffix,1);
  insert into fulfillment.milestone(id,mall_id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
  values('milestone:a:'||suffix,mall_a,fulfillment_a,'tracking','intransit','tracking:shared:'||suffix,'{}',clock_timestamp()),
    ('milestone:b:'||suffix,mall_b,fulfillment_b,'tracking','intransit','tracking:shared:'||suffix,'{}',clock_timestamp());
  insert into fulfillment.returnrecord(id,mall_id,aftersale_id,fulfillment_id,state,version)
  values('return:a:'||suffix,mall_a,'missing-aftersale:a:'||suffix,fulfillment_a,'authorized',0),
    ('return:b:'||suffix,mall_b,'missing-aftersale:b:'||suffix,fulfillment_b,'authorized',0);

  select access.resource_scope('fulfillment.shipments.create',fulfillment_a,'missing-membership') into resolved;
  if resolved<>mall_a then raise exception 'FULFILLMENT_MALL_SCOPE_MISMATCH:%',resolved; end if;
  select access.resource_scope('fulfillment.returns.receive','return:b:'||suffix,'missing-membership') into resolved;
  if resolved<>mall_b then raise exception 'FULFILLMENT_RETURN_SCOPE_MISMATCH:%',resolved; end if;

  begin
    insert into fulfillment.line(mall_id,fulfillment_id,order_line_id,quantity)
    values(mall_b,fulfillment_a,'mismatched-line:'||suffix,1);
    raise exception 'FULFILLMENT_MALL_COMPOSITE_FK_NOT_ENFORCED';
  exception when foreign_key_violation then null;
  end;

  if exists(select 1 from ordering.orderrecord where id in('missing-order:a:'||suffix,'missing-order:b:'||suffix))
  then raise exception 'FULFILLMENT_MALL_CONTRACT_ACCIDENTALLY_CREATED_ORDER'; end if;
  if (select count(*) from fulfillment.fulfillmentorder where external_reference=shared_reference and provider='shared')<2
  then raise exception 'FULFILLMENT_MALL_PROVIDER_REFERENCE_NOT_SCOPED'; end if;
end $contract$;

rollback;
