import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.VERCEL === "1" ? "/" : "/napkin3d/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
});
