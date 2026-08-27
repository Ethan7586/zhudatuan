import { defineConfig } from 'vitest/config';

export default defineConfig({
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:3001'),
    'import.meta.env.VITE_AUTH_BASE_URL': JSON.stringify('http://127.0.0.1:3002'),
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify('0.0.0-test'),
  },
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:3001'),
    'import.meta.env.VITE_AUTH_BASE_URL': JSON.stringify('http://127.0.0.1:5176'),
    'import.meta.env.VITE_CLIENT_VERSION': JSON.stringify('0.0.0-test'),
  },
>>>>>>> 65499ddc (chore: finalize main baseline and restore API boundaries)
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});
