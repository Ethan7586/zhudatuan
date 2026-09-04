import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext, WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
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
import type { PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { ActivationLookup } from '../port/ActivationRate';
import type { SearchFilter, SearchInput } from '../port/SearchFilter';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { authorizationEvidence } from '../../../../foundation/security/AuthorizationEvidence';

export class VoucherApplication {
  constructor(
    private readonly members: Pick<MemberAccessPort, 'member'>,
    private readonly products: VoucherProductRepository,
    private readonly pools: CredentialPoolRepository,
    private readonly credentials: CredentialRepository,
    private readonly stocks: StockRequestRepository,
    private readonly issues: IssueOrderRepository,
    private readonly actions: ActionBatchRepository,
    private readonly vouchers: VoucherRepository,
    private readonly tenders: TenderRepository,
    private readonly search: PreparedVoucherSearch,
    private readonly exports: VoucherExport,
    private readonly activation: VoucherActivation
  ) {}
  async productsCreate(input: OperationInputFor<'voucher.products.create'>, context: WriteHandlerContext<'voucher.products.create'>): Promise<OperationReply<OperationOutputFor<'voucher.products.create'>>> { return this.products.create(await this.call(input, context)); }
  async productsRevise(input: OperationInputFor<'voucher.products.revise'>, context: WriteHandlerContext<'voucher.products.revise'>): Promise<OperationReply<OperationOutputFor<'voucher.products.revise'>>> { return this.products.revise(await this.call(input, context)); }
  async productsEnable(input: OperationInputFor<'voucher.products.enable'>, context: WriteHandlerContext<'voucher.products.enable'>): Promise<OperationReply<OperationOutputFor<'voucher.products.enable'>>> { return this.products.enable(await this.call(input, context)); }
  async productsDisable(input: OperationInputFor<'voucher.products.disable'>, context: WriteHandlerContext<'voucher.products.disable'>): Promise<OperationReply<OperationOutputFor<'voucher.products.disable'>>> { return this.products.disable(await this.call(input, context)); }
  async productsGet(input: OperationInputFor<'voucher.products.get'>, context: HandlerContext<'voucher.products.get'>): Promise<OperationReply<OperationOutputFor<'voucher.products.get'>>> { return this.products.get(await this.call(input, context)); }
  async productsList(input: OperationInputFor<'voucher.products.list'>, context: HandlerContext<'voucher.products.list'>): Promise<OperationReply<OperationOutputFor<'voucher.products.list'>>> { return this.products.list(await this.call(input, context)); }
  async productoptionsList(input: OperationInputFor<'voucher.productoptions.list'>, context: HandlerContext<'voucher.productoptions.list'>): Promise<OperationReply<OperationOutputFor<'voucher.productoptions.list'>>> { return this.products.options(await this.call(input, context)); }
  async credentialpoolsCreate(input: OperationInputFor<'voucher.credentialpools.create'>, context: WriteHandlerContext<'voucher.credentialpools.create'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.create'>>> { return this.pools.create(await this.call(input, context)); }
  async credentialsGenerate(input: OperationInputFor<'voucher.credentials.generate'>, context: WriteHandlerContext<'voucher.credentials.generate'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.generate'>>> { return this.credentials.generate(await this.call(input, context)); }
  async credentialsImport(input: OperationInputFor<'voucher.credentials.import'>, context: WriteHandlerContext<'voucher.credentials.import'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.import'>>> { return this.credentials.import(await this.call(input, context)); }
  async credentialpoolsClose(input: OperationInputFor<'voucher.credentialpools.close'>, context: WriteHandlerContext<'voucher.credentialpools.close'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.close'>>> { return this.pools.close(await this.call(input, context)); }
  async credentialpoolsGet(input: OperationInputFor<'voucher.credentialpools.get'>, context: HandlerContext<'voucher.credentialpools.get'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.get'>>> { return this.pools.get(await this.call(input, context)); }
  async credentialpoolsList(input: OperationInputFor<'voucher.credentialpools.list'>, context: HandlerContext<'voucher.credentialpools.list'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialpools.list'>>> { return this.pools.list(await this.call(input, context)); }
  async credentialsList(input: OperationInputFor<'voucher.credentials.list'>, context: HandlerContext<'voucher.credentials.list'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.list'>>> { return this.credentials.list(await this.call(input, context)); }
  async credentialsGet(input: OperationInputFor<'voucher.credentials.get'>, context: HandlerContext<'voucher.credentials.get'>): Promise<OperationReply<OperationOutputFor<'voucher.credentials.get'>>> { return this.credentials.get(await this.call(input, context)); }
  async credentialexportsCreate(input: OperationInputFor<'voucher.credentialexports.create'>, context: WriteHandlerContext<'voucher.credentialexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.credentialexports.create'>>> { return this.credentials.export(await this.call(input, context)); }
  async jobsGet(input: OperationInputFor<'voucher.jobs.get'>, context: HandlerContext<'voucher.jobs.get'>): Promise<OperationReply<OperationOutputFor<'voucher.jobs.get'>>> { return this.credentials.job(await this.call(input, context)); }
  async stockrequestsCreate(input: OperationInputFor<'voucher.stockrequests.create'>, context: WriteHandlerContext<'voucher.stockrequests.create'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.create'>>> { return this.stocks.create(await this.call(input, context)); }
  async stockrequestsUpdate(input: OperationInputFor<'voucher.stockrequests.update'>, context: WriteHandlerContext<'voucher.stockrequests.update'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.update'>>> { return this.stocks.update(await this.call(input, context)); }
  async stockrequestsSubmit(input: OperationInputFor<'voucher.stockrequests.submit'>, context: WriteHandlerContext<'voucher.stockrequests.submit'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.submit'>>> { return this.stocks.submit(await this.call(input, context)); }
  async stockrequestsCancel(input: OperationInputFor<'voucher.stockrequests.cancel'>, context: WriteHandlerContext<'voucher.stockrequests.cancel'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.cancel'>>> { return this.stocks.cancel(await this.call(input, context)); }
  async stockrequestsGet(input: OperationInputFor<'voucher.stockrequests.get'>, context: HandlerContext<'voucher.stockrequests.get'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.get'>>> { return this.stocks.get(await this.call(input, context)); }
  async stockrequestsList(input: OperationInputFor<'voucher.stockrequests.list'>, context: HandlerContext<'voucher.stockrequests.list'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.list'>>> { return this.stocks.list(await this.call(input, context)); }
  async stockrequestoptionsList(input: OperationInputFor<'voucher.stockrequestoptions.list'>, context: HandlerContext<'voucher.stockrequestoptions.list'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequestoptions.list'>>> { return this.stocks.options(await this.call(input, context)); }
  async issueordersCreate(input: OperationInputFor<'voucher.issueorders.create'>, context: WriteHandlerContext<'voucher.issueorders.create'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.create'>>> { return this.issues.create(await this.call(input, context)); }
  async issueordersUpdate(input: OperationInputFor<'voucher.issueorders.update'>, context: WriteHandlerContext<'voucher.issueorders.update'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.update'>>> { return this.issues.update(await this.call(input, context)); }
  async issueordersSubmit(input: OperationInputFor<'voucher.issueorders.submit'>, context: WriteHandlerContext<'voucher.issueorders.submit'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.submit'>>> { return this.issues.submit(await this.call(input, context)); }
  async issueordersCancel(input: OperationInputFor<'voucher.issueorders.cancel'>, context: WriteHandlerContext<'voucher.issueorders.cancel'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.cancel'>>> { return this.issues.cancel(await this.call(input, context)); }
  async issueordersGet(input: OperationInputFor<'voucher.issueorders.get'>, context: HandlerContext<'voucher.issueorders.get'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.get'>>> { return this.issues.get(await this.call(input, context)); }
  async issueordersList(input: OperationInputFor<'voucher.issueorders.list'>, context: HandlerContext<'voucher.issueorders.list'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.list'>>> { return this.issues.list(await this.call(input, context)); }
  async issuebatchesRetry(input: OperationInputFor<'voucher.issuebatches.retry'>, context: WriteHandlerContext<'voucher.issuebatches.retry'>): Promise<OperationReply<OperationOutputFor<'voucher.issuebatches.retry'>>> { return this.issues.retry(await this.call(input, context)); }
  async issuebatchesGet(input: OperationInputFor<'voucher.issuebatches.get'>, context: HandlerContext<'voucher.issuebatches.get'>): Promise<OperationReply<OperationOutputFor<'voucher.issuebatches.get'>>> { return this.issues.batch(await this.call(input, context)); }
  async issueorderexportsCreate(input: OperationInputFor<'voucher.issueorderexports.create'>, context: WriteHandlerContext<'voucher.issueorderexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorderexports.create'>>> { return this.issues.export(await this.call(input, context)); }
  async actionbatchesCreate(input: OperationInputFor<'voucher.actionbatches.create'>, context: WriteHandlerContext<'voucher.actionbatches.create'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.create'>>> { return this.actions.create(await this.call(input, context)); }
  async actionbatchesGet(input: OperationInputFor<'voucher.actionbatches.get'>, context: HandlerContext<'voucher.actionbatches.get'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.get'>>> { return this.actions.get(await this.call(input, context)); }
  async actionbatchesList(input: OperationInputFor<'voucher.actionbatches.list'>, context: HandlerContext<'voucher.actionbatches.list'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.list'>>> { return this.actions.list(await this.call(input, context)); }
  async actionbatchesRetry(input: OperationInputFor<'voucher.actionbatches.retry'>, context: WriteHandlerContext<'voucher.actionbatches.retry'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.retry'>>> { return this.actions.retry(await this.call(input, context)); }
  async actionexportsCreate(input: OperationInputFor<'voucher.actionexports.create'>, context: WriteHandlerContext<'voucher.actionexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.actionexports.create'>>> { return this.actions.export(await this.call(input, context)); }
  prepareSearch(input: SearchInput, context: PrepareContext): Promise<SearchFilter> { return this.search.prepare(input, requireSession(context.security).scope.id); }
  prepareVoucherNumber(input: OperationInputFor<'voucher.vouchers.getbynumber'>, context: PrepareContext): Promise<string> { return this.search.number(input.path.number, requireSession(context.security).scope.id); }
  async searchRead(input: OperationInputFor<'voucher.search.read'>, filter: SearchFilter, context: HandlerContext<'voucher.search.read'>): Promise<OperationReply<OperationOutputFor<'voucher.search.read'>>> { return this.search.read(await this.call(input, context), filter); }
  prepareActivation(input: OperationInputFor<'voucher.activations.secret'> | OperationInputFor<'voucher.activations.numbersecret'>, context: PrepareContext): Promise<ActivationLookup> {
    const value = bodyRecord(input);
    return this.activation.prepare(requireSession(context.security).scope.id, textField(value, 'secret', 256), context.operation === 'voucher.activations.numbersecret' ? textField(value, 'number', 255) : undefined);
  }
  async activationsSecret(input: OperationInputFor<'voucher.activations.secret'>, lookup: ActivationLookup, context: WriteHandlerContext<'voucher.activations.secret'>): Promise<OperationReply<OperationOutputFor<'voucher.activations.secret'>>> { return this.activation.secret(await this.call(input, context), lookup); }
  async activationsNumbersecret(input: OperationInputFor<'voucher.activations.numbersecret'>, lookup: ActivationLookup, context: WriteHandlerContext<'voucher.activations.numbersecret'>): Promise<OperationReply<OperationOutputFor<'voucher.activations.numbersecret'>>> { return this.activation.number(await this.call(input, context), lookup); }
  async vouchersBind(input: OperationInputFor<'voucher.vouchers.bind'>, context: WriteHandlerContext<'voucher.vouchers.bind'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.bind'>>> { return this.vouchers.bind(await this.call(input, context)); }
  async vouchersUnbind(input: OperationInputFor<'voucher.vouchers.unbind'>, context: WriteHandlerContext<'voucher.vouchers.unbind'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.unbind'>>> { return this.vouchers.unbind(await this.call(input, context)); }
  async vouchersGet(input: OperationInputFor<'voucher.vouchers.get'>, context: HandlerContext<'voucher.vouchers.get'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.get'>>> { return this.vouchers.get(await this.call(input, context)); }
  async vouchersGetbynumber(input: OperationInputFor<'voucher.vouchers.getbynumber'>, fingerprint: string, context: HandlerContext<'voucher.vouchers.getbynumber'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.getbynumber'>>> { return this.vouchers.number(await this.call(input, context), fingerprint); }
  async vouchersTimeline(input: OperationInputFor<'voucher.vouchers.timeline'>, context: HandlerContext<'voucher.vouchers.timeline'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.timeline'>>> { return this.vouchers.timeline(await this.call(input, context)); }
  async redemptionsQuote(input: OperationInputFor<'voucher.redemptions.quote'>, context: WriteHandlerContext<'voucher.redemptions.quote'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.quote'>>> { return this.vouchers.quote(await this.call(input, context)); }
  async tenderholdsCreate(input: OperationInputFor<'voucher.tenderholds.create'>, context: WriteHandlerContext<'voucher.tenderholds.create'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.create'>>> { return this.tenders.create(await this.call(input, context)); }
  async tenderholdsConsume(input: OperationInputFor<'voucher.tenderholds.consume'>, context: WriteHandlerContext<'voucher.tenderholds.consume'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.consume'>>> { return this.tenders.consume(await this.call(input, context)); }
  async tenderholdsRelease(input: OperationInputFor<'voucher.tenderholds.release'>, context: WriteHandlerContext<'voucher.tenderholds.release'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.release'>>> { return this.tenders.release(await this.call(input, context)); }
  async redemptionsCreate(input: OperationInputFor<'voucher.redemptions.create'>, context: WriteHandlerContext<'voucher.redemptions.create'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.create'>>> { return this.vouchers.redeem(await this.call(input, context)); }
  async refundsCreate(input: OperationInputFor<'voucher.refunds.create'>, context: WriteHandlerContext<'voucher.refunds.create'>): Promise<OperationReply<OperationOutputFor<'voucher.refunds.create'>>> { return this.vouchers.refund(await this.call(input, context)); }
  async redemptionsGet(input: OperationInputFor<'voucher.redemptions.get'>, context: HandlerContext<'voucher.redemptions.get'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.get'>>> { return this.vouchers.redemption(await this.call(input, context)); }
  async searchfacetsRead(input: OperationInputFor<'voucher.searchfacets.read'>, filter: SearchFilter, context: HandlerContext<'voucher.searchfacets.read'>): Promise<OperationReply<OperationOutputFor<'voucher.searchfacets.read'>>> { return this.search.facets(await this.call(input, context), filter); }
  async searchsnapshotsCreate(input: OperationInputFor<'voucher.searchsnapshots.create'>, filter: SearchFilter, context: WriteHandlerContext<'voucher.searchsnapshots.create'>): Promise<OperationReply<OperationOutputFor<'voucher.searchsnapshots.create'>>> { return this.search.snapshot(await this.call(input, context), filter); }
  async searchexportsCreate(input: OperationInputFor<'voucher.searchexports.create'>, context: WriteHandlerContext<'voucher.searchexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.searchexports.create'>>> { return this.exports.search(await this.call(input, context)); }
  private async call<TKey extends OperationId>(input: OperationInputFor<TKey>, context: HandlerContext<TKey> | WriteHandlerContext<TKey>): Promise<VoucherCall<TKey>> {
    const access = requireSession(context.security);
    const member = access.actor.target === 'storefront' || access.actor.target === 'miniapp'
      ? await this.members.member(context.transaction, access.membership.id)
      : access.membership.id;
    const now = new Date();
    return Object.freeze({ input, context, scope: access.scope.id, tenant: access.scope.tenant ?? access.organization, actor: access.actor.id, member, target: access.actor.target,
      idempotency: context.idempotencyKey ?? null, expectedVersion: context.expectedVersion ?? null, now,
      authorization: authorizationEvidence(access, context.operation, now) });
  }
}
