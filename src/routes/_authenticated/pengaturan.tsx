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
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminOrDev } from "@/lib/roles";
import { Loader2 } from "lucide-react";

// ponytail: Fungsi server untuk memperbarui profil pengguna saat ini
const updateProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      phone: z.string().optional(),
      position: z.string().optional(),
      bio: z.string().optional(),
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
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, session.user.id));
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
  const canAdmin = isAdminOrDev(user?.roles ?? []);

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

      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil Saya</TabsTrigger>
          {canAdmin && (
            <TabsTrigger value="branding">Branding & Logo</TabsTrigger>
          )}
          {canAdmin && <TabsTrigger value="pdf">Konfigurasi PDF</TabsTrigger>}
        </TabsList>

        <TabsContent value="profil" className="mt-4">
          <ProfileForm />
        </TabsContent>

        {canAdmin && (
          <TabsContent value="branding" className="mt-4">
            <BrandingForm />
          </TabsContent>
        )}

        {canAdmin && (
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

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { name, phone, position, bio } }),
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
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              Upload foto profil akan tersedia pada fase berikutnya.
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
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
