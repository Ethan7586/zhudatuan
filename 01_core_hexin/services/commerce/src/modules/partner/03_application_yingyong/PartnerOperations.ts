import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

const STORE_STATES = new Set(['pending', 'active', 'suspended', 'terminated']);

export function partnerOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const kms = context.container.get(KMS_CLIENT);
  return new ModuleOperations('partner', pool, context.container.get(AUDIT_SINK), {
    'partner.partners.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select id,scope_id,kind,name,status,version,created_at,updated_at from partner.partner
        where (scope_id=$1 or id=$1) and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
        order by updated_at desc,id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
    'partner.partners.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(`insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set name=excluded.name,status=excluded.status,
        version=partner.partner.version+1,updated_at=clock_timestamp() where partner.partner.scope_id=$2
        and ($6::bigint is null or partner.partner.version=$6) returning *`, [request.input.path.partnerid!, access.scope.id,
        textField(body, 'kind'), textField(body, 'name'), body.status === 'suspended' ? 'suspended' : 'active', request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
    'organization.stores.read': async (request, database) => {
      requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select partner.id,partner.scope_id as scope,partner.name,partner.status,partner.version,
        store.mall_id as mall,store.region_code as "regionCode",store.service_radius_meters as "serviceRadiusMeters",
        store.address_ciphertext is not null as "addressConfigured",partner.created_at as "createdAt",partner.updated_at as "updatedAt"
        from partner.partner partner join partner.store store on store.id=partner.id where partner.kind='store'
        and access.scope_allowed(partner.scope_id) and ($1::timestamptz is null or (partner.updated_at,partner.id)<($1::timestamptz,$2))
        order by partner.updated_at desc,partner.id desc limit $3`, [page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updatedAt');
    },
    'organization.stores.manage': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const id = request.input.path.storeid!;
        const name = textField(body, 'name', 160);
        const status = textField(body, 'status', 16);
        const region = textField(body, 'regionCode', 32);
        if (!STORE_STATES.has(status) || !/^[A-Za-z0-9.-]{2,32}$/.test(region)) throw new Error('VALIDATION_FAILED');
        const mall = body.mall === undefined || body.mall === null ? null : textField(body, 'mall');
        const radius = body.serviceRadiusMeters === undefined || body.serviceRadiusMeters === null ? null : integerField(body, 'serviceRadiusMeters', 1);
        if (radius !== null && radius > 1_000_000) throw new Error('VALIDATION_FAILED');
        const address = body.address === undefined || body.address === null ? null : textField(body, 'address', 1000);
        const envelope = address === null ? null : await kms.encrypt('partner/store/address', address, { store:id, scope:access.scope.id });
        return { access, id, name, status, region, mall, radius, envelope };
      },
      execute: async (request, database, prepared) => {
        const current = await database.query<{ scope_id: string }>(`select scope_id from partner.partner
          where id=$1 and kind='store' and access.scope_allowed(scope_id)`, [prepared.id]);
        if (prepared.mall !== null) {
          const mall = await database.query(`select id from organization.organization where id=$1 and kind='mall' and access.scope_allowed(id)`, [prepared.mall]);
          if (!mall.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
        }
        const scope = prepared.mall ?? current.rows[0]?.scope_id ?? prepared.access.scope.id;
        const partner = await database.query(`insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
          values($1,$2,'store',$3,$4,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set scope_id=excluded.scope_id,
          name=excluded.name,status=excluded.status,version=partner.partner.version+1,updated_at=clock_timestamp()
          where partner.partner.kind='store' and access.scope_allowed(partner.partner.scope_id)
            and ($5::bigint is null or partner.partner.version=$5) returning id,version`,
        [prepared.id, scope, prepared.name, prepared.status, request.input.expectedVersion ?? null]);
        if (!partner.rows[0]) throw new Error('VERSION_CONFLICT');
        await database.query(`insert into partner.store(id,mall_id,region_code,address_ciphertext,address_token,address_key_version,service_radius_meters)
          values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,
          address_ciphertext=excluded.address_ciphertext,address_token=excluded.address_token,address_key_version=excluded.address_key_version,
          service_radius_meters=excluded.service_radius_meters`, [prepared.id, prepared.mall, prepared.region,
          prepared.envelope?.ciphertext ?? null, prepared.envelope?.fingerprint ?? null, prepared.envelope?.keyVersion ?? null, prepared.radius]);
        return rowResult(await database.query(`select partner.id,partner.scope_id as scope,partner.name,partner.status,partner.version,
          store.mall_id as mall,store.region_code as "regionCode",store.service_radius_meters as "serviceRadiusMeters",
          store.address_ciphertext is not null as "addressConfigured" from partner.partner partner
          join partner.store store on store.id=partner.id where partner.id=$1`, [prepared.id]));
      },
    }),
  });
}
