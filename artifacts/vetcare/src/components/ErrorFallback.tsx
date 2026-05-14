import type { FallbackProps } from "react-error-boundary";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-background px-4"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Une erreur inattendue s'est produite
          </h1>
          <p className="text-sm text-muted-foreground">
            Désolé, quelque chose s'est mal passé. Vous pouvez réessayer ou
            revenir à l'accueil.
          </p>
        </div>

        {error?.message && (
          <details className="text-left bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              Détails techniques
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono">
              {error.message}
            </pre>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={resetErrorBoundary} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Réessayer
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Retour à l'accueil
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Si l'erreur persiste, contactez le support VétoAI.
        </p>
      </div>
    </div>
  );
}
