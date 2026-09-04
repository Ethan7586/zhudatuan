export class SettlementPolicy {
  eligible(state: string, eligibleAt: string | null, now: Date): boolean {
    return state === 'available' && eligibleAt !== null && !Number.isNaN(Date.parse(eligibleAt)) && Date.parse(eligibleAt) <= now.getTime();
  }

  deterministicKey(scopeId: string, commissionId: string, movement: 'settle' | 'reverse'): string {
    if (!scopeId || !commissionId) throw new Error('REFERRAL_SETTLEMENT_REFERENCE_INVALID');
    return `${movement}:${scopeId}:${commissionId}`;
  }

  releaseAt(receivedAt: string, freezeDays: number): string {
    const received = Date.parse(receivedAt);
    if (!Number.isFinite(received) || !Number.isSafeInteger(freezeDays) || freezeDays < 0 || freezeDays > 3650) throw new Error('REFERRAL_FREEZE_PERIOD_INVALID');
    return new Date(received + freezeDays * 86_400_000).toISOString();
  }
}
