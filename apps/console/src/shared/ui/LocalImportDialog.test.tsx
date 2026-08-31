import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalImportDialog } from './LocalImportDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LocalImportDialog', () => {
  it('selects a CSV, shows file metadata, reports the unavailable service, sends no request and resets after close', async () => {
    const user = userEvent.setup();
    const fetch = vi.spyOn(globalThis, 'fetch');
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: '打开导入' }));
    let dialog = await screen.findByRole('dialog', { name: '导入商品' });
    expect(within(dialog).getByText('LOCAL IMPORT PREVIEW')).toBeTruthy();
    const start = within(dialog).getByRole<HTMLButtonElement>('button', { name: '开始导入' });
    expect(start.disabled).toBe(true);

    const file = new File(['商品ID,名称\nproduct:1,员工福利'], 'products.csv', {
      type: 'text/csv',
      lastModified: new Date(2026, 7, 31, 10, 20, 30).getTime(),
    });
    await user.upload(within(dialog).getByLabelText('选择 CSV 文件'), file);

    expect(within(dialog).getByText('products.csv')).toBeTruthy();
    expect(within(dialog).getByText(`${file.size} 字节`)).toBeTruthy();
    expect(within(dialog).getByText(new Date(file.lastModified).getFullYear().toString(), { exact: false })).toBeTruthy();
    expect(start.disabled).toBe(false);
    await user.click(start);
    expect(within(dialog).getByText('导入服务尚未上线')).toBeTruthy();
    expect(within(dialog).getByText('文件未上传，生产数据没有发生变化。')).toBeTruthy();
    expect(within(dialog).getByText('IMPORT_SERVICE_UNAVAILABLE')).toBeTruthy();
    expect(within(dialog).queryByText(/导入成功/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '导入商品' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '打开导入' }));
    dialog = await screen.findByRole('dialog', { name: '导入商品' });
    expect(within(dialog).queryByText('products.csv')).toBeNull();
    expect(within(dialog).queryByText('IMPORT_SERVICE_UNAVAILABLE')).toBeNull();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: '开始导入' }).disabled).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: '导入商品' })).toBeNull();
  });
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开导入
      </button>
      <LocalImportDialog open={open} title="导入商品" resourceLabel="商品" onClose={() => setOpen(false)} />
    </>
  );
}
