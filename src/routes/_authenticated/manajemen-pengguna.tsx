import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search, Shield, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/manajemen-pengguna")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const has = (r: string) => roles?.some((x) => x.role === r);
    if (!has("admin") && !has("developer")) {
      throw redirect({ to: "/dasbor" });
    }
  },
  head: () => ({
    meta: [
      { title: "Manajemen Pengguna — Log Book" },
      {
        name: "description",
        content: "Kelola daftar pengguna, peran, dan status akun.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManajemenPage,
});

interface UserRow {
  id: string;
  name: string;
  email: string;
  position: string | null;
  is_active: boolean;
  created_at: string;
  roles: AppRole[];
}

function ManajemenPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users-mgmt"],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles, error: pe }, { data: rolesData, error: re }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,name,email,position,is_active,created_at")
            .order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id,role"),
        ]);
      if (pe) throw pe;
      if (re) throw re;
      const roleMap = new Map<string, AppRole[]>();
      for (const r of rolesData ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        roleMap.set(r.user_id, arr);
      }
      // RLS already hides developer profiles for admin; developer sees all.
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.position?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data, search]);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      toast.success(v.active ? "Akun diaktifkan" : "Akun dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  const changeRole = useMutation({
    mutationFn: async ({
      userId,
      newRole,
      currentRoles,
    }: {
      userId: string;
      newRole: AppRole;
      currentRoles: AppRole[];
    }) => {
      // Remove non-dev roles the user currently has (dev role never touched from UI)
      const toRemove = currentRoles.filter(
        (r) => r !== "developer" && r !== newRole,
      );
      if (toRemove.length) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .in("role", toRemove);
        if (error) throw error;
      }
      if (!currentRoles.includes(newRole)) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Peran diperbarui");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal ubah peran", { description: e.message }),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Manajemen Pengguna
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola daftar pengguna, peran, dan status aktif akun.
          </p>
        </div>
      </div>

      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="w-4 h-4" /> Daftar Pengguna
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, jabatan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Tidak ada pengguna.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bergabung</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const isMe = me?.id === u.id;
                    const isDev = u.roles.includes("developer");
                    const currentEditable: AppRole = u.roles.includes("admin")
                      ? "admin"
                      : "staff";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.position ?? "—"}
                        </TableCell>
                        <TableCell>
                          {isDev ? (
                            <Badge variant="secondary" className="text-xs">
                              {ROLE_LABEL.developer}
                            </Badge>
                          ) : (
                            <Select
                              value={currentEditable}
                              onValueChange={(v) =>
                                changeRole.mutate({
                                  userId: u.id,
                                  newRole: v as AppRole,
                                  currentRoles: u.roles,
                                })
                              }
                              disabled={isMe}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">Staff</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.is_active ? "default" : "secondary"}
                            className={
                              u.is_active ? "bg-success/15 text-success" : ""
                            }
                          >
                            {u.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(u.created_at), "d MMM yyyy", {
                            locale: idLocale,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isDev && !isMe && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleActive.mutate({
                                  id: u.id,
                                  active: !u.is_active,
                                })
                              }
                            >
                              {u.is_active ? (
                                <>
                                  <ShieldOff className="w-3.5 h-3.5 mr-1" />{" "}
                                  Nonaktifkan
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3.5 h-3.5 mr-1" />{" "}
                                  Aktifkan
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
