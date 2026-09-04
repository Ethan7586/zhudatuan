import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';

export interface InventoryMovement {
  readonly id: string;
  readonly stockitem: string;
  readonly kind: string;
  readonly quantity: number;
  readonly referenceKind: string;
  readonly reference: string;
}

export async function appendMovements(database: ReturnType<PgTransactionAccess['database']>, movements: readonly InventoryMovement[]): Promise<void> {
  if (movements.length === 0) return;
  await database.query(
    `insert into inventory.movement(id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
     select input.id,input.stockitem,input.kind,input.quantity,input."referenceKind",input.reference,clock_timestamp()
     from jsonb_to_recordset($1::jsonb) input(id text,stockitem text,kind text,quantity bigint,"referenceKind" text,reference text)
     on conflict(stockitem_id,kind,reference_type,reference_id) do nothing`, [JSON.stringify(movements)]
  );
}
