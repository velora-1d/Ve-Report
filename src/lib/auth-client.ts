import { createAuthClient } from "better-auth/react";

function getAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR / server runtime: gunakan loopback lokal agar tidak crash karena isu DNS/loopback di container Docker
  const internalUrl = process.env.BETTER_AUTH_URL_INTERNAL || process.env.BETTER_AUTH_URL || import.meta.env.BETTER_AUTH_URL;
  if (internalUrl && !internalUrl.includes("localhost") && !internalUrl.includes("127.0.0.1")) {
    // Jika ada port lokal, kita fallback ke localhost port agar fetch internal cepat
    const port = process.env.PORT || "8080";
    return `http://127.0.0.1:${port}`;
  }
  const url = internalUrl || "http://127.0.0.1:8080";
  return url.replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});
