import { OP_CHANNEL_CONNECTIONS_READ, OP_FINANCE_AUDIT_READ, OP_FINANCE_STATEMENTIMPORTS_CREATE, OP_FINANCE_STATEMENTIMPORTS_READ, OP_RUNTIME_IMPORTS_CONFIRM, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_JOBS_READ, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import type { OperationId } from '@shop/contract';
import { useNavigate } from 'react-router';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { taskImportPath } from '../../../shared/task/TaskLaunch';
import type { RouteId } from '../../../generated/RouteBinding';
import type { FinanceSection } from '../model/Finance';

export type FinancePage = 'overview' | 'audit' | FinanceSection;
export const financeNavigation = Object.freeze([
  { key: 'overview', label: '概览', route: 'consolefinance' },
  { key: 'statements', label: '账单', route: 'consolefinancestatement' },
  { key: 'reconciliations', label: '对账', route: 'consolefinancereconciliation' },
  { key: 'settlements', label: '结算', route: 'consolefinancesettlement' },
  { key: 'withdrawals', label: '提现', route: 'consolefinancewithdrawal' },
  { key: 'invoices', label: '发票', route: 'consolefinanceinvoice' },
] satisfies readonly Readonly<{ key: FinancePage; label: string; route: RouteId }>[]);
export type FinancePrimaryPage = (typeof financeNavigation)[number]['key'];

const financeGovernance = Object.freeze([
  { key: 'entries', label: '账本分录', description: '核查不可变借贷事实', route: 'consolefinanceentry' },
  { key: 'policies', label: '规则与治理', description: '管理政策、修复、补账与审批', route: 'consolefinancegovernance' },
  { key: 'audit', label: '业务审计', description: '按业务编号核对完整证据链', route: 'consolefinanceaudit', operation: OP_FINANCE_AUDIT_READ },
] satisfies readonly Readonly<{ key: FinancePage; label: string; description: string; route: RouteId; operation?: OperationId }>[]);

export function useFinanceNavigationViewModel(context: ConsoleContext, active: FinancePage) {
  const navigate = useNavigate();
  return Object.freeze({
    active,
    items: financeNavigation,
    governance: financeGovernance.filter((item) => !('operation' in item) || canUseOperation(context, item.operation)),
    canImport: [OP_RUNTIME_UPLOADS_CREATE, OP_CHANNEL_CONNECTIONS_READ, OP_FINANCE_STATEMENTIMPORTS_CREATE, OP_FINANCE_STATEMENTIMPORTS_READ, OP_RUNTIME_JOBS_READ, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_IMPORTS_CONFIRM].every((operation) => canUseOperation(context, operation)),
    select: (route: RouteId) => {
      void navigate(scopeRoutePath(context.scope, route));
    },
    importStatement: () => {
      void navigate(taskImportPath(context, 'finance'));
    },
  });
}

export type FinanceNavigationViewModel = ReturnType<typeof useFinanceNavigationViewModel>;
