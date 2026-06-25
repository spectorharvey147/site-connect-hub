import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split("\\").join("/");
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("@supabase")) {
            return "supabase";
          }
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react-core";
          }
          if (
            normalizedId.includes("/node_modules/react-router/") ||
            normalizedId.includes("/node_modules/react-router-dom/")
          ) {
            return "router";
          }
          if (id.includes("recharts") || id.includes("/d3-")) {
            return "charts";
          }
          if (id.includes("jspdf") || id.includes("fflate")) {
            return "pdf";
          }
          if (id.includes("html2canvas")) {
            return "html-canvas";
          }
          if (id.includes("dompurify")) {
            return "sanitize";
          }
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("/zod/")
          ) {
            return "forms";
          }
          if (id.includes("lucide-react")) {
            return "icons";
          }
          return "vendor";
        },
      },
    },
  },
});
