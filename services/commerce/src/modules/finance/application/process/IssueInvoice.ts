import type { FinanceJobExecution, InvoiceJobProcess } from '../port/FinanceJobProcess';

export class IssueInvoice {
  constructor(private readonly process: InvoiceJobProcess) {}

  execute(request: string, execution: FinanceJobExecution): Promise<void> {
    return this.process.issue(request, execution);
  }
}
