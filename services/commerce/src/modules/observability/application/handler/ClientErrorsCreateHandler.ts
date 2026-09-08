import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ClientErrorInput } from '@shop/telemetry';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, optionalText, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ClientErrorRepository } from '../port/ClientErrorRepository';

export class ClientErrorsCreateHandler implements DurableOperationHandler<'observability.clienterrors.create', ClientErrorInput, ClientErrorInput, 'write'> {
  readonly operation = 'observability.clienterrors.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly errors: ClientErrorRepository) {}

  async prepare(input: OperationInputFor<'observability.clienterrors.create'>, context: PrepareContext<'observability.clienterrors.create'>): Promise<ClientErrorInput> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    return this.errors.sanitize(
      Object.freeze({
        scope: access.scope,
        surface: textField(body, 'surface', 32),
        route: textField(body, 'route', 500),
        operation: optionalText(body, 'operation', 160),
        release: textField(body, 'release', 120),
        message: textField(body, 'message', 500),
        stack: optionalText(body, 'stack', 8_000),
        componentStack: optionalText(body, 'componentStack', 8_000),
        traceId: access.trace,
        actorId: access.actor.id,
        membershipId: access.membership.id,
      })
    );
  }

  async commit(_input: OperationInputFor<'observability.clienterrors.create'>, prepared: ClientErrorInput, _context: CommitContext<'observability.clienterrors.create'>) {
    return Object.freeze({ checkpoint: prepared, response: { status: 202, body: { faultCode: 'pending', fingerprint: 'pending', occurrences: 0 } } as OperationReply<OperationOutputFor<'observability.clienterrors.create'>> });
  }

  async finalize(
    _input: OperationInputFor<'observability.clienterrors.create'>,
    checkpoint: ClientErrorInput,
    _context: FinalizeContext<'observability.clienterrors.create'>
  ): Promise<OperationReply<OperationOutputFor<'observability.clienterrors.create'>>> {
    const recorded = this.errors.record(checkpoint);
    return { status: 202, body: { faultCode: recorded.faultCode, fingerprint: recorded.fingerprint, occurrences: recorded.occurrences } };
  }
}
