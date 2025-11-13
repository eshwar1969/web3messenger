import { defineConfig } from 'vite';

export default defineConfig({
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