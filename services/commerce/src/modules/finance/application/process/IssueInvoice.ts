import type { FinanceJobExecution, InvoiceJobProcess } from '../port/FinanceJobProcess';

export class IssueInvoice {
  constructor(private readonly process: InvoiceJobProcess) {}

  execute(request: string, execution: FinanceJobExecution): Promise<void> {
    if (!request.trim() || request.length > 256) throw new Error('INVOICE_BUSINESS_SOURCE_INVALID');
    return this.process.issue(Object.freeze({ request, business: request }), execution);
  }
}
