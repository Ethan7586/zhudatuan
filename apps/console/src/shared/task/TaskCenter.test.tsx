import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskCenter } from './TaskCenter';

afterEach(cleanup);

describe('global task center', () => {
  it('shows the five business task categories, durable progress and destinations', async () => {
    const user = userEvent.setup();
    const source = vi.fn();
    const tasks = [
      task('import', '导入商品', 25, 100, '查看任务收据'),
      task('export', '导出报表', 10, 10, '返回来源页'),
      task('sync', '同步库存', 60, 100, '返回来源页'),
      task('issuance', '发放卡券', 40, 80, '返回来源页'),
      task('reconciliation', '核对账单', 15, 30, '返回来源页'),
    ] as const;
    render(<TaskCenter model={{
      items: tasks,
      active: 5,
      failed: 0,
      loading: false,
      denied: false,
      error: undefined,
      actions: { refresh: vi.fn(), center: vi.fn(), source },
    }} />);

    await user.click(screen.getByRole('button', { name: '全局任务中心，5 个任务进行中' }));
    for (const category of ['导入', '导出', '同步', '发放', '对账']) expect(screen.getByText(category)).toBeTruthy();
    expect(screen.getByText('正在执行 · 已处理 25 / 100 · 25%')).toBeTruthy();
    expect(screen.getByText('查看任务收据')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /导入，导入商品，正在执行，查看任务收据/ }));
    expect(source).toHaveBeenCalledExactlyOnceWith(tasks[0]);
    expect(screen.queryByRole('dialog', { name: '全局任务中心' })).toBeNull();
  });

  it('announces simultaneous active and failed work and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<TaskCenter model={{
      items: [task('sync', '同步商品', 2, 10, '返回来源页', 'failed')],
      active: 2,
      failed: 1,
      loading: false,
      denied: false,
      error: undefined,
      actions: { refresh: vi.fn(), center: vi.fn(), source: vi.fn() },
    }} />);

    await user.click(screen.getByRole('button', { name: '全局任务中心，2 个进行中，1 个失败' }));
    expect(screen.getByText('2 个正在处理 · 1 个需要关注')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '全局任务中心' })).toBeNull();
  });
});

function task(category: 'import' | 'export' | 'sync' | 'issuance' | 'reconciliation', title: string, processed: number, total: number, destination: string, state = 'running') {
  return Object.freeze({ id: `${category}:one`, type: category === 'import' || category === 'export' ? category : 'job', title, state, processed, total, category, destination });
}
