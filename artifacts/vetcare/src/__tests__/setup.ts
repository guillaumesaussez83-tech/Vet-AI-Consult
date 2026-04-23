import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Nettoie le DOM après chaque test.
afterEach(() => {
  cleanup();
});

// Stubs courants — fetch, localStorage par défaut en jsdom.
// Ajoute ici les mocks partagés (Clerk, API client, etc.).

// @ts-expect-error — on override window.scroll pour jsdom
globalThis.window.scroll = vi.fn();
