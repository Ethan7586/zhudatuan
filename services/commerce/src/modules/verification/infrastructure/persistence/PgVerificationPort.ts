import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { VerificationPort } from '../../public';
import { VerificationPolicy } from '../../domain/policy/VerificationPolicy';

export class PgVerificationPort implements VerificationPort {
  private readonly transactions = new PgTransactionAccess();
  private readonly policy = new VerificationPolicy();

  request(input: Parameters<VerificationPort['request']>[0]) {
    const rule = this.policy.resolve(input.purpose, input.operation);
    return Object.freeze({ purpose: rule.purpose, operation: rule.operation, channel: rule.channel, ttlSeconds: rule.ttlSeconds, minimumAssurance: rule.minimumAssurance });
  }

  async verify(context: Parameters<VerificationPort['verify']>[0], input: Parameters<VerificationPort['verify']>[1]) {
    const rule = this.policy.resolve(input.purpose, input.operation);
    const now = input.now ?? new Date();
    const result = await this.transactions.database(context).query<{ session_id: string; expires_at: Date }>(
      `update verification.proof set state='consumed',consumed_at=$8,consumed_by=$7,version=version+1
      where proof_hash=$1 and scope_id=$2 and subject_type=$3 and subject_id=$4 and purpose=$5 and operation_id=$6
        and state='active' and expires_at>$8
      returning session_id,expires_at`,
      [digest(input.proof), input.scope, input.subjectType, input.subject, rule.purpose, rule.operation, input.actor, now]
    );
    const proof = result.rows[0];
    if (!proof) throw new DomainError('PROOF_REQUIRED');
    return Object.freeze({ verification: proof.session_id, expiresAt: date(proof.expires_at).toISOString() });
  }
}

function digest(value: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new DomainError('PROOF_REQUIRED');
  return createHash('sha256').update(value).digest('hex');
}

function date(value: Date): Date {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error('VERIFICATION_PROOF_TIME_INVALID');
  return result;
}
