import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { inventoryImportOperations } from './application/InventoryImportOperations';

export function inventoryOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('inventory', pool, context.container.get(AUDIT_SINK), {
    ...inventoryImportOperations(context),
    'inventory.availability.read': async (request, database) => {
      const access = requireAccess(request);
      const skus = queryValues(request.input.query.sku, 100);
      const page = queryPage(request);
      const result = await database.query(`select stock.id,stock.sku_id,stock.location_id,stock.onhand,stock.safety,
        stock.onhand-stock.safety-coalesce(sum(reservation.quantity) filter(where reservation.state='active' and reservation.expires_at>clock_timestamp()),0) available,
        stock.status,stock.version,stock.updated_at from inventory.stockitem stock left join inventory.reservation reservation on reservation.stockitem_id=stock.id
        where exists(select 1 from organization.unitclosure closure where closure.ancestor_id=$1 and closure.descendant_id=stock.scope_id)
        and ($2::text[] is null or stock.sku_id=any($2::text[]))
        and ($3::timestamptz is null or (stock.updated_at,stock.id)<($3::timestamptz,$4))
        group by stock.id order by stock.updated_at desc,stock.id desc limit $5`, [access.scope.id, skus.length === 0 ? null : skus, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
  });
}

function queryValues(value: string | readonly string[] | undefined, maximum: number): readonly string[] {
  const values = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item) => item.trim()).filter(Boolean);
  if (values.length > maximum || values.some((item) => item.length > 255)) throw new Error('VALIDATION_FAILED:sku');
  return Object.freeze([...new Set(values)]);
}
