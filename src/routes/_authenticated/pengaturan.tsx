// ponytail: Mengganti query Supabase client-side untuk memperbarui profil dengan Server Functions Drizzle ORM
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BrandingForm,
  PdfConfigForm,
} from "@/components/settings/branding-pdf-forms";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users as usersTable, accounts as accountsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isAdminOrDev } from "@/lib/roles";
import { Loader2, Eye, EyeOff, Lock, User, Palette, FileText } from "lucide-react";
import { uploadToRustFS } from "@/lib/storage";

// ponytail: Fungsi server untuk memperbarui profil pengguna saat ini
const updateProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      phone: z.string().optional(),
      position: z.string().optional(),
      bio: z.string().optional(),
      image: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    await db.update(usersTable)
      .set({
        name: data.name,
        phone: data.phone || null,
        position: data.position || null,
        bio: data.bio || null,
        image: data.image === undefined ? undefined : data.image,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, session.user.id));
  });

const updateCredentials = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string(),
      newEmail: z.string().email().optional().or(z.literal("")),
      newPassword: z.string().min(6).optional().or(z.literal("")),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const emailToSet = data.newEmail && data.newEmail.trim() !== "" ? data.newEmail.trim() : null;
    const passwordToSet = data.newPassword && data.newPassword.trim() !== "" ? data.newPassword.trim() : null;

    if (!emailToSet && !passwordToSet) {
      throw new Error("Tidak ada data kredensial baru yang diisi");
    }

    // 1. Ambil akun kredensial user saat ini
    const existingAccounts = await db
      .select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.userId, session.user.id),
          eq(accountsTable.providerId, "email")
        )
      )
      .limit(1);

    const account = existingAccounts[0];
    if (!account || !account.password) {
      throw new Error("Akun kredensial tidak ditemukan");
    }

    // 2. Verifikasi kata sandi saat ini
    const { verifyPassword } = await import("better-auth/crypto");
    const isPasswordValid = await verifyPassword({
      password: data.currentPassword,
      hash: account.password,
    });

    if (!isPasswordValid) {
      throw new Error("Kata sandi saat ini salah");
    }

    // 3. Perbarui email jika diisi
    if (emailToSet) {
      const duplicateUsers = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, emailToSet))
        .limit(1);

      if (duplicateUsers.length > 0) {
        throw new Error("Email baru sudah digunakan oleh pengguna lain");
      }

      await db
        .update(usersTable)
        .set({
          email: emailToSet,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, session.user.id));

      await db
        .update(accountsTable)
        .set({
          accountId: emailToSet,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accountsTable.userId, session.user.id),
            eq(accountsTable.providerId, "email")
          )
        );
    }

    // 4. Perbarui password jika diisi
    if (passwordToSet) {
      const { hashPassword } = await import("better-auth/crypto");
      const hashedPassword = await hashPassword(passwordToSet);

      await db
        .update(accountsTable)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accountsTable.userId, session.user.id),
            eq(accountsTable.providerId, "email")
          )
        );
    }
  });

export const Route = createFileRoute("/_authenticated/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — Log Book" },
      {
        name: "description",
        content: "Kelola profil, branding, dan konfigurasi PDF laporan.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PengaturanPage,
});

function PengaturanPage() {
  const { data: user, isLoading } = useCurrentUser();
  const { hasPermission } = usePermission();
  const canReadBranding = hasPermission("branding", "read");
  const canReadPdf = hasPermission("pdf", "read");

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pengaturan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola profil dan preferensi aplikasi.
        </p>
      </div>

      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="bg-slate-100/70 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 gap-1 h-auto flex self-start w-fit">
          <TabsTrigger
            value="profil"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0077B6] data-[state=active]:to-[#0077B6]/90 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_12px_rgba(0,119,182,0.2)] hover:bg-slate-200/40 dark:hover:bg-slate-850/40 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Profil Saya</span>
          </TabsTrigger>
          {canReadBranding && (
            <TabsTrigger
              value="branding"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0077B6] data-[state=active]:to-[#0077B6]/90 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_12px_rgba(0,119,182,0.2)] hover:bg-slate-200/40 dark:hover:bg-slate-850/40 cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Branding & Logo</span>
            </TabsTrigger>
          )}
          {canReadPdf && (
            <TabsTrigger
              value="pdf"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0077B6] data-[state=active]:to-[#0077B6]/90 data-[state=active]:text-white data-[state=active]:shadow-[0_4px_12px_rgba(0,119,182,0.2)] hover:bg-slate-200/40 dark:hover:bg-slate-850/40 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Konfigurasi PDF</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profil" className="mt-4 space-y-6">
          <ProfileForm />
          <SecurityForm />
        </TabsContent>

        {canReadBranding && (
          <TabsContent value="branding" className="mt-4">
            <BrandingForm />
          </TabsContent>
        )}

        {canReadPdf && (
          <TabsContent value="pdf" className="mt-4">
            <PdfConfigForm />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ProfileForm() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [position, setPosition] = useState(user?.position ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { name, phone, position, bio, image: avatar } }),
    onSuccess: () => {
      toast.success("Profil berhasil diperbarui");
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (e: Error) => {
      toast.error("Gagal menyimpan profil", { description: e.message });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle>Profil Saya</CardTitle>
        <CardDescription>
          Perbarui biodata dan foto profil Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border border-border/60">
            <div className="w-24 h-32 border-2 border-primary/20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 relative">
              {avatar ? (
                <img crossOrigin="anonymous" src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <User className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold block text-foreground">Foto Profil</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploading(true);
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        try {
                          const res = await uploadToRustFS({
                            data: {
                              base64Data: reader.result as string,
                              fileName: file.name,
                              contentType: file.type || "image/png",
                            }
                          });
                          if (res?.url) {
                            setAvatar(res.url);
                            toast.success("Foto profil berhasil di-upload ke S3");
                          }
                        } catch (err: any) {
                          toast.error(err.message || "Gagal mengupload foto profil ke S3");
                        } finally {
                          setIsUploading(false);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  disabled={isUploading}
                  className="h-8 text-[11px] w-full max-w-[200px] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvatar(null)}
                    className="h-8 text-xs text-destructive hover:text-destructive/90"
                    disabled={isUploading}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Jabatan / Posisi</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Contoh: QA Engineer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio Singkat</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Ceritakan sedikit tentang Anda..."
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || isUploading}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploading ? "Mengupload..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SecurityForm() {
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const update = useMutation({
    mutationFn: () =>
      updateCredentials({
        data: {
          currentPassword,
          newEmail: newEmail || undefined,
          newPassword: newPassword || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Kredensial keamanan berhasil diperbarui");
      setCurrentPassword("");
      setNewEmail("");
      setNewPassword("");
      setConfirmPassword("");
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (e: Error) => {
      toast.error("Gagal memperbarui kredensial", { description: e.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Kata sandi saat ini wajib diisi untuk verifikasi keamanan");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi baru tidak cocok");
      return;
    }
    update.mutate();
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-white">
          <Lock className="w-4 h-4 text-primary" /> Keamanan Akun
        </CardTitle>
        <CardDescription>
          Perbarui alamat email atau kata sandi Anda. Anda harus memasukkan kata sandi saat ini untuk memverifikasi tindakan ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email Baru (Opsional)</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="emailbaru@domain.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-password">Kata Sandi Saat Ini (Wajib)</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama Anda"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Kata Sandi Baru (Opsional)</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Kata Sandi Baru</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="pr-10"
                  required={!!newPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={update.isPending} className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-white font-semibold rounded-xl text-xs py-2 shadow-sm">
              {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Perbarui Kredensial
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
