import { defineConfig } from 'vite';

// `base: './'` makes every asset path relative, so the built site works
// no matter what the GitHub repository (and therefore the Pages URL) is called.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
