// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Barcode, code128Bars } from './Barcode';

describe('Barcode', () => {
  it('renders a labelled Code 128B image without exposing text nodes', () => {
    render(<Barcode value="smartwing-member-code:v1:test" label="动态会员条形码" />);
    expect(screen.getByRole('img', { name: '动态会员条形码' })).toBeTruthy();
    expect(screen.queryByText('smartwing-member-code:v1:test')).toBeNull();
    expect(code128Bars('AB').width).toBeGreaterThan(40);
  });

  it('rejects multiline and non-printable content', () => {
    expect(() => code128Bars('line\nbreak')).toThrow('BARCODE_VALUE_INVALID');
  });
});
