import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Config Vitest pour le front.
 * F-P2-7 : permettre l'ajout progressif de tests unitaires + tests composants.
 *
 * À installer avant usage :
 *   pnpm --filter @workspace/vetcare add -D vitest @vitejs/plugin-react \
 *        @testing-library/react @testing-library/user-event \
 *        @testing-library/jest-dom jsdom
 *
 * Script à ajouter dans artifacts/vetcare/package.json :
 *   "test": "vitest",
 *   "test:run": "vitest --run"
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
