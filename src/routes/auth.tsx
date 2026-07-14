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
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, CheckCircle2, Clock, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

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
    <div className="min-h-screen flex bg-surface-sunken font-sans antialiased overflow-hidden">
      {/* LEFT SIDE: Brand Showcase & Interactive Mockups (Visible on md+) */}
      <div className="hidden md:flex md:w-[52%] relative flex-col justify-between p-16 overflow-hidden bg-gradient-to-tr from-slate-950 via-primary/95 to-primary text-white select-none">
        {/* Subtle high-end mesh grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px] opacity-70"></div>
        
        {/* Ambient background glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-primary-soft/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-sky-400/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }}></div>

        {/* Brand Identity */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl shadow-soft">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
            Log Book
          </span>
        </div>

        {/* Dynamic Marketing Content */}
        <div className="relative my-auto z-10 max-w-md space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-2xs font-semibold tracking-wide uppercase text-white/90">Edisi Baru v2.0</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-black tracking-tight leading-[1.12] text-white">
              Sederhana.<br />Teratur. Tenang.
            </h1>
            <p className="text-base text-white/70 leading-relaxed font-medium">
              Aplikasi logbook tim modern untuk melacak jadwal, progres harian, dan menghasilkan laporan instan tanpa hambatan.
            </p>
          </div>

          <div className="space-y-4.5 pt-2">
            <div className="flex gap-4 items-start group">
              <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md transition-all group-hover:bg-white/25">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Rencana Tugas Terpadu</h4>
                <p className="text-xs text-white/60">Kalender tugas transparan untuk kemudahan kolaborasi.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start group">
              <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md transition-all group-hover:bg-white/25">
                <Clock className="w-3.5 h-3.5 text-sky-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Pelacakan Waktu Harian</h4>
                <p className="text-xs text-white/60">Input log waktu per kegiatan dengan sekali ketuk.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start group">
              <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md transition-all group-hover:bg-white/25">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Ekspor Laporan PDF & Excel</h4>
                <p className="text-xs text-white/60">Hasilkan berkas laporan rapi siap kirim dalam hitungan detik.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Dashboard Mockup Card */}
        <div className="relative mt-auto w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-10 transition-all hover:border-white/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xs font-bold text-white/50 uppercase tracking-widest">Aktivitas Tim</span>
            <div className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-2xs font-medium text-emerald-400">Live</span>
            </div>
          </div>
          <div className="space-y-3.5">
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">Laporan mingguan berhasil diterbitkan</div>
                <div className="text-3xs text-white/45">Baru saja oleh Developer</div>
              </div>
              <span className="text-3xs font-medium text-white/40 bg-white/10 px-2 py-0.5 rounded-full">PDF</span>
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                <Clock className="w-4 h-4 text-sky-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">4.5 jam ditambahkan ke sistem log</div>
                <div className="text-3xs text-white/45">15 menit yang lalu</div>
              </div>
              <span className="text-3xs font-medium text-white/40 bg-white/10 px-2 py-0.5 rounded-full">Log</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Aesthetic Minimalist Login/Signup Form */}
      <div className="w-full md:w-[48%] flex flex-col justify-center px-8 py-12 lg:px-16 bg-gradient-to-tr from-white via-surface to-slate-50/50 relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl -z-10"></div>

        <div className="w-full max-w-sm mx-auto space-y-8">
          {/* Logo & Header for Mobile Only */}
          <div className="flex flex-col items-center mb-2 md:hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-soft">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Log Book</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Sederhana • Teratur • Tenang
            </p>
          </div>

          {/* Welcome Text for Desktop */}
          <div className="space-y-2 hidden md:block">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground">
              Masuk atau daftarkan akun baru Anda untuk memulai.
            </p>
          </div>

          <Card className="border border-slate-100 bg-white shadow-[0_15px_35px_rgba(0,0,0,0.03)] rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-slate-50 border border-slate-100/80 p-1 rounded-2xl">
                  <TabsTrigger value="login" className="rounded-xl py-2.5 font-semibold text-xs tracking-wide transition-all data-[state=active]:bg-white data-[state=active]:shadow-soft data-[state=active]:text-primary text-slate-500">
                    MASUK
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-xl py-2.5 font-semibold text-xs tracking-wide transition-all data-[state=active]:bg-white data-[state=active]:shadow-soft data-[state=active]:text-primary text-slate-500">
                    DAFTAR
                  </TabsTrigger>
                </TabsList>

                {/* LOGIN TAB CONTENT */}
                <TabsContent value="login" className="mt-6 focus-visible:outline-none">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-slate-200/80 bg-slate-50/30 px-4 py-6 text-sm placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700">Kata Sandi</Label>
                      <Input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-2xl border-slate-200/80 bg-slate-50/30 px-4 py-6 text-sm placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all"
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-primary hover:bg-primary/95 text-white shadow-[0_4px_12px_rgba(0,102,204,0.15)] hover:shadow-[0_6px_20px_rgba(0,102,204,0.25)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
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

                {/* SIGNUP TAB CONTENT */}
                <TabsContent value="signup" className="mt-6 focus-visible:outline-none">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">Nama Lengkap</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        required
                        value={nameSignup}
                        onChange={(e) => setNameSignup(e.target.value)}
                        placeholder="Nama Lengkap Anda"
                        className="rounded-2xl border-slate-200/80 bg-slate-50/30 px-4 py-6 text-sm placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="rounded-2xl border-slate-200/80 bg-slate-50/30 px-4 py-6 text-sm placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">Kata Sandi</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="rounded-2xl border-slate-200/80 bg-slate-50/30 px-4 py-6 text-sm placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-1 focus-visible:border-primary focus-visible:bg-white shadow-none transition-all"
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-2xl py-6 font-bold text-sm bg-primary hover:bg-primary/95 text-white shadow-[0_4px_12px_rgba(0,102,204,0.15)] hover:shadow-[0_6px_20px_rgba(0,102,204,0.25)] transition-all duration-300 mt-2 flex items-center justify-center gap-2 group" disabled={loading}>
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
