export interface HistoryItem {
  readonly sequence: number;
  readonly cursorId: string;
  readonly kind: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface HistoryPage {
  readonly items: readonly HistoryItem[];
  readonly count: number;
  readonly nextCursor?: string;
}
