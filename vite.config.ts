import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative, so the build works on any GitHub Pages
// sub-path (https://<user>.github.io/<repo>/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
});
