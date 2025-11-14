// This file is deprecated - using Next.js instead of Vite
// Configuration moved to next.config.js

/*
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configuración para manejar dependencias problemáticas
  optimizeDeps: {
    exclude: ['@xmtp/wasm-bindings', '@xmtp/browser-sdk'],
    include: ['@xmtp/proto', 'protobufjs/minimal']
  },

  // Resolver módulos CommonJS correctamente
  resolve: {
    alias: {
      // Forzar la versión correcta de protobufjs
      'protobufjs/minimal': 'protobufjs/minimal.js'
    }
  },

  // Headers necesarios para SharedArrayBuffer (requerido por XMTP V3)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },

  // Configuración de build para producción
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});
*/
