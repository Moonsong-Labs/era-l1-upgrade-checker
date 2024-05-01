import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest-setup.js"],
    testTimeout: 30000,
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  },
});
