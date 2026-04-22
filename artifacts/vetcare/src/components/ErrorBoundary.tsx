import type { ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        console.error("[ErrorBoundary]", error, info.componentStack);
      }}
      onReset={() => {
        // Optionally clear app-level state here on retry
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
