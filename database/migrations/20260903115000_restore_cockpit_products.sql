begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260903114000') then
    raise exception 'COCKPIT_PRODUCTS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260903115000') then
    raise exception 'COCKPIT_PRODUCTS_ALREADY_APPLIED';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0'
    and checksum='9fe623baf3766a8165fae54ff209324619f9fd39a17dfdbfdb927665deb9b42d'
    and operation_count=276 and event_count=103 and status='active') then
    raise exception 'COCKPIT_PRODUCTS_CONTRACT_INVALID';
  end if;
end
$precondition$;

create function reporting.cockpitproducts(p_scope text,p_period text,p_application text) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,reporting,organization
as $function$
  with settings as(
    select coalesce((select timezone from organization.organization where id=p_scope),'Asia/Shanghai') timezone,
      clock_timestamp() now_at
  ), bounds as(
    select timezone,
      case p_period
        when 'yesterday' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '1 day'
        when '7days' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '6 days'
        when '30days' then date_trunc('day',now_at at time zone timezone) at time zone timezone-interval '29 days'
        else date_trunc('day',now_at at time zone timezone) at time zone timezone
      end from_at,
      case when p_period='yesterday'
        then date_trunc('day',now_at at time zone timezone) at time zone timezone
        else now_at end to_at
    from settings where p_period in('realtime','yesterday','7days','30days')
  ), lines as(
    select projection.order_id,line.value
    from reporting.orderprojection projection
    cross join bounds
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(projection.snapshot->'lines')='array' then projection.snapshot->'lines' else '[]'::jsonb end
    ) line
    where projection.scope_id=p_scope
      and projection.payment_state='paid'
      and projection.watermark>=bounds.from_at
      and projection.watermark<bounds.to_at
      and (p_application is null or projection.snapshot->>'application'=p_application)
      and line.value->>'product' is not null
      and line.value->>'product'<>''
      and line.value->>'payableMinor'~'^[0-9]+$'
      and line.value->>'quantity'~'^[0-9]+$'
  ), ranked as(
    select value->>'product' product_id,
      coalesce(nullif(value->>'title',''),value->>'product') product_name,
      sum((value->>'payableMinor')::bigint)::float8 sales_cents,
      sum((value->>'quantity')::integer)::integer quantity,
      count(distinct order_id)::integer order_count
    from lines
    group by value->>'product',coalesce(nullif(value->>'title',''),value->>'product')
    order by sales_cents desc,quantity desc,product_id
    limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId',product_id,
    'name',product_name,
    'salesCents',sales_cents,
    'quantity',quantity,
    'orderCount',order_count
  ) order by sales_cents desc,quantity desc,product_id),'[]'::jsonb)
  from ranked
$function$;

revoke all on function reporting.cockpitproducts(text,text,text) from public;
grant execute on function reporting.cockpitproducts(text,text,text) to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260903115000',0,0,0,0,
  'select reporting.cockpitproducts(''organization-platform-root'',''30days'',null);',
  'select order_id,scope_id,watermark,snapshot->''lines'' from reporting.orderprojection where payment_state=''paid'' order by watermark desc limit 20;'
);

insert into runtime.schemaversion(version,checksum)
values('20260903115000','0caf9723bfb821327d83638868ffba0fb19b1ad9fc449e32aa2f7ee7f78dc48e');

do $assert$
begin
  if to_regprocedure('reporting.cockpitproducts(text,text,text)') is null then
    raise exception 'COCKPIT_PRODUCTS_FUNCTION_MISSING';
  end if;
  if not has_function_privilege('shopapp','reporting.cockpitproducts(text,text,text)','EXECUTE')
    or not has_function_privilege('shopjob','reporting.cockpitproducts(text,text,text)','EXECUTE') then
    raise exception 'COCKPIT_PRODUCTS_GRANT_INVALID';
  end if;
  if jsonb_typeof(reporting.cockpitproducts('organization-platform-root','30days',null))<>'array' then
    raise exception 'COCKPIT_PRODUCTS_RESULT_INVALID';
  end if;
end
$assert$;

commit;
