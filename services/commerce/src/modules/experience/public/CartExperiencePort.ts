import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CartExperiencePort {
  active(database: OperationDatabase, scope: string): Promise<string | null>;
}

export const CART_EXPERIENCE_PORT = publicPort<CartExperiencePort>('experience', 'cart');

export class PgCartExperiencePort implements CartExperiencePort {
  async active(database: OperationDatabase, scope: string): Promise<string | null> {
    const result = await database.query<{ id: string }>(
      `select id from experience.application where scope_id=$1 and status='active'
      order by updated_at desc,id limit 1`,
      [scope]
    );
    return result.rows[0]?.id ?? null;
  }
}
