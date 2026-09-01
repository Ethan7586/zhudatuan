import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import { parseStorefrontEntryUrl, parseStorefrontHandle } from '@shop/contract';
import { qrMatrix } from '@shop/design/qrcode';
import jsQR from 'jsqr';

const target = process.env.SHOP_SMOKE_MALL_URL;
if (!target) throw new Error('SHOP_SMOKE_MALL_URL_REQUIRED');
const parsed = new URL(target);
const prefix = `${NETWORK_CATALOG.storefront.entryPath}/`;
if (parsed.origin !== NETWORK_CATALOG.origins.storefront || !parsed.pathname.startsWith(prefix) || parsed.search || parsed.hash) throw new Error('SHOP_SMOKE_MALL_URL_INVALID');
const handle = parseStorefrontHandle(parsed.pathname.slice(prefix.length));
const url = parseStorefrontEntryUrl(target, NETWORK_CATALOG.origins.storefront, NETWORK_CATALOG.storefront.entryPath, handle);
const signal = AbortSignal.timeout(15_000);

const decoded = decode(url);
if (decoded !== url) throw new Error('MALL_ENTRY_QR_DECODE_FAILED');

const [page, bootstrap] = await Promise.all([
  fetch(url, { redirect: 'error', signal, headers: { accept: 'text/html' } }),
  fetch(`${NETWORK_CATALOG.origins.api}/api/v1/storefront/bootstrap`, {
    redirect: 'error',
    signal,
    headers: { accept: 'application/json', 'x-storefront-handle': handle },
  }),
]);
if (!page.ok || !(page.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`MALL_ENTRY_PAGE_FAILED:${page.status}`);
if (!bootstrap.ok || !(bootstrap.headers.get('content-type') ?? '').includes('application/json')) throw new Error(`MALL_ENTRY_BOOTSTRAP_FAILED:${bootstrap.status}`);
const body: unknown = await bootstrap.json();
if (!validBootstrap(body, handle, url)) throw new Error('MALL_ENTRY_BINDING_INVALID');
console.log(`mall entry smoke passed: handle=${handle} page=${page.status} bootstrap=${bootstrap.status} qr=decoded`);

function decode(value: string): string | undefined {
  const matrix = qrMatrix(value);
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
  return jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' })?.data;
}

function validBootstrap(value: unknown, handle: string, url: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = Reflect.get(value, 'entry');
  const binding = Reflect.get(value, 'binding');
  return (
    entry !== null &&
    typeof entry === 'object' &&
    Reflect.get(entry, 'handle') === handle &&
    Reflect.get(entry, 'url') === url &&
    binding !== null &&
    typeof binding === 'object' &&
    ['application', 'mall', 'pool', 'release', 'version', 'tenant'].every((key) => typeof Reflect.get(binding, key) === 'string' && String(Reflect.get(binding, key)).length > 0)
  );
}
