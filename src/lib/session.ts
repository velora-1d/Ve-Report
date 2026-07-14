import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getWebRequest();
  if (!request) return null;
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session;
});
