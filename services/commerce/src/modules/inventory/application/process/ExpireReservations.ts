import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { ReservationExpiryRepository } from '../port/ReservationExpiryRepository';

export interface ReservationExpiryRequest {
  readonly owner: string | null;
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ExpireReservations {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ReservationExpiryRepository
  ) {}

  async execute(request: ReservationExpiryRequest): Promise<void> {
    let more = true;
    let batches = 0;
    while (more && batches < 20) {
      if (request.signal.aborted) throw request.signal.reason;
      if (Date.now() >= request.deadline) throw new Error('DEADLINE_EXCEEDED');
      const result = await this.transactions.write(
        {
          tenant: request.scope,
          membership: '',
          scope: request.scope,
          actor: 'job:reservationexpiry',
          trace: request.trace,
          operation: 'job.inventory.reservationexpiry',
          workload: 'jobs',
          signal: request.signal,
          deadline: request.deadline,
        },
        (context) => this.repository.expire(context, request.owner, new Date(), 200)
      );
      more = result.more;
      batches += 1;
    }
    if (more) throw new Error('INVENTORY_RESERVATION_EXPIRY_CAPACITY_EXCEEDED');
  }
}
