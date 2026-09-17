import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IdentityBadge } from './IdentityBadge';

describe('IdentityBadge', () => {
  it('renders the backend display hint', () => {
    render(<IdentityBadge hint={{ kind: 'operator', code: 'OP-7K2M8Q', label: '管理身份', maskedMobile: '134****7586' }} fallback="7586" />);
    expect(screen.getByText(/管理身份 ·/).textContent).toContain('OP-7K2M8Q');
    expect(screen.getByText(/管理身份 ·/).textContent).toContain('134****7586');
  });

  it('preserves the existing display when the field is absent', () => {
    render(<IdentityBadge hint={undefined} fallback="高级管理员 · 7586" />);
    expect(screen.getByText('高级管理员 · 7586')).toBeTruthy();
  });
});
