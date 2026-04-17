import { useMutation, type UseMutationOptions, type DefaultError } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e["error"] === "string") return e["error"];
    if (typeof e["message"] === "string") return e["message"];
  }
  return "Une erreur est survenue";
}

interface ApiMutationOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  successMessage?: string;
  errorMessage?: string;
}

export function useApiMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: ApiMutationOptions<TData, TError, TVariables, TContext>,
) {
  const { toast } = useToast();
  const { successMessage, errorMessage, ...mutationOptions } = options ?? {};

  const userOnSuccess = mutationOptions.onSuccess;
  const userOnError = mutationOptions.onError;

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
    ...mutationOptions,
    onSuccess: (...args) => {
      if (successMessage) {
        toast({ title: successMessage });
      }
      return (userOnSuccess as (...a: typeof args) => unknown)?.(...args);
    },
    onError: (...args) => {
      const [error] = args;
      const message = errorMessage ?? extractErrorMessage(error);
      toast({ title: message, variant: "destructive" });
      return (userOnError as (...a: typeof args) => unknown)?.(...args);
    },
  });
}
