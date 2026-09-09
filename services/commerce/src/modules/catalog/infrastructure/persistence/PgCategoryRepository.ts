import { createHash } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CategoryRecord, CategoryRepository } from '../../application/port/CategoryRepository';
import { Category } from '../../domain/model/Category';

export class PgCategoryRepository implements CategoryRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async read(context: ReadTransactionContext, query: string, page: Parameters<CategoryRepository['read']>[2]) {
    const result = await this.transactions.database(context).query<CategoryRecord>(
      `select category.id,category.parent_id,parent.name parent_name,category.code,category.name,category.status,
        category.sort_order,count(product.id)::integer product_count
       from catalog.category category
       left join catalog.category parent on parent.id=category.parent_id
       left join catalog.product product on product.category_id=category.id and product.status<>'archived'
       where ($1='' or category.name ilike '%'||$1||'%')
         and ($2::text is null or (category.name,category.id)>($2,$3))
       group by category.id,parent.name
       order by category.name,category.id limit $4`,
      [query, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => record(row)));
  }

  async create(context: WriteTransactionContext, input: Parameters<CategoryRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const name = input.name.trim();
    const digest = createHash('sha256')
      .update(`${input.parent ?? 'root'}\u0000${name.toLocaleLowerCase('zh-CN')}`)
      .digest('hex')
      .slice(0, 24);
    const snapshot = Category.create({ id: `category:custom:${digest}`, parent: input.parent, code: `CUSTOM-${digest.toUpperCase()}`, name, sort: input.sort }).snapshot();
    if (snapshot.parent !== null) {
      const parent = await database.query<{ status: string }>('select status from catalog.category where id=$1', [snapshot.parent]);
      if (parent.rows[0]?.status !== 'active') throw new DomainError('VALIDATION_FAILED', { field: 'parent' });
    }
    const duplicate = await database.query<CategoryRecord>(
      `select category.id,category.parent_id,parent.name parent_name,category.code,category.name,category.status,
        category.sort_order,count(product.id)::integer product_count
       from catalog.category category left join catalog.category parent on parent.id=category.parent_id
       left join catalog.product product on product.category_id=category.id and product.status<>'archived'
       where lower(btrim(category.name))=lower(btrim($1))
         and category.parent_id is not distinct from $2
       group by category.id,parent.name order by category.id limit 1`,
      [snapshot.name, snapshot.parent]
    );
    if (duplicate.rows[0]) return record(duplicate.rows[0]);
    const inserted = await database.query<CategoryRecord>(
      `insert into catalog.category(id,parent_id,code,name,status,sort_order)
       values($1,$2,$3,$4,$5,$6)
       on conflict(id) do nothing
       returning id,parent_id,null::text parent_name,code,name,status,sort_order,0::integer product_count`,
      [snapshot.id, snapshot.parent, snapshot.code, snapshot.name, snapshot.state, snapshot.sort]
    );
    if (inserted.rows[0]) return record(inserted.rows[0]);
    const existing = await database.query<CategoryRecord>(
      `select category.id,category.parent_id,parent.name parent_name,category.code,category.name,category.status,
        category.sort_order,count(product.id)::integer product_count
       from catalog.category category left join catalog.category parent on parent.id=category.parent_id
       left join catalog.product product on product.category_id=category.id and product.status<>'archived'
       where category.id=$1 group by category.id,parent.name`,
      [snapshot.id]
    );
    if (!existing.rows[0] || existing.rows[0].name.trim().toLocaleLowerCase('zh-CN') !== snapshot.name.toLocaleLowerCase('zh-CN')) throw new DomainError('VALIDATION_FAILED', { field: 'name' });
    return record(existing.rows[0]);
  }
}

function record(value: CategoryRecord): CategoryRecord {
  return Object.freeze({ ...value, sort_order: Number(value.sort_order), product_count: Number(value.product_count) });
}
