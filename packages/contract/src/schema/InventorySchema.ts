import { array, int, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { importCreated, importInput, importRead } from './ImportSchema';
import { isoUtc, pageQuery, unsigned, version } from './Primitives';

const skuSelector = optional(union([string(), array(string())]));
const nullableTime = union([isoUtc, nullSchema()]);
const nullableText = union([string(), nullSchema()]);
const reservation = strictObject({
  activeCount: unsigned,
  activeQuantity: unsigned,
  earliestExpiry: nullableTime,
});
const source = strictObject({
  id: string(),
  source: string(),
  reference: nullableText,
  location: string(),
  onhand: unsigned,
  safety: unsigned,
  reserved: unsigned,
  available: unsigned,
  state: literal(['active', 'blocked', 'retired']),
  version: string(),
  watermark: isoUtc,
});
const availability = strictObject({
  sku: string(),
  scope: string(),
  onhand: unsigned,
  safety: unsigned,
  reserved: unsigned,
  available: unsigned,
  state: literal(['available', 'unavailable', 'blocked']),
  reservation,
  sources: array(source),
  version: string(),
  watermark: isoUtc,
});
const importPreview = strictObject({
  hash: string(),
  state: literal(['pending', 'ready', 'rejected', 'expired']),
  total: unsigned,
  valid: unsigned,
  invalid: unsigned,
  onhandDelta: unsigned,
  samples: array(
    strictObject({
      row: unsigned,
      sku: string(),
      location: string(),
      source: string(),
      onhand: unsigned,
      safety: unsigned,
      valid: literal([true, false]),
      issues: array(string()),
    })
  ),
  watermark: nullableTime,
  expiresAt: isoUtc,
});
const adjustment = strictObject({
  id: string(),
  scope: string(),
  stockitem: string(),
  sku: string(),
  location: string(),
  quantityDelta: int(),
  reason: string(),
  state: literal(['pending', 'approved', 'rejected', 'cancelled', 'applied']),
  approvalId: string(),
  requestedBy: string(),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  version,
});

export const INVENTORY_QUERY_SCHEMAS = {
  InventoryAvailabilityReadInput: strictObject({ sku: skuSelector, source: optional(string()) }),
  InventoryAdjustmentsReadInput: strictObject(pageQuery),
  InventoryImportsReadInput: strictObject({ job: string() }),
} as const;
export const INVENTORY_BODY_SCHEMAS = {
  InventoryAdjustmentsCreateInput: strictObject({ stockitem: string(), quantityDelta: int(), reason: string(), expectedVersion: unsigned }),
  InventoryImportsCreateInput: importInput,
} as const;
export const INVENTORY_OUTPUT_SCHEMAS = {
  InventoryAvailabilityReadOutput: strictObject({ items: array(availability), count: unsigned, watermark: nullableTime }),
  InventoryAdjustmentsCreateOutput: adjustment,
  InventoryAdjustmentsReadOutput: strictObject({ items: array(adjustment), count: unsigned, nextCursor: optional(string()) }),
  InventoryImportsCreateOutput: importCreated,
  InventoryImportsReadOutput: strictObject({ ...importRead.shape, preview: optional(importPreview) }),
} as const;
