import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  if (!request) return null;
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session;
});

// ponytail: Caching session di sisi client selama 5 detik untuk mereduksi beban network request server function pada navigasi rute TanStack
let clientSessionCache: any = null;
let lastSessionFetchTime = 0;

export async function getClientSession() {
  if (typeof window === "undefined") {
    return getSession();
  }

  const now = Date.now();
  if (clientSessionCache && now - lastSessionFetchTime < 5000) {
    return clientSessionCache;
  }

  try {
    const session = await getSession();
    clientSessionCache = session;
    lastSessionFetchTime = now;
    return session;
  } catch (e) {
    return null;
  }
}
