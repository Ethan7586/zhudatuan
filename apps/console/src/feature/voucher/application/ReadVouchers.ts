import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import * as Operation from '@shop/contract/ids';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { VoucherChoiceKind, VoucherProgressKind, VoucherReadQuery, VoucherView } from '../model/Voucher';
import type { VoucherPort } from '../public';

const viewOperation = Object.freeze({
  products: Operation.OP_VOUCHER_PRODUCTS_LIST,
  pools: Operation.OP_VOUCHER_CREDENTIALPOOLS_LIST,
  credentials: Operation.OP_VOUCHER_CREDENTIALS_LIST,
  stocks: Operation.OP_VOUCHER_STOCKREQUESTS_LIST,
  issues: Operation.OP_VOUCHER_ISSUEORDERS_LIST,
  vouchers: Operation.OP_VOUCHER_SEARCH_READ,
  redemptions: Operation.OP_VOUCHER_REDEMPTIONS_GET,
  actions: Operation.OP_VOUCHER_ACTIONBATCHES_LIST,
  search: Operation.OP_VOUCHER_SEARCH_READ,
} satisfies Readonly<Record<VoucherView, string>>);

const detailOperation = Object.freeze({
  products: Operation.OP_VOUCHER_PRODUCTS_GET,
  pools: Operation.OP_VOUCHER_CREDENTIALPOOLS_GET,
  credentials: Operation.OP_VOUCHER_CREDENTIALS_GET,
  stocks: Operation.OP_VOUCHER_STOCKREQUESTS_GET,
  issues: Operation.OP_VOUCHER_ISSUEORDERS_GET,
  vouchers: Operation.OP_VOUCHER_VOUCHERS_GET,
  redemptions: Operation.OP_VOUCHER_REDEMPTIONS_GET,
  actions: Operation.OP_VOUCHER_ACTIONBATCHES_GET,
  search: Operation.OP_VOUCHER_VOUCHERS_GET,
} satisfies Readonly<Record<VoucherView, string>>);

export class ReadVouchers {
  constructor(private readonly port: Pick<VoucherPort, 'read' | 'detail' | 'choices' | 'facets' | 'byNumber' | 'timeline' | 'progress'>) {}
  page(context: ConsoleContext, view: VoucherView, query: VoucherReadQuery, signal?: AbortSignal) {
    assertOperationAccess(context, viewOperation[view]);
    return this.port.read(context, view, query, signal);
  }
  detail(context: ConsoleContext, view: VoucherView, id: string, signal?: AbortSignal) {
    if (!id) throw new Error('VOUCHER_REFERENCE_REQUIRED');
    assertOperationAccess(context, detailOperation[view]);
    return this.port.detail(context, view, id, signal);
  }
  choices(context: ConsoleContext, kind: VoucherChoiceKind, signal?: AbortSignal) {
    assertOperationAccess(context, kind === 'product' ? Operation.OP_VOUCHER_PRODUCTOPTIONS_LIST : Operation.OP_VOUCHER_STOCKREQUESTOPTIONS_LIST);
    return this.port.choices(context, kind, signal);
  }
  facets(context: ConsoleContext, query: VoucherReadQuery, signal?: AbortSignal) {
    assertOperationAccess(context, Operation.OP_VOUCHER_SEARCHFACETS_READ);
    return this.port.facets(context, query, signal);
  }
  byNumber(context: ConsoleContext, number: string, signal?: AbortSignal) {
    if (!number.trim()) throw new Error('VOUCHER_NUMBER_REQUIRED');
    assertOperationAccess(context, Operation.OP_VOUCHER_VOUCHERS_GETBYNUMBER);
    return this.port.byNumber(context, number.trim(), signal);
  }
  timeline(context: ConsoleContext, voucher: string, cursor?: string, signal?: AbortSignal) {
    if (!voucher) throw new Error('VOUCHER_REFERENCE_REQUIRED');
    assertOperationAccess(context, Operation.OP_VOUCHER_VOUCHERS_TIMELINE);
    return this.port.timeline(context, voucher, cursor, signal);
  }
  progress(context: ConsoleContext, kind: VoucherProgressKind, id: string, signal?: AbortSignal) {
    if (!id) throw new Error('VOUCHER_REFERENCE_REQUIRED');
    const operation = kind === 'job' ? Operation.OP_VOUCHER_JOBS_GET : kind === 'export' ? Operation.OP_VOUCHER_EXPORTS_GET : kind === 'issue' ? Operation.OP_VOUCHER_ISSUEBATCHES_GET : Operation.OP_VOUCHER_ACTIONBATCHES_GET;
    assertOperationAccess(context, operation);
    return this.port.progress(context, kind, id, signal);
  }
}
