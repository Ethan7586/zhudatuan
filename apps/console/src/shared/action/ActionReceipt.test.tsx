import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionReceipt, type ActionReceiptState } from './ActionReceipt';

afterEach(cleanup);

describe('standard action receipt', () => {
  it.each([
    ['confirm', '确认操作', '确认发布'],
    ['stepup', '身份复核', '开始身份验证'],
    ['approval', '审批进度', '前往审批'],
  ] as const)('renders the %s gate with one real primary action', async (kind, stage, label) => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<ActionReceipt state={gate(kind, label, onPress)} />);
    expect(screen.getByText(stage)).toBeTruthy();
    expect(screen.getByText('华东福利商城')).toBeTruthy();
    expect(screen.getByText('更新公开首页，当前草稿不受影响')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: label }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('announces execution and reports durable progress', () => {
    render(<ActionReceipt state={{ kind: 'executing', title: '正在发布商城', message: '服务端任务正在执行，关闭页面不会取消任务。', requestId: 'request:one', impact: '公开首页', processed: 6, total: 10 }} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('progressbar', { name: '执行进度' }).getAttribute('value')).toBe('6');
    expect(screen.getByText('已处理 6 / 10')).toBeTruthy();
  });

  it.each([
    ['pending', '审批处理中'],
    ['approved', '审批已通过'],
    ['rejected', '审批未通过'],
    ['expired', '审批已过期'],
  ] as const)('presents the %s approval result without a placeholder action', (status, label) => {
    render(<ActionReceipt state={{ kind: 'approval', status, title: '审批发布申请', message: '审批状态来自权威审批服务。', object: '华东福利商城', impact: '审批只产生决定，发布仍由商城模块执行', reference: 'approval:one' }} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows partial counts and retries only failed work', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ActionReceipt state={{ kind: 'partial', receipt: receipt('批量发放已完成，可单独重试失败项。'), objectLabel: '发放批次', impact: '只重试失败项，不会重复发放成功项', succeeded: 18, failed: 2, skipped: 1, retry: { label: '重试 2 个失败项', tone: 'primary', onPress: retry } }} />);
    expect(screen.getByRole('heading', { name: '部分完成' })).toBeTruthy();
    expect(screen.getByText('18 项')).toBeTruthy();
    expect(screen.getByText('2 项')).toBeTruthy();
    expect(screen.getByText('1 项')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试 2 个失败项' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('exposes a safe retry receipt with request evidence', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ActionReceipt state={{ kind: 'retry', receipt: receipt('渠道暂时不可用，本次未产生业务变更。'), impact: '未推进同步游标', retry: { label: '安全重试', tone: 'primary', onPress: retry } }} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('request:one')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '安全重试' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

function gate(kind: 'confirm' | 'stepup' | 'approval', label: string, onPress: () => void): ActionReceiptState {
  const context = { title: '发布商城', message: '请完成当前步骤后继续。', object: '华东福利商城', impact: '更新公开首页，当前草稿不受影响' } as const;
  if (kind === 'confirm') return { ...context, kind, confirm: { label, tone: 'primary', onPress } };
  if (kind === 'stepup') return { ...context, kind, verify: { label, tone: 'primary', onPress } };
  return { ...context, kind, status: 'required', approval: { label, tone: 'primary', onPress } };
}

function receipt(message: string) {
  return Object.freeze({ requestId: 'request:one', reference: 'batch:one', occurredAt: '2026-09-07T08:00:00.000Z', message });
}
