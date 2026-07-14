import { createAuthClient } from "better-auth/react";

function getAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR / server runtime: ambil dari env yang tersedia di Nitro/Vite
  return (
    process.env.BETTER_AUTH_URL ||
    import.meta.env.BETTER_AUTH_URL ||
    "[REDACTED-URL]"
  );
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});
