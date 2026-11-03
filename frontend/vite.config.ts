import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:8081",
    changeOrigin: true,
    timeout: 600000,
    proxyTimeout: 600000,
  },
  "/health": {
    target: "http://127.0.0.1:8081",
    changeOrigin: true,
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: apiProxy,
  },
  preview: {
    host: "::",
    port: 8080,
    proxy: apiProxy,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  json: {
    stringify: false,
  },
}));
