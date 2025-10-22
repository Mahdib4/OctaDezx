import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: [
            "@radix-ui/react-dialog", 
            "@radix-ui/react-dropdown-menu", 
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog"
          ],
          forms: ["react-hook-form", "zod", "@hookform/resolvers"],
          utils: ["date-fns", "clsx", "class-variance-authority", "tailwind-merge"]
        }
      }
    }
  },
  preview: {
    port: 4173,
    host: true
  }
}));