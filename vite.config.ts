/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
const isStorybook =
  process.env.STORYBOOK === "true" ||
  process.argv.some((arg) => arg.includes("storybook"));

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [tailwindcss(), !isStorybook && !isTest && reactRouter()].filter(
    Boolean,
  ),
  resolve: {
    mainFields: ["module", "main"],
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ["lucide-react"],
  },
  optimizeDeps: {
    include: [
      "lucide-react",
      "aria-query",
      "axe-core",
      "lz-string",
      "pretty-format",
      "@storybook/addon-vitest",
      "@storybook/react-vite",
    ],
  },
  server: {
    port: 3000,
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          deps: {
            optimizer: {
              web: {
                include: [
                  "aria-query",
                  "axe-core",
                  "lz-string",
                  "pretty-format",
                  "@storybook/addon-vitest",
                  "@storybook/react-vite",
                ],
              },
            },
          },
        },
      },
    ],
  },
});
