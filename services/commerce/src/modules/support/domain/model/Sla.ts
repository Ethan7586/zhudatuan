import type { TicketPriority } from './Ticket';

export class Sla {
  constructor(readonly id: string, readonly scope: string, readonly priority: TicketPriority, readonly responseSeconds: number,
    readonly resolutionSeconds: number, readonly version: number) {
    if (!id || !scope || !Number.isSafeInteger(responseSeconds) || responseSeconds < 1 || !Number.isSafeInteger(resolutionSeconds)
      || resolutionSeconds < responseSeconds || !Number.isSafeInteger(version) || version < 1) throw new Error('SUPPORT_SLA_INVALID');
  }
}
