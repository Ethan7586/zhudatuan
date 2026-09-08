import type { TicketPriority } from './Ticket';

export class Sla {
  constructor(
    readonly id: string,
    readonly scope: string,
    readonly priority: TicketPriority,
    readonly responseSeconds: number,
    readonly resolutionSeconds: number,
    readonly reopenSeconds: number,
    readonly version: number
  ) {
    if (
      !id ||
      !scope ||
      !Number.isSafeInteger(responseSeconds) ||
      responseSeconds < 1 ||
      !Number.isSafeInteger(resolutionSeconds) ||
      resolutionSeconds < responseSeconds ||
      !Number.isSafeInteger(reopenSeconds) ||
      reopenSeconds < 1 ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      throw new Error('SUPPORT_SLA_INVALID');
    Object.freeze(this);
  }

  deadlines(openedAt: Date): Readonly<{ response: string; resolution: string }> {
    if (Number.isNaN(openedAt.getTime())) throw new Error('SUPPORT_SLA_CLOCK_INVALID');
    return Object.freeze({
      response: new Date(openedAt.getTime() + this.responseSeconds * 1000).toISOString(),
      resolution: new Date(openedAt.getTime() + this.resolutionSeconds * 1000).toISOString(),
    });
  }

  reopenUntil(closedAt: Date): string {
    if (Number.isNaN(closedAt.getTime())) throw new Error('SUPPORT_SLA_CLOCK_INVALID');
    return new Date(closedAt.getTime() + this.reopenSeconds * 1000).toISOString();
  }
}
