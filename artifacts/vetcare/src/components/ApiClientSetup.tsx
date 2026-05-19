// @ts-nocheck
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

/**
 * ApiClientSetup — must be rendered inside ClerkProvider.
 * Registers the Clerk token getter so that the generated API client
 * (customFetch) automatically attaches Authorization: Bearer <token>
 * on every request to the backend.
 */
export function ApiClientSetup() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => {
      setAuthTokenGetter(null);
    };
  }, [isSignedIn, getToken]);

  return null;
}
