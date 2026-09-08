import { describe, expect, it, vi } from 'vitest';
import type { InvoiceJobProcess, SettlementJobProcess } from '../application/port/FinanceJobProcess';
import { IssueInvoice } from '../application/process/IssueInvoice';
import { RunSettlement } from '../application/process/RunSettlement';
import { InputWatermark } from '../domain/value/InputWatermark';

const execution = Object.freeze({ scope: 'mall:one', trace: 'job:one', signal: new AbortController().signal, deadline: Date.now() + 10_000 });

describe('finance long-running execution contract', () => {
  it('freezes one valid input watermark and rejects drift', () => {
    const watermark = InputWatermark.restore({ hash: 'a'.repeat(64), count: 3, occurredAt: '2026-09-06T00:00:00.000Z' });
    expect(watermark.snapshot()).toEqual({ hash: 'a'.repeat(64), count: 3, occurredAt: '2026-09-06T00:00:00.000Z' });
    expect(() => watermark.assert('a'.repeat(64), 2)).toThrow('FINANCE_INPUT_SNAPSHOT_CHANGED');
    expect(() => watermark.assert('b'.repeat(64), 3)).toThrow('FINANCE_INPUT_SNAPSHOT_CHANGED');
  });

  it('derives stable settlement and payout business numbers on every retry', async () => {
    const settle = vi.fn<SettlementJobProcess['settle']>(async () => undefined);
    const withdraw = vi.fn<SettlementJobProcess['withdraw']>(async () => undefined);
    const process = new RunSettlement({ settle, withdraw });

    await process.settle('reconciliation:one', execution);
    await process.settle('reconciliation:one', execution);
    await process.withdraw('withdrawal:one', execution);
    await process.withdraw('withdrawal:one', execution);

    expect(settle.mock.calls.map(([input]) => input.business)).toEqual(['settlement:reconciliation:one', 'settlement:reconciliation:one']);
    expect(withdraw.mock.calls.map(([input]) => input.business)).toEqual(['withdrawal:one', 'withdrawal:one']);
  });

  it('uses the immutable invoice request as the issue and recovery business number', async () => {
    const issue = vi.fn<InvoiceJobProcess['issue']>(async () => undefined);
    const process = new IssueInvoice({ issue });

    await process.execute('invoice:one', execution);
    await process.execute('invoice:one', execution);

    expect(issue.mock.calls.map(([input]) => input)).toEqual([
      { request: 'invoice:one', business: 'invoice:one' },
      { request: 'invoice:one', business: 'invoice:one' },
    ]);
  });
});
