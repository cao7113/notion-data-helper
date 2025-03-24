// Configure Vitest (https://vitest.dev/config/)

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /* for example, use global to avoid globals imports (describe, test, expect): */
    globals: true,
    exclude: [...configDefaults.exclude, "_local/*"],
    env: {
      NOTION_API_KEY: "test-notion-key",
      TANSHU_API_KEY: "test-key",
      NOTION_DATABASE_ID: "1b1673e59ab68134a2c9f372f08077ac",
      TEST_ONLY_ENV: "test only from vitest.config.ts",
    },
    reporters: ["verbose"],
  },
});
