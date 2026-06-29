import { defineConfig } from "vitest/config";

// Unit tests cover the pure data layer (status, contract, storage migration).
// jsdom supplies localStorage for the storage tests; no React rendering needed.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
