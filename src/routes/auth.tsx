// ponytail: Redesain total halaman masuk/daftar dengan visual premium, efek glow/mesh, glassmorphism, dan fitur mata pada password (eye toggle)
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
    <div className="min-h-screen flex bg-[#030712] font-sans antialiased overflow-hidden relative">
      {/* LEFT SIDE: Brand Showcase & Content (50% width on desktop, elements 30% larger, aligned 20% to the left) */}
      <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-gradient-to-br from-[#090d1a] via-[#0d1530] to-[#1e1b4b] text-white select-none border-r border-white/5">
        {/* Animated dynamic gradient light mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff04_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-80"></div>
        <div className="absolute top-[-20%] right-[-20%] w-[90%] h-[90%] bg-gradient-to-tr from-[#312e81]/30 to-[#4f46e5]/20 rounded-full blur-[120px] animate-pulse duration-10000"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-[#1e1b4b]/40 to-[#4f46e5]/10 rounded-full blur-[100px]"></div>

        {/* Content Wrapper aligned centrally with larger max-width */}
        <div className="relative flex flex-col justify-between h-full z-10 max-w-md ml-[20%] mr-auto w-full">
          {/* Brand Header (30% larger) */}
          <div className="flex items-center gap-4.5 group">
            <div className="w-13 h-13 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:border-primary/50 group-hover:bg-primary/10">
              <FileText className="w-7 h-7 text-primary-light animate-pulse" />
            </div>
            <div>
              <span className="font-black text-xl tracking-wider uppercase bg-gradient-to-r from-white via-white to-primary-light bg-clip-text text-transparent">Log Book</span>
              <span className="block text-[10px] text-white/40 tracking-widest uppercase font-bold mt-0.5">Workspace</span>
            </div>
          </div>

          {/* Hero Message (30% larger) */}
          <div className="space-y-8 my-auto py-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin duration-3000" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/90">Edisi v2.0 • Premium</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
                Sederhana.<br />
                <span className="bg-gradient-to-r from-white via-primary-light to-sky-400 bg-clip-text text-transparent">Teratur. Tenang.</span>
              </h1>
              <p className="text-base lg:text-lg text-white/70 leading-relaxed font-medium">
                Aplikasi logbook harian tim untuk menyusun laporan, kalender jadwal, dan pelacak progres tanpa beban kerja tambahan.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex gap-4 items-center group/item">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md transition-all group-hover/item:border-emerald-500/50 group-hover/item:bg-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-base font-semibold text-white/90 group-hover/item:text-white transition-colors">Rencana Tugas Terpadu</span>
              </div>
              <div className="flex gap-4 items-center group/item">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md transition-all group-hover/item:border-sky-500/50 group-hover/item:bg-sky-500/10">
                  <Clock className="w-4 h-4 text-sky-400" />
                </div>
                <span className="text-base font-semibold text-white/90 group-hover/item:text-white transition-colors">Pelacakan Waktu Harian</span>
              </div>
              <div className="flex gap-4 items-center group/item">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md transition-all group-hover/item:border-indigo-500/50 group-hover/item:bg-indigo-500/10">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="text-base font-semibold text-white/90 group-hover/item:text-white transition-colors">Ekspor Laporan Cepat</span>
              </div>
            </div>
          </div>

          {/* Live Preview Card (30% larger) */}
          <div className="w-full rounded-3xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-3xl shadow-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Aktivitas Workspace</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex gap-3.5 items-center relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">Laporan berhasil terbit</div>
                <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mt-0.5">Baru saja</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form (50% width on desktop) */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 py-12 lg:px-20 bg-gradient-to-tr from-[#05070f] via-[#090d16] to-[#0e111d] relative overflow-hidden">
        {/* Neon Glow Effects */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[140px] -z-10 animate-pulse duration-8000"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-500/[0.04] rounded-full blur-[120px] -z-10"></div>

        {/* Content Wrapper aligned centrally */}
        <div className="w-full max-w-sm mx-auto space-y-8 relative z-10">
          {/* Logo & Header for Mobile */}
          <div className="flex flex-col items-center mb-2 md:hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shadow-2xl">
              <FileText className="w-6 h-6 text-primary-light" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Log Book</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">
              Sederhana • Teratur • Tenang
            </p>
          </div>

          {/* Welcome Header for Desktop */}
          <div className="space-y-2.5 hidden md:block">
            <div className="inline-flex items-center gap-2 text-primary-light font-bold text-xs tracking-wider uppercase mb-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary-light" />
              <span>Log Book App</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white">Selamat Datang</h2>
            <p className="text-sm text-slate-400">
              Masuk atau daftarkan akun baru Anda untuk melanjutkan.
            </p>
          </div>

          <Card className="border border-white/5 bg-white/[0.02] backdrop-blur-3xl shadow-[0_30px_70px_rgba(0,0,0,0.4)] rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-white/[0.03] border border-white/5 p-1 rounded-2xl">
                  <TabsTrigger value="login" className="rounded-xl py-2.5 font-bold text-xs tracking-wider transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
                    MASUK
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-xl py-2.5 font-bold text-xs tracking-wider transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
                    DAFTAR
                  </TabsTrigger>
                </TabsList>

                {/* LOGIN TAB */}
                <TabsContent value="login" className="mt-6 focus-visible:outline-none">
                  <form onSubmit={handleLogin} className="space-y-4.5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-xs font-semibold text-slate-300">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-white/5 bg-white/[0.02] px-4 py-6 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:border-primary/50 focus-visible:bg-white/[0.04] shadow-none transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-xs font-semibold text-slate-300">Kata Sandi</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="rounded-2xl border-white/5 bg-white/[0.02] px-4 py-6 pr-11 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:border-primary/50 focus-visible:bg-white/[0.04] shadow-none transition-all duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white shadow-[0_10px_25px_rgba(79,70,229,0.25)] hover:shadow-[0_12px_30px_rgba(79,70,229,0.35)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
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
                  <form onSubmit={handleSignup} className="space-y-4.5">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-300">Nama Lengkap</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        required
                        value={nameSignup}
                        onChange={(e) => setNameSignup(e.target.value)}
                        placeholder="Nama Lengkap Anda"
                        className="rounded-2xl border-white/5 bg-white/[0.02] px-4 py-6 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:border-primary/50 focus-visible:bg-white/[0.04] shadow-none transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-300">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-white/5 bg-white/[0.02] px-4 py-6 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:border-primary/50 focus-visible:bg-white/[0.04] shadow-none transition-all duration-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-300">Kata Sandi</Label>
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
                          className="rounded-2xl border-white/5 bg-white/[0.02] px-4 py-6 pr-11 text-sm text-white placeholder:text-slate-500 focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:border-primary/50 focus-visible:bg-white/[0.04] shadow-none transition-all duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white shadow-[0_10px_25px_rgba(79,70,229,0.25)] hover:shadow-[0_12px_30px_rgba(79,70,229,0.35)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
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
