import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import type { IdentityAction, IdentityLifecycle } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';
import type { LoadedInvitation, PreparedInvitation } from '../service/CreateInvitation';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { PERM_IDENTITY_INVITATION_ISSUE } from '@shop/authz/ids';

type LoadedMember = Readonly<{ kind: 'manage' }> | Readonly<{ kind: 'create'; value: LoadedInvitation }>;
type PreparedMember = Readonly<{ kind: 'manage'; request: OperationRequest }> | Readonly<{ kind: 'create'; request: OperationRequest; preparation: PreparedInvitation }>;
type MemberCheckpoint = Readonly<{ kind: 'manage'; result: OperationResult }> | Readonly<{ kind: 'create'; request: OperationRequest; preparation: PreparedInvitation; result: OperationResult }>;

export class MembersManageHandler implements DurableOperationHandler<'identity.members.manage', PreparedMember, MemberCheckpoint, 'write', LoadedMember> {
  readonly operation = 'identity.members.manage' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly manage: IdentityAction,
    private readonly create: IdentityLifecycle<PreparedInvitation, LoadedInvitation>
  ) {}

  async load(input: OperationInputFor<'identity.members.manage'>, context: HandlerContext<'identity.members.manage'>): Promise<LoadedMember> {
    if (memberAction(input.body) !== 'create') return Object.freeze({ kind: 'manage' });
    if (!this.create.load) throw new Error('MEMBER_CREATE_LOAD_REQUIRED');
    const request = enrollmentRequest(identityRequest(this.operation, input, context));
    return Object.freeze({ kind: 'create', value: await this.create.load(request, context.transaction) });
  }

  async prepare(input: OperationInputFor<'identity.members.manage'>, context: PrepareContext<'identity.members.manage'>, loaded: LoadedMember): Promise<PreparedMember> {
    const request = identityRequest(this.operation, input, context);
    if (loaded.kind === 'manage') return Object.freeze({ kind: 'manage', request });
    if (!this.create.prepare) throw new Error('MEMBER_CREATE_PREPARE_REQUIRED');
    const mapped = enrollmentRequest(request);
    return Object.freeze({ kind: 'create', request: mapped, preparation: await this.create.prepare(mapped, loaded.value) });
  }

  async commit(_input: OperationInputFor<'identity.members.manage'>, prepared: PreparedMember, context: CommitContext<'identity.members.manage'>) {
    if (prepared.kind === 'manage') {
      const result = await this.manage(prepared.request, context.transaction);
      return Object.freeze({ checkpoint: Object.freeze({ kind: 'manage', result }) as MemberCheckpoint, response: identityReply<'identity.members.manage'>(result) });
    }
    const result = await this.create.execute(prepared.request, context.transaction, prepared.preparation);
    const response = createdResult(result);
    return Object.freeze({
      checkpoint: Object.freeze({ kind: 'create', request: prepared.request, preparation: prepared.preparation, result }) as MemberCheckpoint,
      response: identityReply<'identity.members.manage'>(response),
    });
  }

  async finalize(_input: OperationInputFor<'identity.members.manage'>, checkpoint: MemberCheckpoint, _context: FinalizeContext<'identity.members.manage'>): Promise<OperationReply<OperationOutputFor<'identity.members.manage'>>> {
    if (checkpoint.kind === 'manage') return identityReply<'identity.members.manage'>(checkpoint.result);
    const result = this.create.finalize ? await this.create.finalize(checkpoint.request, checkpoint.result, checkpoint.preparation) : checkpoint.result;
    return identityReply<'identity.members.manage'>(createdResult(result));
  }

  idempotencyResponse(response: OperationReply<OperationOutputFor<'identity.members.manage'>>): OperationReply<OperationOutputFor<'identity.members.manage'>> {
    if (response.body.action !== 'create') return response;
    return Object.freeze({
      ...response,
      body: Object.freeze({ action: 'create' as const, enrollment: Object.freeze({ ...response.body.enrollment, code: '' }) }),
      headers: Object.freeze({ ...response.headers, 'x-invitation-code': 'unavailable' }),
    });
  }

  discard(prepared: PreparedMember, cause: unknown): Promise<void> {
    if (prepared.kind !== 'create') return Promise.resolve();
    return this.create.discard?.(prepared.request, prepared.preparation, cause) ?? Promise.resolve();
  }
}

function enrollmentRequest(request: OperationRequest): OperationRequest {
  const actor = requireAccess(request);
  if (!actor.membership.permissions.allows.has(PERM_IDENTITY_INVITATION_ISSUE) || actor.membership.permissions.denies.has(PERM_IDENTITY_INVITATION_ISSUE)) {
    throw new DomainError('AUTHORIZATION_DENIED');
  }
  const body = request.input.body as CreateMemberBody;
  return Object.freeze({
    ...request,
    input: Object.freeze({
      ...request.input,
      body: Object.freeze({
        kind: 'enrollment' as const,
        target: body.target,
        organizationId: body.organizationId,
        employee: Object.freeze({
          displayName: body.displayName,
          mobile: body.mobile,
          ...(body.employeeNo === undefined ? {} : { employeeNo: body.employeeNo }),
          ...(body.departmentId === undefined ? {} : { departmentId: body.departmentId }),
        }),
        expiresAt: body.expiresAt,
        reason: body.reason,
      }),
    }),
  });
}

interface CreateMemberBody {
  readonly action: 'create';
  readonly target: 'storefront' | 'miniapp';
  readonly organizationId: string;
  readonly displayName: string;
  readonly mobile: string;
  readonly employeeNo?: string;
  readonly departmentId?: string;
  readonly expiresAt: string;
  readonly reason: string;
}

function memberAction(value: unknown): string | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? String(Reflect.get(value, 'action') ?? '') : undefined;
}

function createdResult(result: OperationResult): OperationResult {
  return Object.freeze({ ...result, body: Object.freeze({ action: 'create', enrollment: result.body }) });
}
