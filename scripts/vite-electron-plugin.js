/**
 * Vite plugin for Electron to fix dynamic import paths
 * This plugin ensures that dynamic imports use relative paths in production
 */

export function electronDynamicImportFix() {
  return {
    name: 'electron-dynamic-import-fix',
    apply: 'build',
    config(config, { command }) {
      if (command === 'build') {
        return {
          build: {
            rollupOptions: {
              output: {
                // Ensure all imports use relative paths
                format: 'es',
                // Fix chunk loading paths
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                // Force relative paths for all imports
                paths: (id) => {
                  // Convert absolute paths to relative paths for Electron
                  if (id.startsWith('assets/')) {
                    return './' + id;
                  }
                  return id;
                }
              }
            }
          }
        };
      }
    },
    generateBundle(options, bundle) {
      // Post-process the generated chunks to fix import paths
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.code) {
          // Fix __vite__mapDeps paths to use relative paths
          chunk.code = chunk.code.replace(
            /__vite__mapDeps\s*=\s*\(i[^}]+\}\)/g,
            `__vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[${chunk.moduleIds.map(id => {
              const assetName = id.split('/').pop();
              if (assetName && (assetName.endsWith('.css') || assetName.endsWith('.js'))) {
                return `"./assets/${assetName}"`;
              }
              return null;
            }).filter(Boolean).join(',')}]))))=>i.map(i=>d[i].startsWith('./')?d[i]:'./'+d[i].replace(/^\\/|^[a-zA-Z]:\\\\/,''))`
          );
        }
      }
    }
  };
}

export default electronDynamicImportFix;