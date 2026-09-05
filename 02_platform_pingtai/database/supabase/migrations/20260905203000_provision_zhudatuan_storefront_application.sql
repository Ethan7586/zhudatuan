begin;

insert into experience.application(
  id,scope_id,code,public_slug,name,status,head_version_id,created_at,updated_at,version
)
values(
  'application:mall-zhudatuan','mall-zhudatuan','ZHUDATUAN_STOREFRONT',
  'zhudatuan-storefront','主打团福利商城','active',null,
  clock_timestamp(),clock_timestamp(),1
);

with payload(configuration) as (
  values (
    jsonb_build_object(
      'version',2,
      'application','application:mall-zhudatuan',
      'pages',jsonb_build_array(jsonb_build_object(
        'id','application:mall-zhudatuan:home',
        'path','home',
        'blocks',jsonb_build_array(jsonb_build_object(
          'id','application:mall-zhudatuan:home:identity',
          'component','richtext',
          'content',jsonb_build_object('mallDisplayName','主打团福利商城')
        ))
      ))
    )
  )
)
insert into experience.version(
  id,application_id,sequence,schema_version,configuration,configuration_hash,
  validation_state,reason,created_by,created_at
)
select
  'version:mall-zhudatuan:1','application:mall-zhudatuan',1,'2',configuration,
  encode(public.digest(convert_to(configuration::text,'UTF8'),'sha256'),'hex'),
  'valid','zhudatuan canonical storefront baseline','shopmigration',clock_timestamp()
from payload;

update experience.application
set head_version_id='version:mall-zhudatuan:1',updated_at=clock_timestamp()
where id='application:mall-zhudatuan';

insert into experience.binding(application_id,domain,mall_id,pool_id)
values(
  'application:mall-zhudatuan','zhudatuan-storefront',
  'mall-zhudatuan','pool:mall-zhudatuan'
);

insert into experience.release(
  id,application_id,version_id,state,effective_at,retired_at,published_by
)
values(
  'release:mall-zhudatuan:1','application:mall-zhudatuan',
  'version:mall-zhudatuan:1','active',clock_timestamp(),null,'shopmigration'
);

commit;
