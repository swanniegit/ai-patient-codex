import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["codex/tests/**/*.test.ts"],
    globals: true,
  },
});
