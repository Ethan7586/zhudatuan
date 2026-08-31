import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CheckoutExperienceRelease {
  readonly version: string;
  readonly hash: string;
}

export interface CheckoutExperiencePort {
  published(database: OperationDatabase, application: string): Promise<CheckoutExperienceRelease | null>;
}

export const CHECKOUT_EXPERIENCE_PORT = publicPort<CheckoutExperiencePort>('experience', 'checkout');

export class PgCheckoutExperiencePort implements CheckoutExperiencePort {
  async published(database: OperationDatabase, application: string): Promise<CheckoutExperienceRelease | null> {
    const result = await database.query<{ version: string; hash: string }>(
      `select version_id version,content_hash hash from experience.publication
      where application_id=$1 and state='active' order by published_at desc,release_id limit 1`,
      [application]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
}
