import {
  StorefrontMemberCustomFieldSchema,
  StorefrontMemberCustomProfileSchema,
  StorefrontMemberCustomProfileUpdateSchema,
  StorefrontMemberProfileConfigSchema,
  type OperationId,
  type StorefrontMemberCustomProfileUpdate,
  type StorefrontMemberProfileConfig,
} from '@shop/contract';
import { validateMemberCustomFieldValue, validateMemberProfileConfig } from '@shop/l-kernel/member-profile';
import { requireAccess, type OperationActions, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../foundation/interface/Validation';

export const MEMBER_STOREFRONT_CUSTOM_PROFILE_OPERATION_IDS = Object.freeze([
  'member.storefront.config.read',
  'member.storefront.config.manage',
  'member.storefront.custom.read',
  'member.storefront.custom.manage',
] as const satisfies readonly OperationId[]);

export function memberCustomProfileActions(): OperationActions {
  return {
    'member.storefront.config.read': async (request, database) => ({ status: 200, body: await readConfig(database, mallScope(request)) }),
    'member.storefront.config.manage': async (request, database) => {
      const scope = mallScope(request);
      const config = StorefrontMemberProfileConfigSchema.parse(bodyRecord(request));
      validateMemberProfileConfig(config);
      await saveConfig(database, scope, config);
      return { status: 200, body: await readConfig(database, scope) };
    },
    'member.storefront.custom.read': async (request, database) => ({ status: 200, body: await readProfile(database, mallScope(request), request.input.path.membershipid!) }),
    'member.storefront.custom.manage': async (request, database) => {
      const scope = mallScope(request);
      const membership = request.input.path.membershipid!;
      const update = StorefrontMemberCustomProfileUpdateSchema.parse(bodyRecord(request));
      await saveProfile(database, scope, membership, update);
      return { status: 200, body: await readProfile(database, scope, membership) };
    },
  };
}

function mallScope(request: OperationRequest): string {
  const access = requireAccess(request);
  if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
  return access.scope.id;
}

async function readConfig(database: OperationDatabase, scope: string): Promise<StorefrontMemberProfileConfig> {
  const [tags, fields] = await Promise.all([
    database.query('select id,name,color,sort_order,enabled from member.storefrontcustomtag where organization_id=$1 order by sort_order,id', [scope]),
    database.query('select id,name,field_type type,options,sort_order,enabled from member.storefrontcustomfield where organization_id=$1 order by sort_order,id', [scope]),
  ]);
  return StorefrontMemberProfileConfigSchema.parse({ tags: tags.rows, fields: fields.rows });
}

async function saveConfig(database: OperationDatabase, scope: string, config: StorefrontMemberProfileConfig): Promise<void> {
  for (const tag of config.tags)
    await database.query(
      `insert into member.storefrontcustomtag(organization_id,id,name,color,sort_order,enabled,updated_at)
    values($1,$2,$3,$4,$5,$6,clock_timestamp()) on conflict(organization_id,id) do update set name=excluded.name,color=excluded.color,
    sort_order=excluded.sort_order,enabled=excluded.enabled,updated_at=excluded.updated_at`,
      [scope, tag.id, tag.name.trim(), tag.color, tag.sort_order, tag.enabled]
    );
  await database.query('delete from member.storefrontcustomtag where organization_id=$1 and not(id=any($2::text[]))', [scope, config.tags.map(({ id }) => id)]);
  for (const field of config.fields)
    await database.query(
      `insert into member.storefrontcustomfield(organization_id,id,name,field_type,options,sort_order,enabled,updated_at)
    values($1,$2,$3,$4,$5::jsonb,$6,$7,clock_timestamp()) on conflict(organization_id,id) do update set name=excluded.name,field_type=excluded.field_type,
    options=excluded.options,sort_order=excluded.sort_order,enabled=excluded.enabled,updated_at=excluded.updated_at`,
      [scope, field.id, field.name.trim(), field.type, JSON.stringify(field.options), field.sort_order, field.enabled]
    );
  await database.query('delete from member.storefrontcustomfield where organization_id=$1 and not(id=any($2::text[]))', [scope, config.fields.map(({ id }) => id)]);
}

async function readProfile(database: OperationDatabase, scope: string, membership: string) {
  const target = await database.query("select id from access.membership where organization_id=$1 and id=$2 and client='storefront'", [scope, membership]);
  if (!target.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
  const [systemTags, customTags, fieldValues] = await Promise.all([
    database.query(
      `select tag.code,tag.name from access.membership membership join member.profile profile on profile.id=membership.member_id
      cross join lateral(values ('active_member','有效会员',membership.status='active'),('mobile_bound','手机已绑定',profile.mobile_token is not null),
      ('wechat_bound','微信已绑定',exists(select 1 from identity.federatedidentity identity where identity.membership_id=membership.id and identity.provider='wechat' and identity.status='active')),
      ('purchased','已消费',exists(select 1 from ordering.orderrecord orders where orders.mall_id=membership.organization_id and orders.member_id=membership.member_id)),
      ('referrer','邀请达人',exists(select 1 from referral.member owner join referral.binding binding on binding.scope_id=owner.scope_id and binding.referral_member_id=owner.id
        where owner.scope_id=membership.organization_id and owner.member_id=membership.member_id))) tag(code,name,applies)
      where membership.organization_id=$1 and membership.id=$2 and membership.client='storefront' and tag.applies order by tag.code`,
      [scope, membership]
    ),
    database.query(
      `select assignment.tag_id from member.storefrontmembertag assignment join member.storefrontcustomtag definition
      on definition.organization_id=assignment.organization_id and definition.id=assignment.tag_id and definition.enabled
      where assignment.organization_id=$1 and assignment.membership_id=$2 order by definition.sort_order,definition.id`,
      [scope, membership]
    ),
    database.query(
      `select stored.field_id,stored.value from member.storefrontmemberfieldvalue stored join member.storefrontcustomfield definition
      on definition.organization_id=stored.organization_id and definition.id=stored.field_id and definition.enabled
      where stored.organization_id=$1 and stored.membership_id=$2 order by definition.sort_order,definition.id`,
      [scope, membership]
    ),
  ]);
  return StorefrontMemberCustomProfileSchema.parse({ system_tags: systemTags.rows, custom_tag_ids: customTags.rows.map((row) => row.tag_id), custom_field_values: fieldValues.rows });
}

async function saveProfile(database: OperationDatabase, scope: string, membership: string, update: StorefrontMemberCustomProfileUpdate): Promise<void> {
  const target = await database.query("select id from access.membership where organization_id=$1 and id=$2 and client='storefront'", [scope, membership]);
  if (!target.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
  const definitions = await database.query('select id,name,field_type type,options,sort_order,enabled from member.storefrontcustomfield where organization_id=$1 and enabled', [scope]);
  const fields = new Map(definitions.rows.map((row) => StorefrontMemberCustomFieldSchema.parse(row)).map((field) => [field.id, field]));
  for (const item of update.custom_field_values) validateMemberCustomFieldValue(fields.get(item.field_id), item.value);
  await database.query('delete from member.storefrontmembertag where organization_id=$1 and membership_id=$2', [scope, membership]);
  for (const tag of update.custom_tag_ids) {
    const result = await database.query(
      `insert into member.storefrontmembertag(organization_id,membership_id,tag_id)
      select $1,$2,id from member.storefrontcustomtag where organization_id=$1 and id=$3 and enabled returning tag_id`,
      [scope, membership, tag]
    );
    if (!result.rows[0]) throw new Error('CUSTOM_PROFILE_CONFIGURATION_STALE');
  }
  await database.query('delete from member.storefrontmemberfieldvalue where organization_id=$1 and membership_id=$2', [scope, membership]);
  for (const item of update.custom_field_values)
    await database.query(
      `insert into member.storefrontmemberfieldvalue(organization_id,membership_id,field_id,value,updated_at)
    values($1,$2,$3,$4::jsonb,clock_timestamp())`,
      [scope, membership, item.field_id, JSON.stringify(item.value)]
    );
}
