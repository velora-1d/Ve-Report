// ponytail: Mengganti kueri Supabase client-side dengan TanStack Start Server Functions dan Drizzle ORM.
// ponytail: Menggunakan tabel user tunggal untuk memegang role dan status aktif secara langsung (YAGNI, membuang relasi perantara yang tidak diperlukan).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search, Shield, ShieldOff, UserCog, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users as usersTable, accounts as accountsTable } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ponytail: Fungsi server untuk memperbarui data pengguna oleh admin (termasuk email dan kata sandi)
const updateUserMgmt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(["admin", "staff"]),
      position: z.string().optional().nullable(),
      password: z.string().optional().nullable(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    // Developer tidak bisa diubah oleh admin, hanya developer lain / ybs yang bisa
    const usersList = await db.select().from(usersTable).where(eq(usersTable.id, data.id)).limit(1);
    const targetUser = usersList[0] || null;
    if (!targetUser) throw new Error("User tidak ditemukan");
    if (targetUser.role === "developer" && role !== "developer") {
      throw new Error("Forbidden: Tidak dapat memperbarui status Developer");
    }

    // 1. Perbarui tabel user
    await db.update(usersTable)
      .set({
        name: data.name,
        email: data.email,
        role: data.role,
        position: data.position || null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, data.id));

    // 2. Perbarui kata sandi di tabel account jika disediakan
    if (data.password && data.password.trim() !== "") {
      const { hashPassword } = await import("better-auth/crypto");
      const hashedPassword = await hashPassword(data.password);
      
      const existingAccounts = await db.select()
        .from(accountsTable)
        .where(
          and(
            eq(accountsTable.userId, data.id),
            eq(accountsTable.providerId, "email")
          )
        )
        .limit(1);
      const existingAccount = existingAccounts[0] || null;

      if (existingAccount) {
        await db.update(accountsTable)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(accountsTable.userId, data.id),
              eq(accountsTable.providerId, "email")
            )
          );
      } else {
        const crypto = await import("crypto");
        await db.insert(accountsTable).values({
          id: crypto.randomUUID(),
          userId: data.id,
          accountId: data.email,
          providerId: "email",
          password: hashedPassword,
        });
      }
    }
  });

// ponytail: Fungsi server untuk menghapus pengguna
const deleteUserMgmt = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: userId }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    if (session.user.id === userId) throw new Error("Tidak dapat menghapus diri sendiri");

    const usersList = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const targetUser = usersList[0] || null;
    if (!targetUser) throw new Error("User tidak ditemukan");
    if (targetUser.role === "developer" && role !== "developer") {
      throw new Error("Forbidden: Tidak dapat menghapus Developer");
    }

    await db.delete(usersTable).where(eq(usersTable.id, userId));
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

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states untuk edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "staff">("staff");
  const [editPosition, setEditPosition] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: (v: any) => updateUserMgmt({ data: v }),
    onSuccess: () => {
      toast.success("Data pengguna berhasil diperbarui");
      setEditOpen(false);
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui pengguna", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserMgmt({ data: id }),
    onSuccess: () => {
      toast.success("Pengguna berhasil dihapus");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) => toast.error("Gagal menghapus pengguna", { description: e.message }),
  });

  const handleOpenEdit = (u: any) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role === "admin" ? "admin" : "staff");
    setEditPosition(u.position || "");
    setEditPassword("");
    setEditOpen(true);
  };

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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {!isDev && !isMe ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenEdit(u)}
                                  title="Edit Pengguna"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingId(u.id)}
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic px-2">
                                {isMe ? "Akun Anda" : "Sistem"}
                              </span>
                            )}
                          </div>
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

      {/* Modal Dialog Edit Pengguna */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
            <DialogDescription>
              Ubah informasi nama, email, peran, jabatan, dan kata sandi pengguna ini.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingUser?.id,
                name: editName,
                email: editEmail,
                role: editRole,
                position: editPosition,
                password: editPassword,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama Lengkap</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Kata Sandi Baru (Opsional)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Kosongkan jika tidak ingin diubah"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">Jabatan</Label>
              <Input
                id="edit-position"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="Staff IT, Manajer, dll."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Peran (Role)</Label>
              <Select
                value={editRole}
                onValueChange={(v: "admin" | "staff") => setEditRole(v)}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Konfirmasi Hapus Pengguna */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Menghapus pengguna juga akan menghapus data sesi dan kepemilikan yang terkait secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
