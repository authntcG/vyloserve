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
