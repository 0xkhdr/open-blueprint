import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      NODE_ENV: "test",
    },
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 88,
        functions: 89,
        branches: 75,
        statements: 87,
      },
      exclude: [
        "node_modules",
        "dist",
        "tests",
        "src/cli/ui/**",
        "src/cli/commands/**",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
