// @ts-nocheck
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL;
const CLERK_JS_URL = import.meta.env.VITE_CLERK_JS_URL;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          proxyUrl={PROXY_URL}
          clerkJSUrl={CLERK_JS_URL}
        >
          <App />
        </ClerkProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
