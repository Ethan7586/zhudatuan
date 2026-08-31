import { bodyRecord, integerField } from '../../../../foundation/interface/Validation';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { cartInvalid } from '../error/CartError';

export interface CartChange {
  readonly listing: string;
  readonly quantity: number;
  readonly lineVersion: number | null;
}

export class CartPolicy {
  put(request: OperationRequest): CartChange {
    const body = bodyRecord(request);
    const quantity = integerField(body, 'quantity', 0);
    if (quantity > 999) return cartInvalid('quantity');
    return Object.freeze({ listing: request.input.path.listingid!, quantity, lineVersion: this.version(body.lineVersion, 'lineVersion') });
  }

  batch(request: OperationRequest): readonly CartChange[] {
    const entries = bodyRecord(request).items;
    if (!Array.isArray(entries) || entries.length > 100) return cartInvalid('items');
    const changes = entries.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return cartInvalid('items');
      const item = entry as Record<string, unknown>;
      const listing = String(item.listingId ?? '');
      const quantity = item.quantity;
      if (!listing || !Number.isSafeInteger(quantity) || (quantity as number) < 0 || (quantity as number) > 999) return cartInvalid('items');
      return Object.freeze({ listing, quantity: quantity as number, lineVersion: this.version(item.lineVersion, 'items.lineVersion') });
    });
    if (new Set(changes.map(({ listing }) => listing)).size !== changes.length) return cartInvalid('items');
    return Object.freeze(changes);
  }

  private version(value: unknown, field: string): number | null {
    if (value === null) return null;
    if (!Number.isSafeInteger(value) || (value as number) < 0) return cartInvalid(field);
    return value as number;
  }
}
