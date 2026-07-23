import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 後端預設 http://localhost:8010（8000 常被 OrbStack 佔用）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
