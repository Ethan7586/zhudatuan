import type { ExportExecution, ExportPageRow, ExportPlan, ExportRenderer, ExportResult } from '../../../runtime/public';

/** Voucher policy decorator; Runtime remains responsible for file lifecycle and paging orchestration. */
export class VoucherExportProcess<TPlan extends ExportPlan = ExportPlan> implements ExportRenderer<TPlan> {
  constructor(private readonly renderer: ExportRenderer<TPlan>) {}

  async open(id: string, execution: ExportExecution): Promise<TPlan | null> {
    if (!id.startsWith('export:') || !execution.scope) throw new Error('VOUCHER_EXPORT_PAYLOAD_INVALID');
    const plan = await this.renderer.open(id, execution);
    if (plan !== null && plan.owner !== 'voucher') throw new Error('VOUCHER_EXPORT_OWNER_INVALID');
    return plan;
  }

  prepare(plan: TPlan): Promise<number | null> {
    return this.renderer.prepare(plan);
  }

  read(plan: TPlan, cursor: string | null, fetch: number): Promise<readonly ExportPageRow[]> {
    return this.renderer.read(plan, cursor, fetch);
  }

  advance(plan: TPlan, cursor: string, count: number): Promise<void> {
    return this.renderer.advance(plan, cursor, count);
  }

  complete(plan: TPlan, result: ExportResult): Promise<void> {
    return this.renderer.complete(plan, result);
  }

  fail(plan: TPlan, code: string, terminal: boolean): Promise<void> {
    return this.renderer.fail(plan, code, terminal);
  }

  retryable(cause: unknown): boolean {
    return this.renderer.retryable(cause);
  }
}
