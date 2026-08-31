export interface Timeline {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly tracking: string | null;
  readonly occurredAt: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}
