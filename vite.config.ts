import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@core': resolve(__dirname, 'src/core'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@components': resolve(__dirname, 'src/renderer/components'),
      '@hooks': resolve(__dirname, 'src/renderer/hooks'),
      '@stores': resolve(__dirname, 'src/renderer/stores'),
      '@utils': resolve(__dirname, 'src/shared/utils'),
      '@types': resolve(__dirname, 'src/shared/types'),
    },
  },

  // Build optimization
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'state-vendor': ['zustand', 'immer'],
        },
      },
    },
    // Enable source maps for debugging
    sourcemap: true,
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },

  // Development server
  server: {
    port: 5173,
    strictPort: true,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
  },
});
