import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qrMatrix } from '@shop/design/atom/QrCode';
import jsQR from 'jsqr';

test('independent decoder recovers the exact canonical mall URL', () => {
  const expected = 'https://fufu.wang/s/zhudatuan-employee';
  const matrix = qrMatrix(expected);
  const scale = 8;
  const extent = matrix.count + matrix.quiet * 2;
  const width = extent * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const row = Math.floor(y / scale) - matrix.quiet;
      const column = Math.floor(x / scale) - matrix.quiet;
      const dark = row >= 0 && row < matrix.count && column >= 0 && column < matrix.count && matrix.modules[row]?.[column] === true;
      const offset = (y * width + x) * 4;
      const color = dark ? 0 : 255;
      pixels[offset] = color;
      pixels[offset + 1] = color;
      pixels[offset + 2] = color;
      pixels[offset + 3] = 255;
    }
  }

  const decoded = jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' });
  assert.equal(decoded?.data, expected);
});
