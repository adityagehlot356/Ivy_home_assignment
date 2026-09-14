import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables without filtering by prefix (server-side only)
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.IVY_API_KEY || process.env.IVY_API_KEY || '';
  const baseUrl = env.IVY_BASE_URL || process.env.IVY_BASE_URL || 'https://solve.ivy.homes';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api': {
          target: baseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader('X-API-Key', apiKey);
              }
            });
          },
        },
      },
    },
  };
});
