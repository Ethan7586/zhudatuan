import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, pageResult, requireAccess } from '../../foundation/application/ModuleOperations';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { WEB_PRICING_OPERATION_IDS } from './WebBusinessOperationIds';

export function webPricingOperations(context: ModuleContext): ModuleOperations {
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
  }, WEB_PRICING_OPERATION_IDS);
}

function queryValues(value: string | readonly string[] | undefined, maximum: number): readonly string[] {
  const values = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item) => item.trim()).filter(Boolean);
  if (values.length > maximum || values.some((item) => item.length > 255)) throw new Error('VALIDATION_FAILED:sku');
  return Object.freeze([...new Set(values)]);
}
