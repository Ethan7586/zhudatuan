import type { RiskGate } from '../../../../foundation/security/RiskGate';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { DomainError } from '../../../../foundation/domain/DomainError';

export async function assertPublicRisk(
  risk: RiskGate,
  request: OperationRequest,
  subject: string,
  client: string,
  target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier' = (request.security.kind === 'session' ? request.security.access.actor.target : request.security.target) ?? 'storefront',
  signals: Readonly<Record<string, number>> = { 'login.attempt': 1 }
): Promise<void> {
  const { outcome } = await risk.evaluate({
    actor: { id: `public:${subject.slice(0, 24)}`, session: `public:${client.slice(0, 24)}`, membership: 'public', credentialVersion: 0, accessVersion: 0, target, assurance: { level: 0 } },
    operation: request.type,
    scope: { kind: 'self', id: 'identity', path: [] },
    trace: request.input.headers['x-trace-id'] ?? request.input.idempotency ?? `public:${client.slice(0, 24)}`,
    deadline: request.input.deadline,
    signal: request.input.signal,
    signals,
  });
  if (outcome !== 'allow') throw new DomainError(outcome === 'review' ? 'RISK_REVIEW_REQUIRED' : 'RISK_DENIED');
}
