/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // When the Spring Boot backend exists, requests to /api are passed to it.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    // MapLibre alone is about 1 MB. It is already loaded separately from the
    // rest of the app (see App.tsx), so the default 500 kB warning is noise.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
