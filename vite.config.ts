/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((arg) => arg.includes("storybook"));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    tailwindcss(),
    !isStorybook && !isTest && reactRouter(),
  ].filter(Boolean),
  resolve: {
    tsconfigPaths: true
  },
  optimizeDeps: {
    include: [
      'aria-query',
      'axe-core',
      'lz-string',
      'pretty-format',
      '@storybook/addon-vitest',
      '@storybook/react-vite',
    ],
  },
  server: {
    port: 8080
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })
      ],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        },
        deps: {
          optimizer: {
            web: {
              include: [
                'aria-query',
                'axe-core',
                'lz-string',
                'pretty-format',
                '@storybook/addon-vitest',
                '@storybook/react-vite',
              ]
            }
          }
        }
      }
    }]
  }
});
