import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';

import pkgJson from './package.json';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    base: `/apps/${pkgJson.name}/`,
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: '@',
          replacement: fileURLToPath(new URL('./web', import.meta.url)),
        },
      ],
    },
    esbuild: {
      drop: isDev ? [] : ['console', 'debugger'],
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      minify: 'oxc',
      rolldownOptions: {
        output: {
          dir: './dist',
          entryFileNames: `assets/index.js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
    },
    server: {
      watch: {
        include: ['./web/**', 'vite.config.ts'],
      },
      port: 5173,
      proxy: {
        [`/apps/${pkgJson.name}/api`]: {
          target: 'http://localhost:17187',
          changeOrigin: true,
        },
      },
    },
  };
});
