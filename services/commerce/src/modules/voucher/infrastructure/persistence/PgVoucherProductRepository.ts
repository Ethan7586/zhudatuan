import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { VoucherProductRepository } from '../../application/port/VoucherProductRepository';
import type { ProductReference } from '../../application/port/ProductReference';
import { VoucherProduct } from '../../domain/model/VoucherProduct';
import { POOL_CAPACITY } from './PoolCapacity';
import { body, cursor, entity, expected, limit, number, one, optionalText, page, path, PRODUCT, PRODUCT_FIELDS, query, text } from './VoucherSupport';

export class PgVoucherProductRepository implements VoucherProductRepository {
  constructor(
    private readonly references: ProductReference,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async create(call: Parameters<VoucherProductRepository['create']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const value = configuration(body(call));
    await this.references.validate(call.context.transaction, call.scope, value.customer, value.qualification);
    const product = new VoucherProduct({ id: entity('voucherproduct'), scope: call.scope, state: 'draft', version: 1, ...value });
    const id = product.value.id;
    await database.query(
      `insert into voucher.product(id,number,scope_id,customer_id,name,face_minor,currency,qualification_id,pool_id,starts_at,expires_at,activation,approval_required,state,version,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',1,$14,$14)`,
      [id, number('VP'), call.scope, value.customer, value.name, value.faceMinor, value.currency, value.qualification, value.pool, value.startsAt, value.expiresAt, value.activation, value.approvalRequired, call.now]
    );
    return one<'voucher.products.create'>(201, (await database.query(`${PRODUCT} where product.id=$1 and product.scope_id=$2`, [id, call.scope])).rows[0]);
  }

  async revise(call: Parameters<VoucherProductRepository['revise']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'productid');
    const locked = await database.query<ProductRow>(`select ${PRODUCT_FIELDS} from voucher.product product where product.id=$1 and product.scope_id=$2 for update`, [id, call.scope]);
    const row = locked.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const revised = new VoucherProduct(model(row)).revise(configuration(body(call)));
    const value = revised.value;
    await this.references.validate(call.context.transaction, call.scope, value.customer, value.qualification);
    await database.query(
      `update voucher.product set customer_id=$3,name=$4,face_minor=$5,currency=$6,qualification_id=$7,pool_id=$8,
      starts_at=$9,expires_at=$10,activation=$11,approval_required=$12,state=$13,version=$14 where id=$1 and scope_id=$2`,
      [id, call.scope, value.customer, value.name, value.faceMinor, value.currency, value.qualification, value.pool, value.startsAt, value.expiresAt, value.activation, value.approvalRequired, value.state, value.version]
    );
    return one<'voucher.products.revise'>(200, (await database.query(`${PRODUCT} where product.id=$1 and product.scope_id=$2`, [id, call.scope])).rows[0]);
  }

  async enable(call: Parameters<VoucherProductRepository['enable']>[0]) {
    return this.state(call, 'enabled');
  }
  async disable(call: Parameters<VoucherProductRepository['disable']>[0]) {
    return this.state(call, 'disabled');
  }

  async get(call: Parameters<VoucherProductRepository['get']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'productid');
    const selected = await database.query(`${PRODUCT} where product.id=$1 and product.scope_id=$2`, [id, call.scope]);
    if (!selected.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    const versions = await database.query(`select version::integer,snapshot,changed_by as "changedBy",changed_at as "changedAt" from voucher.productversion where product_id=$1 and scope_id=$2 order by version desc`, [id, call.scope]);
    const supply = await database.query<{ available: number; allocated: number }>(
      `select count(*) filter(where state='available')::integer available,count(*) filter(where state='allocated')::integer allocated from voucher.credential where product_id=$1 and scope_id=$2`,
      [id, call.scope]
    );
    return one<'voucher.products.get'>(200, { ...selected.rows[0], versions: versions.rows, supply: supply.rows[0] ?? { available: 0, allocated: 0 } });
  }

  async list(call: Parameters<VoucherProductRepository['list']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const rows = await database.query(
      `${PRODUCT} where product.scope_id=$1 and ($2::text is null or product.state=$2) and ($3::text is null or product.customer_id=$3)
      and ($4::text is null or product.id>$4) order by product.id limit $5`,
      [call.scope, optionalText(filter.state), optionalText(filter.customer), cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.products.list'>(rows.rows, fetch);
  }

  async options(call: Parameters<VoucherProductRepository['options']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const rows = await database.query(
      `select product.id,product.number,product.name,product.face_minor::integer as "faceMinor",product.currency,
      capacity.available from voucher.product product
      join (${POOL_CAPACITY}) capacity on capacity.pool=product.pool_id and capacity.product=product.id and capacity.scope=product.scope_id
      where product.scope_id=$1 and product.state='enabled' and capacity.state='open' and capacity.available>0
      and ($2::text is null or product.id>$2) order by product.id limit $3`,
      [call.scope, cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.productoptions.list'>(rows.rows, fetch);
  }

  private async state(call: Parameters<VoucherProductRepository['enable']>[0] | Parameters<VoucherProductRepository['disable']>[0], target: 'enabled' | 'disabled') {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'productid');
    const locked = await database.query<ProductRow>(`select ${PRODUCT_FIELDS} from voucher.product product where product.id=$1 and product.scope_id=$2 for update`, [id, call.scope]);
    const row = locked.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    if (target === 'enabled') await this.references.validate(call.context.transaction, call.scope, row.customer_id, row.qualification_id);
    const aggregate = new VoucherProduct(model(row));
    const changed = target === 'enabled' ? aggregate.enable(call.now) : aggregate.disable();
    await database.query(`update voucher.product set state=$3,version=$4 where id=$1 and scope_id=$2`, [id, call.scope, changed.value.state, changed.value.version]);
    return one<typeof call extends Parameters<VoucherProductRepository['enable']>[0] ? 'voucher.products.enable' : 'voucher.products.disable'>(
      200,
      (await database.query(`${PRODUCT} where product.id=$1 and product.scope_id=$2`, [id, call.scope])).rows[0]
    );
  }
}

interface ProductRow {
  readonly id: string;
  readonly scope_id: string;
  readonly customer_id: string;
  readonly name: string;
  readonly face_minor: number;
  readonly currency: string;
  readonly qualification_id: string;
  readonly pool_id: string | null;
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly activation: 'automatic' | 'secret' | 'numbersecret';
  readonly approval_required: boolean;
  readonly state: 'draft' | 'enabled' | 'disabled' | 'retired';
  readonly version: number;
}
function model(row: ProductRow) {
  return {
    id: row.id,
    scope: row.scope_id,
    customer: row.customer_id,
    name: row.name,
    faceMinor: Number(row.face_minor),
    currency: row.currency,
    qualification: row.qualification_id,
    pool: row.pool_id,
    startsAt: new Date(row.starts_at),
    expiresAt: new Date(row.expires_at),
    activation: row.activation,
    approvalRequired: row.approval_required,
    state: row.state,
    version: Number(row.version),
  } as const;
}
function configuration(value: Readonly<Record<string, unknown>>) {
  const validity = value.validity && typeof value.validity === 'object' && !Array.isArray(value.validity) ? (value.validity as Readonly<Record<string, unknown>>) : {};
  const activation = value.activation;
  if (!['automatic', 'secret', 'numbersecret'].includes(String(activation))) throw new DomainError('VALIDATION_FAILED', { field: 'activation' });
  return {
    customer: text(value.customer, 'customer'),
    name: text(value.name, 'name'),
    faceMinor: Number(value.faceMinor),
    currency: text(value.currency, 'currency'),
    qualification: text(value.qualification, 'qualification'),
    pool: optionalText(value.pool),
    startsAt: new Date(text(validity.startsAt, 'validity.startsAt')),
    expiresAt: new Date(text(validity.expiresAt, 'validity.expiresAt')),
    activation: activation as 'automatic' | 'secret' | 'numbersecret',
    approvalRequired: value.approvalRequired === true,
  };
}
