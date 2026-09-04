import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReferralCommission, ReferralWithdrawal } from '../model/Referral';
import { promotionViewModel } from '../viewmodel/PromotionViewModel';
import { withdrawalViewModel } from '../viewmodel/WithdrawalViewModel';
import { PromotionTable } from './PromotionTable';
import { WithdrawalTable } from './WithdrawalTable';

afterEach(cleanup);

describe('referral finance references', () => {
  it('keeps commission state, attribution and settlement journal together', () => {
    render(<PromotionTable model={promotionViewModel([commission('settled', 'journal:commission:1')])} />);

    const table = screen.getByRole('table', { name: '推广详情' });
    expect(within(table).getByText('已结算')).toBeTruthy();
    expect(columnText(table, 'attribution')).toContain('绑定');
    expect(columnText(table, 'attribution')).toContain('规则');
    expect(columnText(table, 'journal')).toContain('账本凭证');
    expect(table.textContent).not.toContain('journal:commission:1');
  });

  it('makes unsettled commission state explicit', () => {
    render(<PromotionTable model={promotionViewModel([commission('available', null)])} />);

    expect(screen.getByText('可结算')).toBeTruthy();
    expect(columnText(screen.getByRole('table', { name: '推广详情' }), 'journal')).toBe('尚未入账');
  });

  it('keeps withdrawal state, approval and payment reference together', () => {
    render(<WithdrawalTable model={withdrawalViewModel([withdrawal('paid', 'journal:withdrawal:1')])} />);

    const table = screen.getByRole('table', { name: '佣金提现' });
    expect(within(table).getByText('已付款')).toBeTruthy();
    expect(columnText(table, 'references')).toContain('审批');
    expect(columnText(table, 'references')).toContain('付款凭证');
    expect(table.textContent).not.toContain('journal:withdrawal:1');
  });

  it('makes unpaid withdrawal state explicit', () => {
    render(<WithdrawalTable model={withdrawalViewModel([withdrawal('processing', null)])} />);

    expect(screen.getByText('处理中')).toBeTruthy();
    expect(columnText(screen.getByRole('table', { name: '佣金提现' }), 'references')).toContain('尚未付款入账');
  });
});

function commission(status: ReferralCommission['status'], settlementJournalId: string | null): ReferralCommission {
  return {
    id: 'commission:1', orderId: 'order:1', orderLineId: 'orderline:1', ruleId: 'rule:1', ruleVersion: 3,
    attributionId: 'binding:1', promoterId: 'member:promoter', kind: 'commission', status,
    amountMinor: 1288, baseMinor: 12880, refundedBaseMinor: 0, reversedMinor: 0,
    rateBasisPoints: 1000, currency: 'CNY', availableAt: '2026-09-07T00:00:00.000Z', settlementJournalId, version: 4,
  };
}

function withdrawal(status: ReferralWithdrawal['status'], providerReference: string | null): ReferralWithdrawal {
  return {
    id: 'withdrawal:1', memberId: 'member:promoter', status, amountMinor: 1000, currency: 'CNY',
    accountRef: 'account:1', approvalId: 'approval:1', requestedAt: '2026-09-07T00:00:00.000Z',
    approvedAt: '2026-09-07T00:01:00.000Z', completedAt: status === 'paid' ? '2026-09-07T00:02:00.000Z' : null,
    providerReference, failureReason: null, version: 2,
  };
}

function columnText(table: HTMLElement, column: string): string {
  return table.querySelector(`tbody [data-column="${column}"]`)?.textContent ?? '';
}
