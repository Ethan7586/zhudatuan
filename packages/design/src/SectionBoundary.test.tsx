// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBoundary } from './SectionBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SectionBoundary', () => {
  it('contains a failed panel and keeps sibling content usable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <main>
        <p>仍可使用的表格</p>
        <SectionBoundary title="详情暂时无法显示">
          <Broken />
        </SectionBoundary>
      </main>
    );
    expect(screen.getByText('仍可使用的表格')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('详情暂时无法显示');
    expect(screen.getByRole('alert').textContent).not.toContain('RAW_DRAWER_FAILURE');
  });

  it('supports a local retry without reloading the application', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let broken = true;
    function Recoverable() {
      if (broken) throw new Error('RAW_DRAWER_FAILURE');
      return <p>详情已恢复</p>;
    }
    render(
      <SectionBoundary>
        <Recoverable />
      </SectionBoundary>
    );
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.getByText('详情已恢复')).toBeTruthy();
  });
});

function Broken(): never {
  throw new Error('RAW_DRAWER_FAILURE');
}
