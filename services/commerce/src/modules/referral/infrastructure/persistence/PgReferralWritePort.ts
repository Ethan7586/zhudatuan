import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { ReferralWritePort } from '../../public';

export class PgReferralWritePort implements ReferralWritePort {
  constructor(private readonly database: DatabasePool) {}
  accept(event: Parameters<ReferralWritePort['accept']>[0]): Promise<boolean> {
    return new PgRuntimeWriter(this.database).acceptInbox({ consumer: 'job:referralevent', event: event.eventId, type: event.eventType, trace: event.eventId, payload: event.payload });
  }
}
