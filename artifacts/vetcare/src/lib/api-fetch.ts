/**
 * api-fetch.ts — authenticated fetch wrapper for raw fetch() calls.
 * Uses window.Clerk to get the current session token and attaches
 * Authorization: Bearer <token> on every request.
 *
 * Use this for components that cannot yet use the generated API client.
 * Prefer @workspace/api-client-react hooks when possible.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const clerk = (window as any).Clerk;
  let token: string | null = null;
  try {
    token = clerk?.session ? await clerk.session.getToken() : null;
  } catch {
    // session not available, continue unauthenticated
  }
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
