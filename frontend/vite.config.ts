/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-i18next|i18next)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-markdown',
              test: /node_modules[\\/](react-markdown|remark-gfm|micromark|unist|vfile|bail|devlop|html-void-elements)[\\/]/,
              priority: 15,
            },
            {
              name: 'vendor-qr',
              test: /node_modules[\\/]qr-code-styling[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      // 'lcov' menghasilkan coverage/lcov.info, dibaca SonarQube lewat
      // sonar.javascript.lcov.reportPaths -- lihat docs/development_testing.md §6.
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Entrypoint murni (ReactDOM.createRoot().render()), tidak ada logic untuk diuji.
        'src/main.tsx',
      ],
    },
  },
})
