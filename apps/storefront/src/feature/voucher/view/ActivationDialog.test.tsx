// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivationDialog } from './ActivationDialog';
import type { useActivationViewModel } from '../viewmodel/ActivationViewModel';

afterEach(cleanup);
function model(): ReturnType<typeof useActivationViewModel> {
  return {
    draft: { mode: 'numbersecret', number: 'VC001234', secret: 'Secret123', key: 'key:one' },
    busy: false,
    message: null,
    validation: null,
    actions: { open: vi.fn(), close: vi.fn(), mode: vi.fn(), number: vi.fn(), secret: vi.fn(), submit: vi.fn(() => Promise.resolve()) },
  };
}
describe('activation dialog', () => {
  it('provides two understandable paths, hides the secret and submits through one real action', () => {
    const viewmodel = model();
    render(<ActivationDialog viewmodel={viewmodel} verification={false} />);
    expect(screen.getByRole('dialog', { name: '激活卡券' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '卡号＋券密' })).toBeTruthy();
    expect(screen.getByLabelText('券密').getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('radio', { name: '只有券密' }));
    expect(viewmodel.actions.mode).toHaveBeenCalledWith('secret');
    fireEvent.submit(screen.getByRole('form', { name: '激活卡券' }));
    expect(viewmodel.actions.submit).toHaveBeenCalledOnce();
  });

  it('disables the whole form during submission and displays a local error without exposing technical data', () => {
    const viewmodel = { ...model(), busy: true, message: '请核对激活方式、卡号和券密。' };
    render(<ActivationDialog viewmodel={viewmodel} verification={false} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在激活…' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '关闭' }).disabled).toBe(true);
    expect(screen.getByLabelText('券密').closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('请核对');
  });

  it('hides card-number entry for secret-only activation and avoids stacking verification dialogs', () => {
    const viewmodel = model();
    const secretOnly = { ...viewmodel, draft: { ...viewmodel.draft!, mode: 'secret' as const } };
    const view = render(<ActivationDialog viewmodel={secretOnly} verification={false} />);
    expect(screen.queryByLabelText('卡号')).toBeNull();
    view.rerender(<ActivationDialog viewmodel={secretOnly} verification />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
