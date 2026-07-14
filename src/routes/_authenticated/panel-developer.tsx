// ponytail: Mengganti query Supabase client-side pada panel developer dengan Server Functions Drizzle ORM
// ponytail: Menyimpan token Telegram ke LocalStorage karena konfigurasi ini hanya digunakan untuk uji coba notifikasi (YAGNI)
import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Terminal,
  Send,
  Database as DbIcon,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import {
  users as usersTable,
  tasks as tasksTable,
  schedules as schedulesTable,
  trackerLogs as logsTable,
  reports as reportsTable,
  systemLogs as systemLogsTable,
} from "@/db/schema";
import { eq, desc, lt, count } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { getAppConfig, saveAppConfig } from "@/lib/app-config";
import { ShieldAlert, Database, Cloud, Eye, EyeOff } from "lucide-react";
import { testRustFSConnection, getRustFSConfig } from "@/lib/storage";
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

type LogLevel = "info" | "warning" | "error" | "critical";

const LEVEL_TONE: Record<LogLevel, string> = {
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  error: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  critical: "bg-red-600/20 text-red-700 dark:text-red-400",
};

// ponytail: Fungsi server untuk mengambil total row dari tabel utama untuk kesehatan DB
const getDeveloperStats = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  if (session.user.role !== "developer") throw new Error("Forbidden");

  const [usersCount, tasksCount, schedulesCount, logsCount, reportsCount] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(tasksTable),
    db.select({ value: count() }).from(schedulesTable),
    db.select({ value: count() }).from(logsTable),
    db.select({ value: count() }).from(reportsTable),
  ]);

  return [
    { table: "user", count: usersCount[0]?.value ?? 0 },
    { table: "tasks", count: tasksCount[0]?.value ?? 0 },
    { table: "schedules", count: schedulesCount[0]?.value ?? 0 },
    { table: "tracker_logs", count: logsCount[0]?.value ?? 0 },
    { table: "reports", count: reportsCount[0]?.value ?? 0 },
  ];
});

const getSystemLogs = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: levelFilter }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    if (session.user.role !== "developer") throw new Error("Forbidden");

    const configs = await db.query.appConfig.findMany({
      limit: 1,
    });
    const limitVal = configs[0]?.logLimit ?? 200;

    const logs = await db.query.systemLogs.findMany({
      where: levelFilter !== "all" ? eq(systemLogsTable.level, levelFilter) : undefined,
      orderBy: [desc(systemLogsTable.createdAt)],
      limit: limitVal,
    });

    return logs.map(l => ({
      id: l.id,
      level: l.level,
      category: l.category,
      message: l.message,
      createdAt: l.createdAt,
      userId: l.userId,
    }));
  });

// ponytail: Fungsi server untuk membersihkan log sistem lama
const clearSystemLogs = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  if (session.user.role !== "developer") throw new Error("Forbidden");

  const dateLimit = new Date(Date.now() - 30 * 86400_000);
  await db.delete(systemLogsTable).where(lt(systemLogsTable.createdAt, dateLimit));
});

// ponytail: Fungsi server untuk mencatat aktivitas log sistem baru
const logSystemInfo = createServerFn({ method: "POST" })
  .validator(z.object({ category: z.string(), message: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    await db.insert(systemLogsTable).values({
      level: "info",
      category: data.category,
      message: data.message,
      userId: session?.user?.id || null,
    });
  });

export const Route = createFileRoute("/_authenticated/panel-developer")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session || !session.user) throw redirect({ to: "/auth" });
    if (session.user.role !== "developer") {
      throw redirect({ to: "/dasbor" });
    }
  },
  head: () => ({
    meta: [
      { title: "Panel Developer — Log Book" },
      {
        name: "description",
        content: "Log sistem, status database, konfigurasi Telegram.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PanelDeveloperPage,
});

function PanelDeveloperPage() {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });

  const {
    data: logs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["system-logs", levelFilter],
    queryFn: () => getSystemLogs({ data: levelFilter }),
  });

  const { data: dbHealth } = useQuery({
    queryKey: ["db-health"],
    queryFn: () => getDeveloperStats(),
  });

  const clearLogs = useMutation({
    mutationFn: () => clearSystemLogs(),
    onSuccess: () => {
      toast.success("Log > 30 hari dibersihkan");
      refetchLogs();
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" /> Panel Developer
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Log sistem, kesehatan database, dan konfigurasi bot Telegram.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(dbHealth ?? []).map((h) => (
          <Card key={h.table} className="surface-card border-0">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <DbIcon className="w-3 h-3" /> {h.table}
              </div>
              <div className="text-xl font-semibold mt-1">
                {h.count.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TelegramConfigCard />
        <RustFsConfigCard />
      </div>

      <RbacMatrixCard />

      <Card className="surface-card border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Log Sistem</CardTitle>
            <CardDescription>{config?.logLimit ?? 200} log terbaru.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua level</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearLogs.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Bersihkan &gt; 30 hari
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Belum ada log.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {logs!.map((l: any) => (
                <li
                  key={l.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm"
                >
                  <Badge
                    className={`${LEVEL_TONE[l.level as LogLevel]} shrink-0 text-[10px]`}
                  >
                    {l.level}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{l.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.category && (
                        <span className="mr-2">[{l.category}]</span>
                      )}
                      {l.createdAt ? format(new Date(l.createdAt), "d MMM yyyy HH:mm:ss", {
                        locale: idLocale,
                      }) : "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="surface-card border-none rounded-2xl p-6 shadow-soft max-w-sm mx-auto">
          <AlertDialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-650 scale-110">
              <Trash2 className="w-6 h-6 animate-pulse text-red-600" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
              Bersihkan Log Sistem?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Apakah Anda yakin ingin menghapus permanen semua log sistem yang berumur lebih dari 30 hari? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold text-xs py-2">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearLogs.mutate();
                setShowClearConfirm(false);
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold text-xs py-2 shadow-md hover:shadow-lg transition-all"
            >
              Ya, Bersihkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TelegramConfigCard() {
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("telegram_bot_token") ?? "");
    setChatId(localStorage.getItem("telegram_chat_id") ?? "");
  }, []);

  const save = () => {
    localStorage.setItem("telegram_bot_token", token);
    localStorage.setItem("telegram_chat_id", chatId);
    toast.success("Konfigurasi Telegram disimpan");
  };

  const sendTest = async () => {
    if (!token || !chatId) {
      toast.error("Token dan Chat ID wajib diisi terlebih dulu");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🔔 Uji coba notifikasi dari Log Book",
          }),
        },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.description || "Gagal mengirim");
      toast.success("Pesan tes terkirim");
      
      await logSystemInfo({
        data: {
          category: "telegram",
          message: "Uji coba notifikasi Telegram berhasil",
        }
      });
    } catch (e) {
      toast.error("Gagal mengirim tes", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Konfigurasi Bot Telegram
        </CardTitle>
        <CardDescription>
          Token bot dari @BotFather dan Chat ID target untuk notifikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF…"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showToken ? (
                  <EyeOff className="w-4.5 h-4.5" />
                ) : (
                  <Eye className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Chat ID</Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={sendTest} disabled={testing}>
            {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kirim Tes
          </Button>
          <Button onClick={save}>
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RbacMatrixCard() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });

  const [permissions, setPermissions] = useState<any>({
    admin: {
      menus: ["dasbor", "tugas", "pelacak", "validasi", "laporan", "manajemen-pengguna", "pengaturan"],
      actions: {
        tugas: ["create", "read", "update", "delete"],
        pelacak: ["create", "read", "update", "delete"],
        validasi: ["create", "read", "update", "delete"],
        laporan: ["create", "read", "update", "delete"],
        pengguna: ["create", "read", "update", "delete"]
      }
    },
    staff: {
      menus: ["dasbor", "tugas", "pelacak", "laporan", "pengaturan"],
      actions: {
        tugas: ["create", "read", "update"],
        pelacak: ["create", "read", "update"],
        validasi: [],
        laporan: ["create", "read"],
        pengguna: []
      }
    }
  });

  useEffect(() => {
    if (config?.permissions) {
      setPermissions(config.permissions);
    }
  }, [config]);

  const save = useMutation({
    mutationFn: (nextPermissions: any) =>
      saveAppConfig({
        data: {
          id: config?.id,
          permissions: nextPermissions,
        },
      }),
    onSuccess: () => {
      toast.success("RBAC Matrix berhasil disimpan");
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menyimpan RBAC Matrix", { description: e.message }),
  });

  const toggleMenu = (role: string, menuKey: string) => {
    const current = permissions[role]?.menus || [];
    const nextMenus = current.includes(menuKey)
      ? current.filter((m: string) => m !== menuKey)
      : [...current, menuKey];

    setPermissions({
      ...permissions,
      [role]: {
        ...permissions[role],
        menus: nextMenus,
      },
    });
  };

  const toggleAction = (role: string, moduleKey: string, actionKey: string) => {
    const currentActions = permissions[role]?.actions?.[moduleKey] || [];
    const nextActions = currentActions.includes(actionKey)
      ? currentActions.filter((a: string) => a !== actionKey)
      : [...currentActions, actionKey];

    setPermissions({
      ...permissions,
      [role]: {
        ...permissions[role],
        actions: {
          ...(permissions[role]?.actions || {}),
          [moduleKey]: nextActions,
        },
      },
    });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const appName = config?.appName || "Log Book";

  const AVAILABLE_MENUS = [
    { key: "dasbor", label: "Dasbor" },
    { key: "tugas", label: `${appName} Meeting` },
    { key: "pelacak", label: `${appName} Harian` },
    { key: "validasi", label: "Validasi Log" },
    { key: "laporan", label: "Laporan" },
    { key: "manajemen-pengguna", label: "Pengguna" },
    { key: "pengaturan", label: "Pengaturan" },
    { key: "branding", label: "Branding & Logo" },
    { key: "pdf", label: "Konfigurasi PDF" },
    { key: "panel-developer", label: "Panel Developer" },
  ];

  const MODULES = [
    { key: "tugas", label: `${appName} Meeting (Tugas)` },
    { key: "pelacak", label: `${appName} Harian (Tracker)` },
    { key: "validasi", label: "Validasi Log" },
    { key: "laporan", label: "Laporan" },
    { key: "pengguna", label: "Pengguna" },
    { key: "pengaturan", label: "Pengaturan" },
    { key: "branding", label: "Branding & Logo" },
    { key: "pdf", label: "Konfigurasi PDF" },
  ];

  const ACTIONS = [
    { key: "create", label: "Create" },
    { key: "read", label: "Read" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
  ];

  const renderRoleSection = (role: "admin" | "staff", title: string) => {
    const rolePermissions = permissions[role] || { menus: [], actions: {} };

    return (
      <div className="space-y-6 bg-muted/15 p-4 rounded-xl border border-border/40">
        <div>
          <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Konfigurasi hak akses menu & tindakan CRUD.</p>
        </div>

        {/* Akses Menu */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground">Akses Menu Halaman</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVAILABLE_MENUS.map((menu) => {
              const isChecked = rolePermissions.menus.includes(menu.key);
              return (
                <label
                  key={menu.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 hover:bg-muted/30 cursor-pointer transition-all select-none text-xs"
                >
                  <Checkbox
                    id={`${role}-menu-${menu.key}`}
                    checked={menu.key === "panel-developer" ? false : isChecked}
                    disabled={menu.key === "panel-developer"}
                    onCheckedChange={() => toggleMenu(role, menu.key)}
                  />
                  <span className="font-medium text-foreground/80">{menu.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Akses CRUD Tindakan */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-foreground">Akses Tindakan CRUD Modul</Label>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                  <th className="p-3">Modul</th>
                  {ACTIONS.map((act) => (
                    <th key={act.key} className="p-3 text-center w-20">{act.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {MODULES.map((mod) => {
                  const allowedActions = rolePermissions.actions?.[mod.key] || [];
                  return (
                    <tr key={mod.key} className="hover:bg-muted/10">
                      <td className="p-3 font-semibold text-foreground/80">{mod.label}</td>
                      {ACTIONS.map((act) => {
                        const isChecked = allowedActions.includes(act.key);
                        return (
                          <td key={act.key} className="p-3 text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                id={`${role}-action-${mod.key}-${act.key}`}
                                checked={isChecked}
                                onCheckedChange={() => toggleAction(role, mod.key, act.key)}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" /> Matrix Hak Akses (RBAC)
        </CardTitle>
        <CardDescription>
          Halaman kontrol khusus Developer untuk mengatur menu aktif dan tindakan CRUD tiap role pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderRoleSection("admin", "Admin Role")}
          {renderRoleSection("staff", "Staff/User Biasa Role")}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate(permissions)} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan Matrix Akses
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RustFsConfigCard() {
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["rustfs-config-dev-panel"],
    queryFn: () => getRustFSConfig(),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await testRustFSConnection();
      if (res?.success) {
        toast.success(res.message);
      }
    } catch (e: any) {
      toast.error("Gagal menghubungkan ke S3 RustFS", {
        description: e.message || String(e),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[#0077B6]" /> Uji Koneksi RustFS (S3)
        </CardTitle>
        <CardDescription>
          Verifikasi konfigurasi penyimpanan S3 RustFS dari environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div><strong className="text-slate-800 dark:text-white">Provider:</strong> {config?.provider}</div>
            <div><strong className="text-slate-800 dark:text-white">Endpoint:</strong> {config?.endpoint}</div>
            <div><strong className="text-slate-800 dark:text-white">Bucket:</strong> {config?.bucket}</div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={testConnection} disabled={testing} className="bg-gradient-to-r from-[#0077B6] to-[#0077B6]/90 hover:from-[#0077B6]/95 hover:to-[#0077B6]/85 text-white font-semibold rounded-xl text-xs py-2 shadow-sm">
            {testing && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Uji Koneksi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
