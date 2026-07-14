// ponytail: Redesain halaman auth dengan kontras 50/50 (kiri gelap-mewah, kanan terang-bersih-modern) dan merapikan logo/tulisan agar keterbacaan tinggi
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, CheckCircle2, Clock, ShieldCheck, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex bg-[#fafbfc] font-sans antialiased overflow-hidden relative">
      {/* LEFT SIDE: Brand Showcase & Content (50% width on desktop, elements 30% larger, aligned 20% to the left) */}
      <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#1e1b4b] text-white select-none border-r border-slate-800/10">
        {/* Subtle decorative mesh grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-80"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse duration-8000"></div>

        {/* Content Wrapper aligned centrally with larger max-width */}
        <div className="relative flex flex-col justify-between h-full z-10 max-w-md ml-[20%] mr-auto w-full">
          {/* Brand Header (30% larger) */}
          <div className="flex items-center gap-4.5">
            <div className="w-13 h-13 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl shadow-soft">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight uppercase text-white block">Log Book</span>
              <span className="block text-[10px] text-white/50 tracking-wider uppercase font-bold mt-0.5">Workspace</span>
            </div>
          </div>

          {/* Hero Message (30% larger) */}
          <div className="space-y-8 my-auto py-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/90">Edisi v2.0</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
                Sederhana.<br />Teratur. Tenang.
              </h1>
              <p className="text-base lg:text-lg text-white/80 leading-relaxed font-medium">
                Aplikasi logbook harian tim untuk menyusun laporan, kalender jadwal, dan pelacak progres tanpa beban kerja tambahan.
              </p>
            </div>

            <div className="space-y-4.5 pt-2">
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <span className="text-base font-bold text-white">Rencana Tugas Terpadu</span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                  <Clock className="w-4.5 h-4.5 text-sky-400" />
                </div>
                <span className="text-base font-bold text-white">Pelacakan Waktu Harian</span>
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <span className="text-base font-bold text-white">Ekspor Laporan Cepat</span>
              </div>
            </div>
          </div>

          {/* Live Preview Card (30% larger) */}
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Aktivitas Tim</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex gap-3.5 items-center">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">Laporan berhasil terbit</div>
                <div className="text-[10px] text-white/45 font-semibold mt-0.5">Baru saja</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form (50% width on desktop - Light Theme for beautiful contrast) */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 py-12 lg:px-20 bg-gradient-to-tr from-slate-50 via-white to-slate-50/60 relative overflow-hidden">
        {/* Soft background glow decoration */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse duration-10000"></div>

        {/* Content Wrapper aligned centrally */}
        <div className="w-full max-w-sm mx-auto space-y-8 relative z-10 animate-fade-in-up">
          {/* Logo & Header for Mobile */}
          <div className="flex flex-col items-center mb-2 md:hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-soft">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Log Book</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">
              Sederhana • Teratur • Tenang
            </p>
          </div>

          {/* Welcome Header for Desktop */}
          <div className="space-y-2 md:block">
            <div className="inline-flex items-center gap-1.5 text-primary font-bold text-xs tracking-wider uppercase mb-1 px-3 py-1 rounded-full bg-primary/10">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Log Book App</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Selamat Datang</h2>
            <p className="text-sm text-slate-500">
              Masuk atau daftarkan akun baru Anda untuk melanjutkan.
            </p>
          </div>

          <Card className="border border-slate-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-slate-50 border border-slate-100 p-1 rounded-2xl">
                  <TabsTrigger value="login" className="rounded-xl py-2.5 font-bold text-xs tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:shadow-soft data-[state=active]:text-primary text-slate-500">
                    MASUK
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-xl py-2.5 font-bold text-xs tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:shadow-soft data-[state=active]:text-primary text-slate-500">
                    DAFTAR
                  </TabsTrigger>
                </TabsList>

                {/* LOGIN TAB */}
                <TabsContent value="login" className="mt-6 focus-visible:outline-none">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs font-bold text-slate-700">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-slate-200 bg-slate-50/30 px-4 py-6 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-xs font-bold text-slate-700">Kata Sandi</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="rounded-2xl border-slate-200 bg-slate-50/30 px-4 py-6 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-primary hover:bg-primary/95 text-white shadow-[0_8px_20px_rgba(0,102,204,0.15)] hover:shadow-[0_10px_25px_rgba(0,102,204,0.25)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Masuk ke Akun
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* SIGNUP TAB */}
                <TabsContent value="signup" className="mt-6 focus-visible:outline-none">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs font-bold text-slate-700">Nama Lengkap</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        required
                        value={nameSignup}
                        onChange={(e) => setNameSignup(e.target.value)}
                        placeholder="Nama Lengkap Anda"
                        className="rounded-2xl border-slate-200 bg-slate-50/30 px-4 py-6 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-bold text-slate-700">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-slate-200 bg-slate-50/30 px-4 py-6 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs font-bold text-slate-700">Kata Sandi</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          className="rounded-2xl border-slate-200 bg-slate-50/30 px-4 py-6 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-primary hover:bg-primary/95 text-white shadow-[0_8px_20px_rgba(0,102,204,0.15)] hover:shadow-[0_10px_25px_rgba(0,102,204,0.25)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Daftar Akun Baru
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
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
    return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  return msg;
}
