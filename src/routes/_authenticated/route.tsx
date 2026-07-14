import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session || !session.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
