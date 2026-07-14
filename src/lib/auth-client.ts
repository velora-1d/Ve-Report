import { createAuthClient } from "better-auth/react";

function getAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // SSR / server runtime: ambil dari env yang tersedia di Nitro/Vite
  const url = process.env.BETTER_AUTH_URL || import.meta.env.BETTER_AUTH_URL;
  if (!url) {
    throw new Error(
      "[auth-client] BETTER_AUTH_URL tidak ditemukan saat SSR. " +
        "Pastikan env di-set di production environment.",
    );
  }
  return url.replace(/\/$/, "");
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});
