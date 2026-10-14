import { defineConfig } from "vitest/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Same alias and build-time constant as vite.config.ts, so server hooks can be tested.
  define: {
    __AGENTSCRUM_ROOT__: JSON.stringify(resolve(__dirname, "..")),
  },
  resolve: {
    alias: {
      $scrum: resolve(__dirname, "../src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
