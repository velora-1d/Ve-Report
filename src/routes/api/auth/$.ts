import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (error) {
          console.error("[Better Auth] GET handler error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              message: "Auth handler error",
              error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (error) {
          console.error("[Better Auth] POST handler error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              message: "Auth handler error",
              error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            },
          );
        }
      },
    },
  },
});
