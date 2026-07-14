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
}

export function useCurrentUser() {
  const { data, isPending, error } = authClient.useSession();

  const user = data?.user;
  const currentUser: CurrentUser | null = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.image ?? null,
        phone: user.phone ?? null,
        position: user.position ?? null,
        bio: user.bio ?? null,
        roles: [user.role as AppRole],
      }
    : null;

  return {
    data: currentUser,
    isLoading: isPending,
    error,
  };
}
