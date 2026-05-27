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
        lines: 90,
        functions: 90,
        branches: 65,
        statements: 85,
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
