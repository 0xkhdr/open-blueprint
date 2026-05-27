import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
      exclude: [
        "node_modules",
        "dist",
        "tests",
        "src/cli/ui/**",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
