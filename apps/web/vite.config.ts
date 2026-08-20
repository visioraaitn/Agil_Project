import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), '');

  if (command === 'build' && mode === 'production' && !env.VITE_API_URL) {
    throw new Error('VITE_API_URL is required for a production frontend build.');
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    // Le .env est à la racine du monorepo, partagé avec l'API.
    envDir: '../../',
  };
});
