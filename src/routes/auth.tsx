import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, CheckCircle2, Clock, Calendar, ShieldCheck } from "lucide-react";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Masuk — Log Book" },
      {
        name: "description",
        content:
          "Masuk ke akun Log Book Anda untuk mengelola tugas dan laporan tim.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameSignup, setNameSignup] = useState("");

  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session) {
      navigate({ to: search.redirect ?? "/dasbor", replace: true });
    }
  }, [session, navigate, search.redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Gagal masuk", {
        description: translateAuthError(error.message || "Email atau password salah"),
      });
      return;
    }
    toast.success("Berhasil masuk");
    navigate({ to: search.redirect ?? "/dasbor", replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: nameSignup || email.split("@")[0],
    });
    setLoading(false);
    if (error) {
      toast.error("Gagal mendaftar", {
        description: translateAuthError(error.message || "Gagal membuat akun"),
      });
      return;
    }
    toast.success("Akun berhasil dibuat", {
      description: "Silakan masuk dengan email dan kata sandi Anda.",
    });
  };

  return (
    <div className="min-h-screen flex bg-surface-sunken">
      {/* LEFT SIDE: Brand Showcase & Content (Visible on md+) */}
      <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-primary via-primary/95 to-slate-900 text-white">
        {/* Decorative Grid and Blur Elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-soft/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

        {/* Brand Header */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
            <FileText className="w-5.5 h-5.5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight uppercase">Log Book</span>
        </div>

        {/* Hero Message */}
        <div className="relative my-auto z-10 max-w-lg space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
            Sederhana.<br />Teratur. Tenang.
          </h1>
          <p className="text-base text-white/80 font-medium">
            Kelola tugas, pelacakan progres harian, dan pembuatan laporan tim Anda dalam satu tempat yang tertata rapi.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex gap-3.5 items-start">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-white/10 flex items-center justify-center border border-white/15">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-sm text-white/85 font-medium">Tugas & Agenda Tim Transparan</span>
            </div>
            <div className="flex gap-3.5 items-start">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-white/10 flex items-center justify-center border border-white/15">
                <Clock className="w-3 h-3 text-sky-400" />
              </div>
              <span className="text-sm text-white/85 font-medium">Pelacakan Waktu Harian yang Akurat</span>
            </div>
            <div className="flex gap-3.5 items-start">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-white/10 flex items-center justify-center border border-white/15">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
              </div>
              <span className="text-sm text-white/85 font-medium">Laporan PDF & Excel Siap Pakai</span>
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="relative mt-auto w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl shadow-2xl z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xs font-semibold text-white/60 uppercase tracking-widest">Aktivitas Terkini</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3 items-center">
              <div className="w-7.5 h-7.5 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Laporan Log Book berhasil di-generate</div>
                <div className="text-3xs text-white/50">Baru saja</div>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-7.5 h-7.5 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">4.5 jam ditambahkan ke Pelacak Progres</div>
                <div className="text-3xs text-white/50">20 menit yang lalu</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-12 md:p-16">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          {/* Logo & Header for Mobile */}
          <div className="flex flex-col items-center md:items-start mb-2 md:hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-soft">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Log Book</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Kelola tugas, jadwal, dan laporan tim
            </p>
          </div>

          <div className="space-y-2 text-center md:text-left hidden md:block">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground">
              Masuk atau daftar akun baru Anda untuk melanjutkan.
            </p>
          </div>

          <Card className="surface-card border-0 shadow-soft-lg p-1">
            <CardContent className="pt-6">
              <Tabs defaultValue="login">
                <TabsList className="grid grid-cols-2 w-full bg-surface-sunken p-1 rounded-xl">
                  <TabsTrigger value="login" className="rounded-lg py-2 font-medium">Masuk</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg py-2 font-medium">Daftar</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-xl border-border bg-surface shadow-soft-sm focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Kata Sandi</Label>
                      <Input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-xl border-border bg-surface shadow-soft-sm focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary"
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-xl py-6 font-semibold shadow-soft hover:shadow-soft-lg transition-all" disabled={loading}>
                      {loading && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Masuk ke Akun
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nama Lengkap</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        required
                        value={nameSignup}
                        onChange={(e) => setNameSignup(e.target.value)}
                        placeholder="Nama Lengkap Anda"
                        className="rounded-xl border-border bg-surface shadow-soft-sm focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-xl border-border bg-surface shadow-soft-sm focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Kata Sandi</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="rounded-xl border-border bg-surface shadow-soft-sm focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary"
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-xl py-6 font-semibold shadow-soft hover:shadow-soft-lg transition-all" disabled={loading}>
                      {loading && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Daftar Akun Baru
                    </Button>
                    <p className="text-2xs text-muted-foreground text-center mt-2 leading-relaxed">
                      Akun baru terdaftar otomatis sebagai **Staff**. Hubungi Developer/Admin untuk menaikkan tingkat peran.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credential")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Email sudah terdaftar. Silakan masuk.";
  if (m.includes("password"))
    return "Kata sandi tidak valid (minimal 6 karakter).";
  if (m.includes("rate limit"))
    return "Terlahu banyak percobaan. Coba lagi beberapa saat lagi.";
  return msg;
}
