import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import obfuscator from 'vite-plugin-javascript-obfuscator';

// Electron-specific Vite config
export default defineConfig({
  // 在生产环境集成 JavaScript 混淆插件，确保打包后代码为“乱码”不可读
  // 开发环境不启用以保证调试体验
  plugins: [
    react(),
    // 仅在生产模式下启用混淆
    obfuscator({
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      disableConsoleOutput: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      renameGlobals: true,
      rotateStringArray: true,
      selfDefending: true,
      transformObjectKeys: true,
      unicodeEscapeSequence: true,
      // 生产环境开启，开发环境关闭由插件自动根据模式处理
    })
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },

  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'state-vendor': ['zustand', 'immer'],
        },
      },
    },
    // 生产环境关闭 sourcemap，防止源码泄露；开发环境保持开启
    sourcemap: process.env.NODE_ENV !== 'production',
  },

  server: {
    port: 5173,
    strictPort: true,
  },
});
