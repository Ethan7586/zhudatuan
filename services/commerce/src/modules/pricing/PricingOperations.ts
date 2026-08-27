import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, pageResult, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function pricingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('pricing', pool, context.container.get(AUDIT_SINK), {
    'pricing.offers.read': async (request, database) => {
      const access = requireAccess(request);
      const skus = queryValues(request.input.query.sku, 100);
      return pageResult(await database.query(`select price.sku_id,price.amount_minor,price.compare_minor,book.currency,book.id book_id,
        price.effective_at,price.expires_at from pricing.pricebook book join lateral(
          select distinct on(candidate.sku_id) candidate.sku_id,candidate.amount_minor,candidate.compare_minor,candidate.effective_at,candidate.expires_at
          from pricing.price candidate where candidate.book_id=book.id and ($2::text[] is null or candidate.sku_id=any($2::text[]))
            and candidate.effective_at<=clock_timestamp() and (candidate.expires_at is null or candidate.expires_at>clock_timestamp())
          order by candidate.sku_id,candidate.effective_at desc
        ) price on true where book.scope_id=$1 and book.status='active'
        order by price.sku_id,price.effective_at desc limit 100`, [access.scope.id, skus.length === 0 ? null : skus]));
    },
    'pricing.rules.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(`insert into pricing.rule(id,scope_id,priority,kind,condition,effect,version,status)
        values($1,$2,$3,$4,$5::jsonb,$6::jsonb,1,'draft') returning *`, [`rule:${randomUUID()}`, access.scope.id,
        integerField(body, 'priority'), body.kind ?? 'markup', JSON.stringify(body.condition ?? {}), JSON.stringify(body.effect ?? {})]);
      return rowResult(result, 201);
    },
    'pricing.rules.publish': async (request, database) => {
      requireAccess(request);
      const result = await database.query(`update pricing.rule set status='published',effective_at=clock_timestamp()
        where id=$1 and status='draft' and ($2::integer is null or version=$2) returning *`, [request.input.path.ruleid!, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
  });
}

function queryValues(value: string | readonly string[] | undefined, maximum: number): readonly string[] {
  const values = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item) => item.trim()).filter(Boolean);
  if (values.length > maximum || values.some((item) => item.length > 255)) throw new Error('VALIDATION_FAILED:sku');
  return Object.freeze([...new Set(values)]);
}
