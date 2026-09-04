import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import type { RiskGate } from '../../../../foundation/security/RiskGate';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import { InvitationRatePolicy } from '../../domain/policy/InvitationRatePolicy';
import type { InvitationRatePort } from '../port/InvitationRatePort';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { assertPublicRisk } from './PublicRisk';

export class InvitationGuard {
  private readonly policy = new InvitationRatePolicy();
  constructor(
    private readonly rates: InvitationRatePort,
    private readonly risk: RiskGate,
    private readonly protector: FederationProtector
  ) {}

  async assert(request: OperationRequest, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<void> {
    const peer = request.input.headers['x-peer-address'] ?? 'unknown';
    const agent = request.input.headers['user-agent'] ?? 'unknown';
    const device = request.input.headers['x-device-id'] ?? 'browser';
    const actor = request.input.publicActor ?? 'public:missing';
    const codeHash = this.protector.risk(actor, request.type).toString('hex');
    const deviceHash = this.protector.device(device).toString('hex');
    const networkHash = this.protector.risk(peer, agent).toString('hex');
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? actor;
    await Promise.all([
      this.rates.consume({ operation: request.type, actor, trace, deadline: request.input.deadline, signal: request.input.signal, rules: this.policy.rules(target, { code: codeHash, device: deviceHash, network: networkHash }) }),
      assertPublicRisk(this.risk, request, codeHash, deviceHash, target, { 'invitation.code': 1, 'invitation.device': 1, 'invitation.network': 1 }),
    ]);
  }

  assertRecipient(request: OperationRequest, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', recipient: Buffer | null): Promise<void> {
    if (recipient === null) return Promise.resolve();
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    return this.rates.consume({
      operation: request.type,
      actor: request.input.publicActor ?? `public:${recipient.toString('hex')}`,
      trace,
      deadline: request.input.deadline,
      signal: request.input.signal,
      rules: [this.policy.recipient(target, recipient.toString('hex'))],
    });
  }

  assertRecipientWithin(context: WriteTransactionContext, request: OperationRequest, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier', recipient: Buffer | null): Promise<void> {
    if (recipient === null) return Promise.resolve();
    const trace = request.input.headers['x-trace-id'] ?? request.input.idempotency ?? request.input.publicActor ?? 'public:invitation';
    return this.rates.consumeWithin(context, {
      operation: request.type,
      actor: request.input.publicActor ?? `public:${recipient.toString('hex')}`,
      trace,
      deadline: request.input.deadline,
      signal: request.input.signal,
      rules: [this.policy.recipient(target, recipient.toString('hex'))],
    });
  }
}
