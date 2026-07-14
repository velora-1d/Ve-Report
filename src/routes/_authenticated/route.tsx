import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session || !session.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    let role = session.user.role || "staff";
    const originalRole = role;
    if (originalRole === "developer" && typeof window !== "undefined") {
      const override = localStorage.getItem("dev_impersonated_role");
      if (override) {
        role = override;
      }
    }
    if (role !== "developer") {
      const { getAppConfig } = await import("@/lib/app-config");
      const config = await getAppConfig();
      const permissions = config?.permissions as any;

      if (permissions && permissions[role]) {
        const allowedMenus = permissions[role]?.menus || [];
        const currentMenuKey = location.pathname.split("/")[1];
        if (currentMenuKey && currentMenuKey !== "dasbor") {
          if (!allowedMenus.includes(currentMenuKey)) {
            throw redirect({ to: "/dasbor" });
          }
        }
      } else {
        if (location.pathname.startsWith("/manajemen-pengguna") && role !== "admin") {
          throw redirect({ to: "/dasbor" });
        }
        if (location.pathname.startsWith("/panel-developer")) {
          throw redirect({ to: "/dasbor" });
        }
      }
    }

    return { user: session.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
