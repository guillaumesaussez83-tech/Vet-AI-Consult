import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;
const isBuild = process.argv.includes("build");
const isDev = process.env.NODE_ENV !== "production" && !isBuild;

if (!rawPort && !isBuild) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort ?? "21313");

if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

/**
 * F-P2-2 : plugins Replit chargés UNIQUEMENT en dev.
 * L'overlay d'erreur runtime n'a rien à faire en prod (leak de stack trace,
 * et DX dégradée pour les users finaux).
 */
export default defineConfig(async () => {
  const devPlugins = [];
  if (isDev) {
    const { default: runtimeErrorOverlay } = await import(
      "@replit/vite-plugin-runtime-error-modal"
    );
    devPlugins.push(runtimeErrorOverlay());
    if (process.env.REPL_ID !== undefined) {
      const cartographer = await import("@replit/vite-plugin-cartographer");
      const devBanner = await import("@replit/vite-plugin-dev-banner");
      devPlugins.push(
        cartographer.cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
      );
      devPlugins.push(devBanner.devBanner());
    }
  }

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...devPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      "@clerk/clerk-react": "@clerk/react",
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: isBuild ? "hidden" : false, // sourcemaps uploadés à Sentry, pas servis aux clients
      rollupOptions: {
        output: {
          manualChunks: {
            // F-P2-3 : split des libs lourdes pour réduire le main bundle.
            recharts: ["recharts"],
            pdf: ["html2pdf.js"],
            clerk: ["@clerk/react"],
          },
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
