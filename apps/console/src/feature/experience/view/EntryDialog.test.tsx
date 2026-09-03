import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Experience } from '../model/Experience';
import { EntryDialog } from './EntryDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EntryDialog', () => {
  it('shows the ready QR, canonical URL and exactly three entry operations', async () => {
    render(<EntryDialog record={experience('ready')} onClose={() => undefined} />);
    expect(await screen.findByRole('img', { name: '鸿泰惠民通商城二维码' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://fufu.wang/s/benefits' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '复制链接' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下载二维码' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新窗口打开商城' })).toBeTruthy();
  });

  it.each([
    ['unpublished', '发布后可扫码'],
    ['disabled', '商城已停用'],
  ] as const)('does not render or offer a QR while state is %s', (state, message) => {
    render(<EntryDialog record={experience(state)} onClose={() => undefined} />);
    expect(screen.getByText(new RegExp(message))).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: '下载二维码' })).toBeNull();
  });

  it('fails closed and exposes the low-cardinality request identifier', () => {
    render(<EntryDialog record={experience('invalid')} onClose={() => undefined} />);
    expect(screen.getAllByText(/请求 \d{4} \d{4}/)).toHaveLength(2);
    expect(screen.queryByText(/trace:entry-invalid/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('reports clipboard success and an actionable fallback on failure', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const view = render(<EntryDialog record={experience('ready')} onClose={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: '复制链接' }));
    expect(writeText).toHaveBeenCalledWith('https://fufu.wang/s/benefits');
    expect(screen.getByText('商城链接已复制')).toBeTruthy();

    view.unmount();
    writeText.mockRejectedValueOnce(new Error('DENIED'));
    render(<EntryDialog record={experience('ready')} onClose={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: '复制链接' }));
    expect(screen.getByText(/手动复制/)).toBeTruthy();
  });

  it('downloads a 1024 PNG with a safe mall filename and releases both object URLs', async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:svg').mockReturnValueOnce('blob:png');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal(
      'Image',
      class {
        decoding = 'auto';
        src = '';
        decode() {
          return Promise.resolve();
        }
      }
    );
    const context = { imageSmoothingEnabled: true, fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });

    render(<EntryDialog record={{ ...experience('ready'), name: '鸿泰/惠民:通' }} onClose={() => undefined} />);
    await user.click(await screen.findByRole('button', { name: '下载二维码' }));

    expect(downloaded).toBe('鸿泰惠民通-商城码.png');
    expect(create).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith('blob:svg');
    expect(revoke).toHaveBeenCalledWith('blob:png');
    expect(screen.getByText('二维码已下载')).toBeTruthy();
  });

  it('opens and closes one thousand times without retaining dialogs or object URLs', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const view = render(<EntryDialog record={experience('ready')} onClose={() => undefined} />);
    expect(await screen.findByRole('img', { name: '鸿泰惠民通商城二维码' })).toBeTruthy();
    for (let index = 0; index < 1_000; index += 1) {
      view.rerender(<EntryDialog record={null} onClose={() => undefined} />);
      view.rerender(<EntryDialog record={experience('ready')} onClose={() => undefined} />);
    }
    view.rerender(<EntryDialog record={null} onClose={() => undefined} />);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
  }, 15_000);
});

function experience(state: Experience['entry']['state']): Experience {
  const base = { handle: 'benefits', url: 'https://fufu.wang/s/benefits' } as const;
  const entry: Experience['entry'] =
    state === 'ready' ? { ...base, state, releaseId: 'release:benefits', releaseVersion: 'version:benefits', contentHash: 'a'.repeat(64) } : state === 'invalid' ? { ...base, state, requestId: 'trace:entry-invalid' } : { ...base, state };
  return {
    id: 'application:benefits',
    mallId: 'mall:benefits',
    code: 'BENEFITS',
    publicSlug: 'benefits',
    name: '鸿泰惠民通',
    status: state === 'disabled' ? 'disabled' : 'active',
    version: 8,
    headSequence: 8,
    publishedSequence: state === 'unpublished' ? null : 8,
    entry,
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}
