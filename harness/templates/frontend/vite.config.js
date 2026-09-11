import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버는 5173, API는 파이썬 백엔드(8080)로 프록시한다.
// 빌드 산출물(dist)은 그 백엔드가 정적으로 서빙한다.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true } },
  },
});

