import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    // Fix Cross-Origin-Opener-Policy blocking Google Sign-In popup
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://api:8000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});
