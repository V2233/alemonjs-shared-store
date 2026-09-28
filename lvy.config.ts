import { defineConfig } from 'lvyjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  watch: ['src/**/*.{ts,tsx,js,jsx,json,html}'],
  alias: {
    entries: [{ find: '@src', replacement: join(__dirname, 'src') }],
  },
  build: {
    tsdown: {
      dts: true,
      tsconfig: 'tsconfig.alemonjs.json',
    },
  },
});
