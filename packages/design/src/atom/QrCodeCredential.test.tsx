// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode, qrMatrix } from './QrCode';

describe('QrCode credential content', () => {
  it('renders a strict opaque credential when explicitly requested', () => {
    const value = `smartwing-member-code:v1:${'A'.repeat(43)}`;
    render(<QrCode value={value} content="credential" label="动态会员二维码" />);
    expect(screen.getByRole('img', { name: '动态会员二维码' })).toBeTruthy();
    expect(qrMatrix(value, 'credential').count).toBeGreaterThan(20);
  });

  it('continues to reject opaque credentials in the default link mode', () => {
    expect(() => qrMatrix('smartwing-member-code:v1:secret')).toThrow('QRCODE_VALUE_INVALID');
    expect(() => qrMatrix('smartwing-member-code:v1:line break', 'credential')).toThrow('QRCODE_VALUE_INVALID');
  });
});
