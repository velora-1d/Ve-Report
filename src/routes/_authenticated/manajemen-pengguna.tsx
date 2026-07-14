// ponytail: Mengganti kueri Supabase client-side dengan TanStack Start Server Functions dan Drizzle ORM.
// ponytail: Menggunakan tabel user tunggal untuk memegang role dan status aktif secara langsung (YAGNI, membuang relasi perantara yang tidak diperlukan).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search, Shield, ShieldOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

// ponytail: Fungsi server untuk mengambil daftar pengguna
const getUsersMgmt = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  const role = session.user.role || "staff";
  if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

  const allUsers = await db.query.users.findMany({
    orderBy: [desc(usersTable.createdAt)],
  });

  // Admin tidak boleh melihat atau mengelola developer
  if (role === "admin") {
    return allUsers.filter((u) => u.role !== "developer");
  }
  return allUsers;
});

// ponytail: Fungsi server untuk mengubah status aktif pengguna
const toggleUserActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");
    if (session.user.id === data.id) throw new Error("Cannot change own status");

    await db.update(usersTable)
      .set({ isActive: data.active })
      .where(eq(usersTable.id, data.id));
  });

// ponytail: Fungsi server untuk mengubah peran (role) pengguna
const changeUserRole = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string(), newRole: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");
    if (session.user.id === data.userId) throw new Error("Cannot change own role");

    if (data.newRole === "developer" && role !== "developer") {
      throw new Error("Only developers can assign developer role");
    }

    await db.update(usersTable)
      .set({ role: data.newRole })
      .where(eq(usersTable.id, data.userId));
  });

export const Route = createFileRoute("/_authenticated/manajemen-pengguna")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || !session.user) throw redirect({ to: "/auth" });
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") {
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

function ManajemenPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users-mgmt"],
    queryFn: () => getUsersMgmt(),
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
    mutationFn: (v: { id: string; active: boolean }) => toggleUserActive({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "Akun diaktifkan" : "Akun dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; newRole: AppRole }) => changeUserRole({ data: v }),
    onSuccess: () => {
      toast.success("Peran diperbarui");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal ubah peran", { description: e.message }),
  });

  return (
    <div className="w-full space-y-6">
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
                    const isDev = u.role === "developer";
                    const currentEditable: AppRole = u.role === "admin"
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
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.isActive}
                              onCheckedChange={(checked) =>
                                toggleActive.mutate({
                                  id: u.id,
                                  active: checked,
                                })
                              }
                              disabled={isMe || isDev}
                            />
                            <span
                              className={`text-xs font-semibold ${
                                u.isActive ? "text-success" : "text-muted-foreground"
                              }`}
                            >
                              {u.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {u.createdAt ? format(new Date(u.createdAt), "d MMM yyyy", {
                            locale: idLocale,
                          }) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {isMe ? "Akun Anda" : isDev ? "Sistem Developer" : "Bisa Dikelola"}
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
