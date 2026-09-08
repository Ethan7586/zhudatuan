import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QrCode, qrMatrix } from './QrCode';

describe('QrCode', () => {
  it('produces a deterministic square matrix with a four-module quiet zone', () => {
    const first = qrMatrix('https://fufu.wang/s/mall-one');
    expect(first).toEqual(qrMatrix('https://fufu.wang/s/mall-one'));
    expect(first.count).toBeGreaterThan(20);
    expect(first.modules).toHaveLength(first.count);
    expect(first.quiet).toBe(4);
  });

  it('allows only HTTPS and the explicit 127.0.0.1 development exception', () => {
    expect(qrMatrix('http://127.0.0.1:3000/s/mall-one').count).toBeGreaterThan(20);
    expect(() => qrMatrix('http://fufu.wang/s/mall-one')).toThrow('QRCODE_VALUE_INVALID');
    expect(() => qrMatrix('http://localhost:3000/s/mall-one')).toThrow('QRCODE_VALUE_INVALID');
    expect(() => qrMatrix('https://user@fufu.wang/s/mall-one')).toThrow('QRCODE_VALUE_INVALID');
    expect(() => qrMatrix(`https://fufu.wang/s/${'a'.repeat(2048)}`)).toThrow('QRCODE_VALUE_INVALID');
  });

  it('renders an accessible image primitive', () => {
    const result = renderToStaticMarkup(<QrCode value="https://fufu.wang/s/mall-one" label="主商城二维码" />);
    expect(result).toContain('role="img"');
    expect(result).toContain('aria-label="主商城二维码"');
    expect(result).toContain('fill="white"');
    expect(result).toContain('fill="black"');
  });
});
