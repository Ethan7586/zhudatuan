import type { OperationId } from '@shop/contract';
import { OP_FINANCE_ENTRIES_READ, OP_FINANCE_POLICIES_READ, OP_FINANCE_RECONCILIATIONS_READ, OP_FINANCE_SETTLEMENTS_READ, OP_FINANCE_STATEMENTS_READ, OP_FINANCE_WITHDRAWALS_READ, OP_INVOICE_REQUESTS_READ } from '@shop/contract/ids';
import type { FinanceSection } from './Finance';

export function financeSectionOperation(section: FinanceSection): OperationId {
  switch (section) {
    case 'entries': return OP_FINANCE_ENTRIES_READ;
    case 'statements': return OP_FINANCE_STATEMENTS_READ;
    case 'reconciliations': return OP_FINANCE_RECONCILIATIONS_READ;
    case 'settlements': return OP_FINANCE_SETTLEMENTS_READ;
    case 'withdrawals': return OP_FINANCE_WITHDRAWALS_READ;
    case 'invoices': return OP_INVOICE_REQUESTS_READ;
    case 'policies': return OP_FINANCE_POLICIES_READ;
  }
}
