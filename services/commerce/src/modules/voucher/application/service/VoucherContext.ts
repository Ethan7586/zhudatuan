import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext, WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { MemberAccessPort } from '../../../access/public';
import type { VoucherCall } from '../port/VoucherCall';
import type { ActionBatchRepository } from '../port/ActionBatchRepository';
import type { CredentialPoolRepository } from '../port/CredentialPoolRepository';
import type { CredentialRepository } from '../port/CredentialRepository';
import type { IssueOrderRepository } from '../port/IssueOrderRepository';
import type { StockRequestRepository } from '../port/StockRequestRepository';
import type { TenderRepository } from '../port/TenderRepository';
import type { VoucherProductRepository } from '../port/VoucherProductRepository';
import type { VoucherRepository } from '../port/VoucherRepository';
import type { VoucherExport } from '../port/VoucherExport';
import { VoucherActivation } from './VoucherActivation';
import { PreparedVoucherSearch } from './PreparedVoucherSearch';
import type { PrepareContext } from '../../../../pipeline/HandlerContext';
import type { ActivationLookup } from '../port/ActivationRate';
import type { SearchFilter, SearchInput } from '../port/SearchFilter';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { authorizationEvidence } from '../../../../platform/security/AuthorizationEvidence';

export class VoucherContext {
  constructor(
    protected readonly members: Pick<MemberAccessPort, 'member'>,
    protected readonly products: VoucherProductRepository,
    protected readonly pools: CredentialPoolRepository,
    protected readonly credentials: CredentialRepository,
    protected readonly stocks: StockRequestRepository,
    protected readonly issues: IssueOrderRepository,
    protected readonly actions: ActionBatchRepository,
    protected readonly vouchers: VoucherRepository,
    protected readonly tenders: TenderRepository,
    protected readonly search: PreparedVoucherSearch,
    protected readonly exports: VoucherExport,
    protected readonly activation: VoucherActivation
  ) {}

  protected async call<TKey extends OperationId>(input: OperationInputFor<TKey>, context: HandlerContext<TKey> | WriteHandlerContext<TKey>): Promise<VoucherCall<TKey>> {
    const access = requireSession(context.security);
    const member = access.actor.target === 'storefront' || access.actor.target === 'miniapp' ? await this.members.member(context.transaction, access.membership.id) : access.membership.id;
    const now = new Date();
    return Object.freeze({
      input,
      context,
      scope: access.scope.id,
      tenant: access.scope.tenant ?? access.organization,
      actor: access.actor.id,
      member,
      target: access.actor.target,
      idempotency: context.idempotencyKey ?? null,
      expectedVersion: context.expectedVersion ?? null,
      now,
      authorization: authorizationEvidence(access, context.operation, now),
    });
  }
}
