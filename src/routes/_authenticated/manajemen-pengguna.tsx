// ponytail: Mengganti kueri Supabase client-side dengan TanStack Start Server Functions dan Drizzle ORM.
// ponytail: Menggunakan tabel user tunggal untuk memegang role dan status aktif secara langsung (YAGNI, membuang relasi perantara yang tidak diperlukan).
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Search,
  Shield,
  ShieldOff,
  UserCog,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  Key,
  ShieldCheck,
} from "lucide-react";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { db } from "@/db";
import {
  users as usersTable,
  accounts as accountsTable,
  divisions as divisionsTable,
  userDivisions as userDivisionsTable,
  divisionValidators as divisionValidatorsTable,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  position?: string | null;
  isActive: boolean;
  createdAt: Date | string | null;
}

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
    if (session.user.id === data.id)
      throw new Error("Cannot change own status");

    await db
      .update(usersTable)
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
    if (session.user.id === data.userId)
      throw new Error("Cannot change own role");

    if (data.newRole === "developer" && role !== "developer") {
      throw new Error("Only developers can assign developer role");
    }

    await db
      .update(usersTable)
      .set({ role: data.newRole })
      .where(eq(usersTable.id, data.userId));
  });

// ponytail: Fungsi server untuk mengambil semua divisi untuk form manajemen pengguna
const getDivisionsListMgmt = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    return await db.select().from(divisionsTable).orderBy(divisionsTable.name);
  },
);

// ponytail: Fungsi server untuk mengambil divisi kerja & divisi validasi milik user tertentu
const getUserDivisionsAndValidatorsMgmt = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: userId }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    const activeDivisions = await db
      .select({
        id: userDivisionsTable.divisionId,
        position: userDivisionsTable.position,
      })
      .from(userDivisionsTable)
      .where(eq(userDivisionsTable.userId, userId));

    const validatedDivisions = await db
      .select({ divisionId: divisionValidatorsTable.divisionId })
      .from(divisionValidatorsTable)
      .where(eq(divisionValidatorsTable.userId, userId));

    return {
      divisionPositions: activeDivisions.map((d) => ({
        id: d.id,
        position: d.position || "",
      })),
      validationDivisionIds: validatedDivisions.map((d) => d.divisionId),
    };
  });

// ponytail: Fungsi server untuk membuat pengguna baru beserta divisinya secara manual
const createUserMgmt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.enum(["admin", "staff"]),
      position: z.string().optional().nullable(),
      password: z.string().min(6),
      divisionPositions: z.array(
        z.object({
          id: z.string(),
          position: z.string().optional().nullable(),
        }),
      ),
      validationDivisionIds: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, data.email))
      .limit(1);
    if (existing.length > 0) throw new Error("Email sudah terdaftar");

    const crypto = await import("crypto");
    const newUserId = crypto.randomUUID();
    await db.insert(usersTable).values({
      id: newUserId,
      name: data.name,
      email: data.email,
      role: data.role,
      position: data.position || null,
      isActive: true,
    });

    const { hashPassword } = await import("better-auth/crypto");
    const hashedPassword = await hashPassword(data.password);
    await db.insert(accountsTable).values({
      id: crypto.randomUUID(),
      userId: newUserId,
      accountId: data.email,
      providerId: "email",
      password: hashedPassword,
    });

    if (data.divisionPositions.length > 0) {
      const values = data.divisionPositions.map((dp) => ({
        userId: newUserId,
        divisionId: dp.id,
        position: dp.position || null,
      }));
      await db.insert(userDivisionsTable).values(values);
    }

    if (data.role === "admin" && data.validationDivisionIds.length > 0) {
      const values = data.validationDivisionIds.map((divId) => ({
        userId: newUserId,
        divisionId: divId,
      }));
      await db.insert(divisionValidatorsTable).values(values);
    }
  });

// ponytail: Fungsi server untuk memperbarui data pengguna oleh admin (termasuk email, kata sandi, dan divisi)
const updateUserMgmt = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(["developer", "admin", "staff"]),
      position: z.string().optional().nullable(),
      password: z.string().optional().nullable(),
      divisionPositions: z.array(
        z.object({
          id: z.string(),
          position: z.string().optional().nullable(),
        }),
      ),
      validationDivisionIds: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    // Developer tidak bisa diubah oleh admin, hanya developer lain / ybs yang bisa
    const usersList = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, data.id))
      .limit(1);
    const targetUser = usersList[0] || null;
    if (!targetUser) throw new Error("User tidak ditemukan");
    if (targetUser.role === "developer" && role !== "developer") {
      throw new Error("Forbidden: Tidak dapat memperbarui status Developer");
    }

    // 1. Perbarui tabel user
    await db
      .update(usersTable)
      .set({
        name: data.name,
        email: data.email,
        role: targetUser.role === "developer" ? "developer" : data.role,
        position: data.position || null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, data.id));

    // 2. Perbarui kata sandi di tabel account jika disediakan
    if (data.password && data.password.trim() !== "") {
      const { hashPassword } = await import("better-auth/crypto");
      const hashedPassword = await hashPassword(data.password);

      const existingAccounts = await db
        .select()
        .from(accountsTable)
        .where(
          and(
            eq(accountsTable.userId, data.id),
            eq(accountsTable.providerId, "email"),
          ),
        )
        .limit(1);
      const existingAccount = existingAccounts[0] || null;

      if (existingAccount) {
        await db
          .update(accountsTable)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(accountsTable.userId, data.id),
              eq(accountsTable.providerId, "email"),
            ),
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

    // 3. Perbarui divisi kerja
    await db
      .delete(userDivisionsTable)
      .where(eq(userDivisionsTable.userId, data.id));
    if (data.divisionPositions.length > 0) {
      const values = data.divisionPositions.map((dp) => ({
        userId: data.id,
        divisionId: dp.id,
        position: dp.position || null,
      }));
      await db.insert(userDivisionsTable).values(values);
    }

    // 4. Perbarui divisi validasi jika perannya admin
    await db
      .delete(divisionValidatorsTable)
      .where(eq(divisionValidatorsTable.userId, data.id));
    if (data.role === "admin" && data.validationDivisionIds.length > 0) {
      const values = data.validationDivisionIds.map((divId) => ({
        userId: data.id,
        divisionId: divId,
      }));
      await db.insert(divisionValidatorsTable).values(values);
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

    if (session.user.id === userId)
      throw new Error("Tidak dapat menghapus diri sendiri");

    const usersList = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
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
  const { hasPermission } = usePermission();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users-mgmt"],
    queryFn: () => getUsersMgmt(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u: UserItem) => {
      if (!q) return true;
      return (
        (u.name?.toLowerCase() || "").includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.position?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data, search]);

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      toggleUserActive({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "Akun diaktifkan" : "Akun dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; newRole: AppRole }) =>
      changeUserRole({ data: v }),
    onSuccess: () => {
      toast.success("Peran diperbarui");
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal ubah peran", { description: e.message }),
  });

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states untuk edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"developer" | "admin" | "staff">(
    "staff",
  );
  const [editPosition, setEditPosition] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDivisions, setEditDivisions] = useState<
    { id: string; position: string }[]
  >([]);
  const [editValidationDivisions, setEditValidationDivisions] = useState<
    string[]
  >([]);

  // Form states untuk tambah pengguna baru
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPosition, setCreatePosition] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "staff">("staff");
  const [createDivisions, setCreateDivisions] = useState<
    { id: string; position: string }[]
  >([]);
  const [createValidationDivisions, setCreateValidationDivisions] = useState<
    string[]
  >([]);

  const { data: divisionsList } = useQuery({
    queryKey: ["divisions-list-mgmt"],
    queryFn: () => getDivisionsListMgmt(),
  });

  const createMutation = useMutation({
    mutationFn: (v: Parameters<typeof createUserMgmt>[0]["data"]) =>
      createUserMgmt({ data: v }),
    onSuccess: () => {
      toast.success("Pengguna baru berhasil didaftarkan");
      setCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreatePosition("");
      setCreateRole("staff");
      setCreateDivisions([]);
      setCreateValidationDivisions([]);
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menambahkan pengguna", { description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (v: Parameters<typeof updateUserMgmt>[0]["data"]) =>
      updateUserMgmt({ data: v }),
    onSuccess: () => {
      toast.success("Data pengguna berhasil diperbarui");
      setEditOpen(false);
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memperbarui pengguna", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserMgmt({ data: id }),
    onSuccess: () => {
      toast.success("Pengguna berhasil dihapus");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["users-mgmt"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menghapus pengguna", { description: e.message }),
  });

  const handleOpenEdit = async (u: UserItem) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role as "developer" | "admin" | "staff");
    setEditPosition(u.position || "");
    setEditPassword("");
    setEditDivisions([]);
    setEditValidationDivisions([]);
    setEditOpen(true);
    try {
      const res = await getUserDivisionsAndValidatorsMgmt({ data: u.id });
      setEditDivisions(res.divisionPositions);
      setEditValidationDivisions(res.validationDivisionIds);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error("Gagal memuat divisi pengguna", {
        description: error.message,
      });
    }
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
        {hasPermission("pengguna", "create") && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-2xl bg-primary text-white font-bold h-10 px-5 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah Pengguna
          </Button>
        )}
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
                  {filtered.map((u: UserItem) => {
                    const isMe = me?.id === u.id;
                    const isDev = u.role === "developer";
                    const currentEditable: AppRole =
                      u.role === "admin" ? "admin" : "staff";
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
                              disabled={
                                isMe || !hasPermission("pengguna", "update")
                              }
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
                              disabled={
                                isMe ||
                                isDev ||
                                !hasPermission("pengguna", "update")
                              }
                            />
                            <span
                              className={`text-xs font-semibold ${
                                u.isActive
                                  ? "text-success"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {u.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {u.createdAt
                            ? format(new Date(u.createdAt), "d MMM yyyy", {
                                locale: idLocale,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {/* Semua user termasuk dev/diri sendiri bisa diedit kecuali perubahan status/peran dibatasi */}
                            {hasPermission("pengguna", "update") ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => handleOpenEdit(u)}
                                title="Edit Pengguna"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}

                            {!isDev &&
                            !isMe &&
                            hasPermission("pengguna", "delete") ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeletingId(u.id)}
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}

                            {(isDev || isMe) &&
                              !hasPermission("pengguna", "update") && (
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
        <DialogContent className="sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> Edit Pengguna
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ubah informasi nama, email, peran, jabatan, kata sandi, dan divisi
              pengguna ini.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: editingUser?.id || "",
                name: editName,
                email: editEmail,
                role: editRole,
                position: editPosition,
                password: editPassword,
                divisionPositions: editDivisions,
                validationDivisionIds:
                  editRole === "admin" ? editValidationDivisions : [],
              });
            }}
            className="space-y-4 py-2 max-h-[50vh] overflow-y-auto pr-1"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-name"
                className="text-xs font-bold text-slate-700"
              >
                Nama Lengkap
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-email"
                className="text-xs font-bold text-slate-700"
              >
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-password"
                className="text-xs font-bold text-slate-700 flex items-center gap-1"
              >
                <Key className="w-3.5 h-3.5" /> Reset Kata Sandi Baru (Opsional)
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Kosongkan jika tidak ingin diubah"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-position"
                className="text-xs font-bold text-slate-700"
              >
                Jabatan
              </Label>
              <Input
                id="edit-position"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="Staff IT, Manajer, dll."
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-role"
                className="text-xs font-bold text-slate-700"
              >
                Peran (Role)
              </Label>
              {editingUser?.role === "developer" ? (
                <Input
                  id="edit-role"
                  value="developer"
                  disabled
                  className="rounded-2xl bg-slate-50 uppercase font-bold text-slate-400"
                />
              ) : (
                <Select
                  value={editRole}
                  onValueChange={(v: "developer" | "admin" | "staff") =>
                    setEditRole(v)
                  }
                >
                  <SelectTrigger id="edit-role" className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Edit Divisi Kerja */}
            <div className="space-y-2 border border-slate-100 bg-slate-50/20 p-3.5 rounded-2xl">
              <Label className="text-xs font-bold text-slate-700 block">
                Divisi Kerja
              </Label>
              {divisionsList && divisionsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {divisionsList.map((div: { id: string; name: string }) => {
                    const mappedDiv = editDivisions.find(
                      (d) => d.id === div.id,
                    );
                    const isChecked = !!mappedDiv;
                    return (
                      <div
                        key={div.id}
                        className="flex flex-col gap-1.5 p-2.5 border border-slate-100 rounded-xl bg-slate-50/30"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <Checkbox
                            id={`edit-div-${div.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEditDivisions([
                                  ...editDivisions,
                                  { id: div.id, position: "" },
                                ]);
                              } else {
                                setEditDivisions(
                                  editDivisions.filter((d) => d.id !== div.id),
                                );
                              }
                            }}
                          />
                          <span className="text-xs font-bold text-slate-750 truncate">
                            {div.name}
                          </span>
                        </label>
                        {isChecked && (
                          <Input
                            placeholder="Jabatan di divisi ini"
                            value={mappedDiv.position}
                            onChange={(e) => {
                              const pos = e.target.value;
                              setEditDivisions(
                                editDivisions.map((d) =>
                                  d.id === div.id ? { ...d, position: pos } : d,
                                ),
                              );
                            }}
                            className="h-8 text-xs rounded-lg mt-0.5"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Belum ada divisi aktif
                </p>
              )}
            </div>

            {/* Edit Divisi Validasi (Hanya Admin) */}
            {editRole === "admin" && (
              <div className="space-y-2 border border-primary/5 bg-primary/2 p-3.5 rounded-2xl">
                <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Divisi
                  Validasi (Tanggung Jawab Atasan)
                </Label>
                {divisionsList && divisionsList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {divisionsList.map((div: { id: string; name: string }) => (
                      <label
                        key={div.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <Checkbox
                          id={`edit-val-${div.id}`}
                          checked={editValidationDivisions.includes(div.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditValidationDivisions([
                                ...editValidationDivisions,
                                div.id,
                              ]);
                            } else {
                              setEditValidationDivisions(
                                editValidationDivisions.filter(
                                  (id) => id !== div.id,
                                ),
                              );
                            }
                          }}
                        />
                        <span className="text-xs font-bold text-slate-650 truncate">
                          {div.name}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Belum ada divisi aktif
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="rounded-2xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-2xl bg-primary text-white"
              >
                {updateMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog Tambah Pengguna Baru */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Tambah Pengguna Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Daftarkan akun Admin/Staff baru secara manual beserta divisi
              kerjanya.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (createDivisions.length === 0) {
                toast.error("Harap pilih minimal satu divisi kerja");
                return;
              }
              createMutation.mutate({
                name: createName,
                email: createEmail,
                role: createRole,
                position: createPosition,
                password: createPassword,
                divisionPositions: createDivisions,
                validationDivisionIds:
                  createRole === "admin" ? createValidationDivisions : [],
              });
            }}
            className="space-y-4 py-2 max-h-[50vh] overflow-y-auto pr-1"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="create-name"
                className="text-xs font-bold text-slate-700"
              >
                Nama Lengkap
              </Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Nama lengkap staf/admin"
                className="rounded-2xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="create-email"
                className="text-xs font-bold text-slate-700"
              >
                Email
              </Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="email@perusahaan.com"
                className="rounded-2xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="create-password"
                className="text-xs font-bold text-slate-700"
              >
                Kata Sandi
              </Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="rounded-2xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="create-position"
                className="text-xs font-bold text-slate-700"
              >
                Jabatan
              </Label>
              <Input
                id="create-position"
                value={createPosition}
                onChange={(e) => setCreatePosition(e.target.value)}
                placeholder="Staff IT, Guru, dll."
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="create-role"
                className="text-xs font-bold text-slate-700"
              >
                Peran (Role)
              </Label>
              <Select
                value={createRole}
                onValueChange={(v: "admin" | "staff") => setCreateRole(v)}
              >
                <SelectTrigger id="create-role" className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin / Validator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pilihan Divisi Kerja */}
            <div className="space-y-2 border border-slate-100 bg-slate-50/20 p-3.5 rounded-2xl">
              <Label className="text-xs font-bold text-slate-700 block">
                Pilih Divisi Kerja
              </Label>
              {divisionsList && divisionsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {divisionsList.map((div: { id: string; name: string }) => {
                    const mappedDiv = createDivisions.find(
                      (d) => d.id === div.id,
                    );
                    const isChecked = !!mappedDiv;
                    return (
                      <div
                        key={div.id}
                        className="flex flex-col gap-1.5 p-2.5 border border-slate-100 rounded-xl bg-slate-50/30"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <Checkbox
                            id={`create-div-${div.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCreateDivisions([
                                  ...createDivisions,
                                  { id: div.id, position: "" },
                                ]);
                              } else {
                                setCreateDivisions(
                                  createDivisions.filter(
                                    (d) => d.id !== div.id,
                                  ),
                                );
                              }
                            }}
                          />
                          <span className="text-xs font-bold text-slate-750 truncate">
                            {div.name}
                          </span>
                        </label>
                        {isChecked && (
                          <Input
                            placeholder="Jabatan di divisi ini"
                            value={mappedDiv.position}
                            onChange={(e) => {
                              const pos = e.target.value;
                              setCreateDivisions(
                                createDivisions.map((d) =>
                                  d.id === div.id ? { ...d, position: pos } : d,
                                ),
                              );
                            }}
                            className="h-8 text-xs rounded-lg mt-0.5"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Belum ada divisi aktif
                </p>
              )}
            </div>

            {/* Pilihan Divisi Validasi (Hanya Admin) */}
            {createRole === "admin" && (
              <div className="space-y-2 border border-primary/5 bg-primary/2 p-3.5 rounded-2xl">
                <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Pilih Divisi
                  Validasi (Tanggung Jawab Atasan)
                </Label>
                {divisionsList && divisionsList.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {divisionsList.map((div: { id: string; name: string }) => (
                      <label
                        key={div.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <Checkbox
                          id={`create-val-${div.id}`}
                          checked={createValidationDivisions.includes(div.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCreateValidationDivisions([
                                ...createValidationDivisions,
                                div.id,
                              ]);
                            } else {
                              setCreateValidationDivisions(
                                createValidationDivisions.filter(
                                  (id) => id !== div.id,
                                ),
                              );
                            }
                          }}
                        />
                        <span className="text-xs font-bold text-slate-650 truncate">
                          {div.name}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Belum ada divisi aktif
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="rounded-2xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-2xl bg-primary text-white font-bold px-5"
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Daftarkan User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Konfirmasi Hapus Pengguna */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <AlertDialogContent className="surface-card border-none rounded-2xl p-6 shadow-soft max-w-sm mx-auto">
          <AlertDialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-650 scale-110">
              <Trash2 className="w-6 h-6 animate-pulse text-red-600" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
              Hapus Pengguna?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak
              dapat dibatalkan dan akan menghapus semua sesi serta data terkait
              secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold text-xs py-2">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-red-650 to-red-500 text-white font-semibold text-xs py-2 shadow-md hover:shadow-lg transition-all"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
