import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.name ?? user.email?.split("@")[0] ?? "Pengguna",
        avatarUrl: profile?.avatar_url ?? null,
        phone: profile?.phone ?? null,
        position: profile?.position ?? null,
        bio: profile?.bio ?? null,
        roles: (roles?.map((r) => r.role) as AppRole[]) ?? [],
      };
    },
    staleTime: 60_000,
  });
}
