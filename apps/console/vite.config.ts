import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: { manifest: true },
    server: {
<<<<<<< HEAD
<<<<<<< HEAD
      port: 4173,
=======
      port: 5173,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      port: 4173,
>>>>>>> 018b2a71 (chore(release): capture current production source)
      /**
       * In production Caddy reverse-proxies smart.hbbtzn.com/api/* to the commerce
       * runtime. The dev server must do the same or every authenticated request
       * would hit the Vite server itself and fail.
       */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
      // Automated environments may disable HMR and watching to reduce background work.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
