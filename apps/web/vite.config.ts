import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const enablePWA = env.VITE_ENABLE_PWA === "true";

  return {
    plugins: [
      tailwindcss(),
      TanStackRouterVite({}),
      react(),
      VitePWA({
        disable: !enablePWA,
        selfDestroying: !enablePWA,
        registerType: "autoUpdate",
        manifest: {
          name: "my-better-t-app",
          short_name: "my-better-t-app",
          description: "my-better-t-app - PWA Application",
          theme_color: "#0c0c0c",
        },
        pwaAssets: {
          disabled: !enablePWA,
          config: enablePWA,
        },
        devOptions: {
          enabled: enablePWA,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/trpc": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
