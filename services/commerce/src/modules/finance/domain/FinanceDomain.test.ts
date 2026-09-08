import { Money } from '@shop/kernel';
import { describe, expect, it } from 'vitest';
import { Account } from './model/Account';
import { AccountingPeriod } from './model/AccountingPeriod';
import { Invoice } from './model/Invoice';
import { Journal } from './model/Journal';
import { JournalEntry } from './model/JournalEntry';
import { Ledger } from './model/Ledger';
import { Reconciliation } from './model/Reconciliation';
import { Settlement } from './model/Settlement';
import { Statement } from './model/Statement';
import { Withdrawal } from './model/Withdrawal';
import { SettlementPolicy } from './policy/SettlementPolicy';
import { AccountCode } from './value/AccountCode';
import { AccountingDate } from './value/AccountingDate';
import { PostingReference } from './value/PostingReference';

const at = AccountingDate.of('2026-09-05T08:00:00.000Z');
const cash = Account.create('account:cash', 'mall:one', 'cash', 'CNY', 'asset');
const income = Account.create('account:income', 'mall:one', 'commerce.clearing', 'CNY', 'income');

describe('finance domain', () => {
  it('uses typed account, source reference and UTC accounting date values', () => {
    expect(AccountCode.of('settlement.payable.partner:one', 'liability').value).toBe('settlement.payable.partner:one');
    expect(() => AccountCode.of('自由 科目', 'asset')).toThrow('VALIDATION_FAILED');
    expect(at.period).toBe('2026-09');
    expect(() => AccountingDate.of('2026-09-05')).toThrow('VALIDATION_FAILED');
    expect(() => PostingReference.of({ module: 'payment', aggregate: 'payment', aggregateId: 'payment:one', event: 'voucher.redeem', eventId: 'event:one', leg: 'capture' })).toThrow('VALIDATION_FAILED');
  });

  it('posts and reverses immutable balanced journals without changing history', () => {
    const reference = posting('payment', 'payment', 'payment:one', 'payment.captured', 'event:captured', 'external.capture');
    const draft = Journal.draft({
      id: 'journal:one',
      scopeId: 'mall:one',
      reference,
      description: '支付入账',
      entries: [JournalEntry.create('entry:one', cash, 'debit', Money.of(100), at), JournalEntry.create('entry:two', income, 'credit', Money.of(100), at)],
    });
    const period = AccountingPeriod.open('mall:one', '2026-09');
    const ledger = Ledger.empty('mall:one', [cash, income]).post(draft, period, at);
    expect(ledger.balance('account:cash').minor).toBe(100);
    expect(ledger.balance('account:income').minor).toBe(100);

    const reversed = ledger.reverse('journal:one', 'journal:reverse', posting('finance', 'repair', 'repair:one', 'finance.repair.reversed', 'event:reverse', 'repair.reverse'), period, at);
    expect(reversed.balance('account:cash').minor).toBe(0);
    expect(ledger.journals[0]!.snapshot().state).toBe('posted');
    expect(() => ledger.post(draft, period, at)).toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('blocks mixed totals and closed accounting periods', () => {
    const draft = Journal.draft({
      id: 'journal:bad',
      scopeId: 'mall:one',
      reference: posting('payment', 'payment', 'payment:bad', 'payment.captured', 'event:bad', 'external.capture'),
      description: '错误入账',
      entries: [JournalEntry.create('entry:bad:one', cash, 'debit', Money.of(100), at), JournalEntry.create('entry:bad:two', income, 'credit', Money.of(99), at)],
    });
    const closed = AccountingPeriod.open('mall:one', '2026-09').requestClose('maker').decideClose('checker', true, at);
    expect(() => draft.post(AccountingPeriod.open('mall:one', '2026-09'), at)).toThrow('FINANCE_JOURNAL_UNBALANCED');
    expect(() => draft.post(closed, at)).toThrow('VALIDATION_FAILED');
    expect(() => AccountingPeriod.open('mall:one', '2026-09').requestClose('same').decideClose('same', true, at)).toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
  });

  it('requires statement conservation and reconciliation evidence before approval', () => {
    const statement = Statement.draft({
      id: 'statement:one',
      scopeId: 'mall:one',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      currency: 'CNY',
      openingMinor: 100,
      debitMinor: 50,
      creditMinor: 20,
      closingMinor: 130,
      objectRef: 'object:one',
      sha256: 'a'.repeat(64),
      generatedAt: at.instant,
      version: 1,
    });
    expect(statement.finalize().snapshot().state).toBe('final');
    expect(() => Statement.draft({ ...statement.snapshot(), closingMinor: 129 })).toThrow('FINANCE_JOURNAL_UNBALANCED');

    const received = Reconciliation.receive({
      id: 'reconciliation:one',
      scopeId: 'mall:one',
      provider: 'provider',
      partnerId: 'partner:one',
      period: '2026-09',
      statementRef: 'object:one',
      statementHash: 'a'.repeat(64),
      requestedBy: 'maker',
    });
    const balanced = received.startMatching().complete(100, 100, 0);
    expect(balanced.approve('checker').snapshot().state).toBe('approved');
    expect(() => balanced.approve('maker')).toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
    expect(received.startMatching().complete(100, 90, 1).snapshot()).toMatchObject({ state: 'difference', differenceMinor: 10 });
  });

  it('freezes deterministic settlement rounding and maker-checker money states', () => {
    const policy = new SettlementPolicy();
    expect(
      policy.allocate(10, [
        { key: 'b', weight: 1 },
        { key: 'a', weight: 1 },
        { key: 'c', weight: 1 },
      ])
    ).toEqual([
      { key: 'a', amountMinor: 3 },
      { key: 'b', amountMinor: 3 },
      { key: 'c', amountMinor: 4 },
    ]);
    const settlement = Settlement.fromSplit(
      { id: 'settlement:one', scopeId: 'mall:one', reconciliationId: 'reconciliation:one', partnerId: 'partner:one', period: '2026-09', currency: 'CNY', requestedBy: 'maker' },
      policy.split(10_001, { basisPoints: 350, invoiceBasis: 'net' })
    );
    expect(settlement.approve('checker').snapshot()).toMatchObject({ state: 'payable', amountMinor: 9_651, approvedBy: 'checker' });
    expect(() => settlement.approve('maker')).toThrow('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');

    const withdrawal = Withdrawal.submit({ id: 'withdrawal:one', scopeId: 'mall:one', settlementId: 'settlement:one', amountMinor: 9_651, currency: 'CNY', destinationRef: 'bank:one', requestedBy: 'maker' });
    expect(withdrawal.decide('checker', true).process().paid('provider:one').snapshot().state).toBe('paid');
    expect(() => withdrawal.decide('maker', true)).toThrow('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
  });

  it('keeps invoice line totals and approval separation inside the aggregate', () => {
    const invoice = Invoice.submit({
      id: 'invoice:one',
      profileId: 'profile:one',
      settlementId: 'settlement:one',
      amountMinor: 100,
      currency: 'CNY',
      kind: 'original',
      redOf: null,
      lines: [{ id: 'line:one', description: '商品', amountMinor: 100, taxMinor: 6 }],
      requestedBy: 'maker',
    });
    expect(invoice.decide('checker', true).beginIssue().issue().snapshot().state).toBe('issued');
    expect(() => invoice.decide('maker', true)).toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
    expect(() =>
      Invoice.submit({
        id: 'invoice:bad',
        profileId: 'profile:one',
        settlementId: 'settlement:one',
        amountMinor: 99,
        currency: 'CNY',
        kind: 'original',
        redOf: null,
        lines: [{ id: 'line:one', description: '商品', amountMinor: 100, taxMinor: 6 }],
        requestedBy: 'maker',
      })
    ).toThrow('VALIDATION_FAILED');
  });
});

function posting(module: string, aggregate: string, aggregateId: string, event: string, eventId: string, leg: string): PostingReference {
  return PostingReference.of({ module, aggregate, aggregateId, event, eventId, leg });
}
