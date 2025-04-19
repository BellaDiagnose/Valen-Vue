import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.js'],  // Pattern for test files
    // You can add specific test file paths here if needed
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './source'),
    },
  },
});
