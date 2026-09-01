/** Finance policy persistence contract. */

export interface FinancePolicyView extends Readonly<Record<string, unknown>> {
  readonly id: string;
}

export interface PolicyRepository {
  read(scopeIds: readonly string[], status: string | null, cursor: string | null, limit: number): Promise<readonly FinancePolicyView[]>;
  affected(scopeIds: readonly string[], from: string, to: string): Promise<number>;
}
