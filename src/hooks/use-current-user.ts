// ponytail: Cast user as any untuk menopang custom columns Better Auth (YAGNI)
import { authClient } from "@/lib/auth-client";
import type { AppRole } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  position: string | null;
  bio: string | null;
  roles: AppRole[];
  role: AppRole;
  originalRole: AppRole;
}

export function useCurrentUser() {
  const { data, isPending, error } = authClient.useSession();

  const user = data?.user as any;
  let currentUser: CurrentUser | null = null;

  if (user) {
    const originalRole = user.role as AppRole;
    let activeRole = originalRole;

    if (originalRole === "developer" && typeof window !== "undefined") {
      const override = localStorage.getItem("dev_impersonated_role");
      if (override) {
        activeRole = override as AppRole;
      }
    }

    currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.image ?? null,
      phone: user.phone ?? null,
      position: user.position ?? null,
      bio: user.bio ?? null,
      roles: [activeRole],
      role: activeRole,
      originalRole: originalRole,
    };
  }

  return {
    data: currentUser,
    isLoading: isPending,
    error,
  };
}
