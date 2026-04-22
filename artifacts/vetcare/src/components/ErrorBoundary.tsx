import type { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => (
        <ErrorFallback
          error={props.error as Error}
          resetErrorBoundary={props.resetError}
        />
      )}
      onError={(error, info) => {
        console.error("[ErrorBoundary]", error, info.componentStack);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
