import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  server: {
    port: 41008,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:42008',
        changeOrigin: true
      }
    }
  }
});
