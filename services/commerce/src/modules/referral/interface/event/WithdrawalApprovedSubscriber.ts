export class WithdrawalApprovedSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>) {
    if (payload.subjectKind !== 'withdrawal' || payload.action !== 'referral.withdrawal.pay') throw new Error('REFERRAL_APPROVAL_SUBJECT_INVALID');
    return Object.freeze({
      eventId,
      eventType: 'approval.instance.approved' as const,
      scopeId,
      sourceId: reference(payload.instanceId),
      resourceId: reference(payload.subjectId),
    });
  }
}

function reference(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('REFERRAL_APPROVAL_REFERENCE_REQUIRED');
  return value;
}
