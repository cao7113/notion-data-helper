// Configure Vitest (https://vitest.dev/config/)

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /* for example, use global to avoid globals imports (describe, test, expect): */
    globals: true,
    exclude: [...configDefaults.exclude, "_local/*", "local*"],
    env: {
      NOTION_API_KEY: "test-notion-key",
      NOTION_DATABASE_ID: "1b1673e59ab68134a2c9f372f08077ac",
      CACHER_BEARER_AUTH_TOKEN: "test-key",
      TEST_ONLY_ENV: "test only env from vitest.config.ts",
    },
    reporters: ["verbose"],
  },
});
