import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupportContext } from '../model/SupportContext';
import type { Ticket } from '../model/Ticket';
import { SupportComposer } from './SupportComposer';
import { SupportContextPanel } from './SupportContextPanel';

afterEach(cleanup);

describe('support operation visibility', () => {
  it('does not render an attachment input without the upload operation', () => {
    render(<SupportComposer draft="可以发送文本" unavailable="" sending={false} attachments={[]} attachmentAllowed={false} onDraft={vi.fn()} onSend={vi.fn()} onRetry={vi.fn()} onFile={vi.fn()} />);

    expect(screen.queryByText('添加附件')).toBeNull();
    expect(screen.getByRole('button', { name: '发送回复' })).toBeTruthy();
  });

  it('removes every unauthorized context action while preserving readable business facts', () => {
    renderPanel({});

    expect(screen.getByText('最近订单')).toBeTruthy();
    expect(screen.getByText(/已付款/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看订单' })).toBeNull();
    expect(screen.queryByRole('button', { name: '查看完整历史' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭工单' })).toBeNull();
    expect(screen.queryByLabelText('目标客服')).toBeNull();
  });

  it('explains and requests MFA before loading assignment controls', () => {
    const verify = vi.fn();
    renderPanel({ canAssign: true, onVerify: verify });

    expect(screen.queryByLabelText('目标客服')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '验证身份后转派' }));
    expect(verify).toHaveBeenCalledOnce();
  });

  it('exposes only fully authorized assignment, history, close and order actions', () => {
    renderPanel({ canAssign: true, assignmentReady: true, canReadHistory: true, canClose: true, canOpenOrder: true });

    expect(screen.getByLabelText('目标客服')).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看完整历史' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭工单' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看订单' })).toBeTruthy();
  });
});

function renderPanel(overrides: Partial<Parameters<typeof SupportContextPanel>[0]>) {
  return render(<SupportContextPanel open ticket={ticket} context={context} agents={[{ id: 'agent:two', membershipId: 'membership:two', skills: ['refund'], capacity: 5, state: 'available', version: 2 }]} busy={false} onDismiss={vi.fn()} onClose={vi.fn()} onReopen={vi.fn()} onAssign={vi.fn()} onHistory={vi.fn()} canAssign={false} assignmentReady={false} canClose={false} canReopen={false} canReadHistory={false} canOpenOrder={false} onOrder={vi.fn()} onVerify={vi.fn()} {...overrides} />);
}

const ticket: Ticket = { id: 'case:one', priority: 'high', state: 'assigned', assignedAgentId: 'agent:one', responseDueAt: '2026-09-04T01:00:00.000Z', resolutionDueAt: '2026-09-04T08:00:00.000Z', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:30:00.000Z', version: 3, conversationId: 'conversation:one', skill: 'refund', memberId: 'member:one', orderId: 'order:one', channel: 'inapp', subject: '订单退款咨询', referenceType: 'order', referenceId: 'order:one', unreadCount: 1, slaRisk: 'risk' };
const context: SupportContext = { member: { id: 'member:one', displayName: '王小翼', employeeNo: 'A001', mobileMasked: '138****0000' }, organization: { id: 'organization:one' }, orders: [{ id: 'order:one', number: 'D202609040001', state: 'paid', totalMinor: 12800 }], benefits: [{ id: 'benefit:one', state: 'active', kind: 'meal', currency: 'CNY', remainingMinor: 5000, expiresAt: null }] };
