import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // pdf-lib + fontkit + pdf.js; acceptable for an internal tool.
  build: { chunkSizeWarningLimit: 2500 },
});
