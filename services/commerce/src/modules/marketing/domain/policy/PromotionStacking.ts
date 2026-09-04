export interface PromotionCandidate<T> {
  readonly value: T;
  readonly id: string;
  readonly priority: number;
  readonly group: string;
  readonly stackable: boolean;
  readonly discountMinor: number;
}

export class PromotionStacking {
  select<T>(candidates: readonly PromotionCandidate<T>[]): readonly PromotionCandidate<T>[] {
    const byGroup = new Map<string, PromotionCandidate<T>>();
    for (const candidate of candidates) {
      if (candidate.discountMinor <= 0) continue;
      const current = byGroup.get(candidate.group);
      if (!current || compare(candidate, current) < 0) byGroup.set(candidate.group, candidate);
    }
    const selected = [...byGroup.values()];
    const exclusive = selected.filter((candidate) => !candidate.stackable).sort(compare)[0];
    return Object.freeze((exclusive ? [exclusive] : selected).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id)));
  }
}

function compare<T>(left: PromotionCandidate<T>, right: PromotionCandidate<T>): number {
  return left.priority - right.priority || right.discountMinor - left.discountMinor || left.id.localeCompare(right.id);
}
