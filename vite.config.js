import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL || "http://localhost:3001";
  const intelligenceUrl = env.VITE_INTELLIGENCE_URL || env.INTELLIGENCE_URL || "http://127.0.0.1:8000";
  const port = parseInt(env.VITE_PORT || env.PORT || "5173", 10);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        "/api/ml": {
          target: intelligenceUrl,
          changeOrigin: true,
        },
        "/api/assistant": {
          target: intelligenceUrl,
          changeOrigin: true,
        },
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
        "/health": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  };
});

