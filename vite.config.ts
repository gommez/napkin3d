import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/napkin3d/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
});
