import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// plugin-react가 있어야 JSX가 자동 런타임으로 변환된다. 없으면 빌드 산출물이
// 'React is not defined'로 죽는다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
  },
});
