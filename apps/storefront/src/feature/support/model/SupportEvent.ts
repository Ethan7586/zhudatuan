export interface SupportEvent {
  readonly id: string;
  readonly type: string;
  readonly ticketId: string;
  readonly messageId?: string;
  readonly evidenceId?: string;
  readonly version?: number;
  readonly sequence?: number;
}
