export class SettlementPolicy {
  eligible(state: string, eligibleAt: string | null, now: Date): boolean {
    return state === 'available' && eligibleAt !== null && !Number.isNaN(Date.parse(eligibleAt)) && Date.parse(eligibleAt) <= now.getTime();
  }

  deterministicKey(scopeId: string, commissionId: string, movement: 'settle' | 'reverse'): string {
    if (!scopeId || !commissionId) throw new Error('REFERRAL_SETTLEMENT_REFERENCE_INVALID');
    return `${movement}:${scopeId}:${commissionId}`;
  }
}
