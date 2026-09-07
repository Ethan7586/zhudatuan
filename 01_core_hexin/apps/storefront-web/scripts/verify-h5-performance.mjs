import { readFile } from 'node:fs/promises';
import { brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const manifestUrl = new URL('../dist/server/__vite_rsc_assets_manifest.js', import.meta.url);
const clientRootUrl = new URL('../dist/client/', import.meta.url);
const manifest = (await import(manifestUrl.href)).default;
const h5Entry = Object.values(manifest.clientReferenceDeps).find((entry) => (
  entry.js.some((asset) => asset.includes('H5StorefrontRoot-'))
));

if (!h5Entry) throw new Error('H5 initial dependency set was not found');

const initialAssets = [...new Set(h5Entry.js)];
const deferredFeatures = [
  'H5WechatIdentityBridge-',
  'MPCartPage-',
  'MPCategoryPage-',
  'MPDetailPage-',
  'MPProfilePage-',
  'MobileOrdersPage-',
  'PendingInterfaceModal-',
  'PaymentPhoneVerificationModal-',
  'PaymentResultPage-',
  'ToastContainer-',
  'productionApi-',
];
const leakedFeature = deferredFeatures.find((feature) => initialAssets.some((asset) => asset.includes(feature)));

if (leakedFeature) throw new Error(`${leakedFeature} must stay outside the H5 initial script set`);

let brotliBytes = 0;
for (const asset of initialAssets) {
  const assetUrl = new URL(asset.replace(/^\//, ''), clientRootUrl);
  brotliBytes += brotliCompressSync(await readFile(fileURLToPath(assetUrl))).byteLength;
}

const budgetBytes = 110 * 1024;
if (brotliBytes > budgetBytes) {
  throw new Error(`H5 initial JavaScript is ${(brotliBytes / 1024).toFixed(1)} KiB Brotli; budget is ${budgetBytes / 1024} KiB`);
}

console.log(`H5 initial JavaScript verified: ${(brotliBytes / 1024).toFixed(1)} KiB Brotli across ${initialAssets.length} bundles`);
