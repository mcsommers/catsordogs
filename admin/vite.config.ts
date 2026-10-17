import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site lives at /admin on whatever host it is served from.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
