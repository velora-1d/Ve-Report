import { useQuery } from "@tanstack/react-query";
import { getAppConfig } from "@/lib/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";

export function usePermission() {
  const { data: user } = useCurrentUser();
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });

  const hasPermission = (module: string, action: string) => {
    if (!user) return false;
    if (user.role === "developer") return true;

    const role = user.role || "staff";
    const permissions = config?.permissions as any;

    // Fallback default rules if not configured in DB
    if (!permissions || !permissions[role]) {
      if (role === "admin") return true;
      if (role === "staff") {
        if (module === "pengguna") return false;
        if (action === "delete") return false;
        return true;
      }
      return false;
    }

    const allowedActions = permissions[role]?.actions?.[module] || [];
    return allowedActions.includes(action);
  };

  return { hasPermission };
}
