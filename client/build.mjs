import { build } from 'vite';
import react from '@vitejs/plugin-react';

await build({
  configFile: false,
  plugins: [react()],
  build: { outDir: process.env.VITE_READ_ONLY_PREVIEW === '1' ? 'dist-preview' : 'dist', sourcemap: process.env.VITE_READ_ONLY_PREVIEW !== '1' },
});
