import type { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
  children: ReactNode;
  /**
   * F-P1-5 : chaque ErrorBoundary peut avoir une "boundary key" (ex: nom de
   * route) pour que Sentry group les errors par section plutôt que
   * globalement.
   */
  boundaryKey?: string;
}

export function ErrorBoundary({ children, boundaryKey }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => (
        <ErrorFallback
          error={props.error as Error}
          resetErrorBoundary={props.resetError}
        />
      )}
      beforeCapture={(scope) => {
        if (boundaryKey) scope.setTag("boundary", boundaryKey);
      }}
      onError={(error, info) => {
        // eslint-disable-next-line no-console
        console.error("[ErrorBoundary]", boundaryKey ?? "root", error, info.componentStack);
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
