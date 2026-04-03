import { defineConfig } from 'vite';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});
