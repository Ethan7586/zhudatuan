// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LegalAgreement } from '../../src/shared/ui/LegalAgreement';
import { bootstrap } from '../TestData';

describe('legal agreement journey', () => {
  it('offers one large agreement target and keeps policy actions outside its label', async () => {
    const accept = vi.fn();
    const user = userEvent.setup();
    render(<LegalAgreement policy={bootstrap.legal} accepted={false} busy={false} onAccepted={accept} />);

    const checkbox = screen.getByRole('checkbox', { name: /我已阅读并同意/ });
    await user.click(screen.getByText('我已阅读并同意'));
    expect(accept).toHaveBeenCalledWith(true);
    const terms = screen.getByRole('button', { name: '服务协议' });
    const privacy = screen.getByRole('button', { name: '隐私政策' });
    expect(terms.closest('label')).toBeNull();
    expect(privacy.closest('label')).toBeNull();
    expect(checkbox.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('binds an agreement issue directly to the checkbox', () => {
    render(<LegalAgreement policy={bootstrap.legal} accepted={false} busy={false} error="请先阅读并同意服务协议与隐私政策。" onAccepted={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox', { name: /我已阅读并同意/ });
    const errorId = checkbox.getAttribute('aria-errormessage');
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)?.textContent).toBe('请先阅读并同意服务协议与隐私政策。');
  });
});
