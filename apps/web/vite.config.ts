import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import viteReact from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({ preset: 'bun' }),
    viteReact(),
    stylex({ useCSSLayers: true }),
  ],
  server: {
    // Dev only: same-origin /api so the session cookie flows like it does
    // behind nginx in prod (nginx owns /api there; see spec §9).
    proxy: {
      '/api': process.env.SERVICE_URL ?? 'http://localhost:3001',
    },
  },
});
