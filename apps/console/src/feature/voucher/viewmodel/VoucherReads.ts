import * as Operation from '@shop/contract/ids';
import { useQuery } from '@tanstack/react-query';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { VoucherChoiceKind, VoucherOperation, VoucherProgressKind, VoucherView } from '../model/Voucher';
import { voucherChoicesKey, voucherProgressKey } from './VoucherQueryKey';

export const voucherViewOperation: Readonly<Record<VoucherView, VoucherOperation>> = Object.freeze({
  products: Operation.OP_VOUCHER_PRODUCTS_LIST,
  pools: Operation.OP_VOUCHER_CREDENTIALPOOLS_LIST,
  credentials: Operation.OP_VOUCHER_CREDENTIALS_LIST,
  stocks: Operation.OP_VOUCHER_STOCKREQUESTS_LIST,
  issues: Operation.OP_VOUCHER_ISSUEORDERS_LIST,
  vouchers: Operation.OP_VOUCHER_SEARCH_READ,
  redemptions: Operation.OP_VOUCHER_REDEMPTIONS_GET,
  actions: Operation.OP_VOUCHER_ACTIONBATCHES_LIST,
  search: Operation.OP_VOUCHER_SEARCH_READ,
});

const choiceOperation: Readonly<Record<VoucherChoiceKind, VoucherOperation>> = Object.freeze({ product: Operation.OP_VOUCHER_PRODUCTOPTIONS_LIST, stock: Operation.OP_VOUCHER_STOCKREQUESTOPTIONS_LIST });
const progressOperation: Readonly<Record<VoucherProgressKind, VoucherOperation>> = Object.freeze({ job: Operation.OP_VOUCHER_JOBS_GET, export: Operation.OP_VOUCHER_EXPORTS_GET, issue: Operation.OP_VOUCHER_ISSUEBATCHES_GET, action: Operation.OP_VOUCHER_ACTIONBATCHES_GET });
const terminalStates = new Set(['completed', 'failed', 'cancelled', 'expired']);

export function useVoucherChoice(context: ConsoleContext, dependencies: VoucherDependencies, kind: VoucherChoiceKind, requested: boolean) {
  const operation = choiceOperation[kind];
  return useQuery({ queryKey: voucherChoicesKey(context, kind), queryFn: ({ signal }) => dependencies.read.choices(context, kind, signal), enabled: requested && canReadVoucher(context, operation), staleTime: 60_000 });
}

export function useVoucherProgress(context: ConsoleContext, dependencies: VoucherDependencies, target?: Readonly<{ kind: VoucherProgressKind; id: string }>) {
  const allowed = Boolean(target && canReadVoucher(context, progressOperation[target.kind]));
  return useQuery({
    queryKey: voucherProgressKey(context, target?.kind ?? 'job', target?.id ?? ''),
    queryFn: ({ signal }) => dependencies.read.progress(context, target!.kind, target!.id, signal),
    enabled: allowed,
    refetchInterval: (current) => (current.state.data && terminalStates.has(current.state.data.state) ? false : 2_000),
  });
}

export function canReadVoucher(context: ConsoleContext, operation: VoucherOperation): boolean {
  return canUseOperation(context, operation) && context.session.assurance.level >= requiredAssurance(operation);
}
