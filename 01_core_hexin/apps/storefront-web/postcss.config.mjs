import tailwindcss from '@tailwindcss/postcss';
import legacyWebviewCompatibility from './scripts/postcss-legacy-webview.mjs';

export default {
  plugins: [tailwindcss(), legacyWebviewCompatibility],
};
