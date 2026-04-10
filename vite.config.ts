import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Rhythm Trainer',
          short_name: 'Rhythm',
          description: 'Professional rhythm training application',
          theme_color: '#141414',
          background_color: '#141414',
          display: 'standalone',
          icons: [
            {
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="22" fill="%23141414"/%3E%3Cpath d="M20 50 L35 50 L42 30 L58 70 L65 50 L80 50" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="22" fill="%23141414"/%3E%3Cpath d="M20 50 L35 50 L42 30 L58 70 L65 50 L80 50" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
