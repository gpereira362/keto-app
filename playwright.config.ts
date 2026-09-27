import { defineConfig, devices } from '@playwright/test';

// Pruebas de flujo sobre la app compilada (así también se prueba el modo sin conexión).
// Usa Microsoft Edge instalado en Windows; en otro sistema: `npx playwright install chromium` y quitar `channel`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    channel: 'msedge',
    locale: 'es-ES',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
