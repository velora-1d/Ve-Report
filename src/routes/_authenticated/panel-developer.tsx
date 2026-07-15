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
  Plus,
  Pencil,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import {
  users as usersTable,
  tasks as tasksTable,
  schedules as schedulesTable,
  trackerLogs as logsTable,
  reports as reportsTable,
  systemLogs as systemLogsTable,
  divisions as divisionsTable,
  userDivisions as userDivisionsTable,
  divisionValidators as divisionValidatorsTable,
} from "@/db/schema";
import { eq, desc, lt, count, inArray } from "drizzle-orm";
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

// ponytail: Server function untuk mengambil daftar admin dan developer
const getAdminsList = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  if (session.user.role !== "developer") throw new Error("Forbidden");

  return await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(inArray(usersTable.role, ["admin", "developer"]))
    .orderBy(usersTable.name);
});

// ponytail: Server function untuk mengambil data divisi & verifikatornya
const getDivisionsData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  if (session.user.role !== "developer") throw new Error("Forbidden");

  const divisionsList = await db.select().from(divisionsTable).orderBy(divisionsTable.name);
  
  const result = [];
  for (const div of divisionsList) {
    const userCountRes = await db
      .select({ value: count() })
      .from(userDivisionsTable)
      .where(eq(userDivisionsTable.divisionId, div.id));
      
    const validatorsList = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
      })
      .from(divisionValidatorsTable)
      .innerJoin(usersTable, eq(divisionValidatorsTable.userId, usersTable.id))
      .where(eq(divisionValidatorsTable.divisionId, div.id));

    result.push({
      id: div.id,
      name: div.name,
      userCount: userCountRes[0]?.value ?? 0,
      validators: validatorsList,
    });
  }
  return result;
});

// ponytail: Server function untuk menambah divisi baru
const createDivision = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    if (session.user.role !== "developer") throw new Error("Forbidden");

    await db.insert(divisionsTable).values({ name: data.name });
  });

// ponytail: Server function untuk mengubah nama divisi
const updateDivisionName = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    if (session.user.role !== "developer") throw new Error("Forbidden");

    await db
      .update(divisionsTable)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(divisionsTable.id, data.id));
  });

// ponytail: Server function untuk menghapus divisi
const deleteDivisionData = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    if (session.user.role !== "developer") throw new Error("Forbidden");

    await db.delete(divisionsTable).where(eq(divisionsTable.id, id));
  });

// ponytail: Server function untuk mengupdate verifikator divisi
const updateDivisionValidators = createServerFn({ method: "POST" })
  .validator(z.object({ divisionId: z.string(), validatorIds: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    if (session.user.role !== "developer") throw new Error("Forbidden");

    await db.delete(divisionValidatorsTable).where(eq(divisionValidatorsTable.divisionId, data.divisionId));

    if (data.validatorIds.length > 0) {
      const values = data.validatorIds.map((uId) => ({
        divisionId: data.divisionId,
        userId: uId,
      }));
      await db.insert(divisionValidatorsTable).values(values);
    }
  });

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

      <DivisionCrudCard />

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

// ===== CARD CRUD DIVISI & VALIDATOR =====
// ponytail: Komponen untuk mengelola divisi dan menugaskan validator divisi
function DivisionCrudCard() {
  const qc = useQueryClient();
  const [newDivName, setNewDivName] = useState("");
  const [editingDiv, setEditingDiv] = useState<any | null>(null);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [validatorsOpen, setValidatorsOpen] = useState(false);
  const [activeDivId, setActiveDivId] = useState<string | null>(null);
  const [selectedValidatorIds, setSelectedValidatorIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: divisionsList, isLoading: divLoading } = useQuery({
    queryKey: ["divisions-data"],
    queryFn: () => getDivisionsData(),
  });

  const { data: adminsList } = useQuery({
    queryKey: ["admins-list"],
    queryFn: () => getAdminsList(),
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => createDivision({ data: { name } }),
    onSuccess: () => {
      toast.success("Divisi baru berhasil dibuat");
      setNewDivName("");
      qc.invalidateQueries({ queryKey: ["divisions-data"] });
    },
    onError: (e: Error) => toast.error("Gagal membuat divisi", { description: e.message }),
  });

  const editMutation = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateDivisionName({ data: v }),
    onSuccess: () => {
      toast.success("Nama divisi diperbarui");
      setEditNameOpen(false);
      qc.invalidateQueries({ queryKey: ["divisions-data"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDivisionData({ data: id }),
    onSuccess: () => {
      toast.success("Divisi berhasil dihapus");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["divisions-data"] });
    },
    onError: (e: Error) => toast.error("Gagal menghapus", { description: e.message }),
  });

  const saveValidatorsMutation = useMutation({
    mutationFn: (v: { divisionId: string; validatorIds: string[] }) => updateDivisionValidators({ data: v }),
    onSuccess: () => {
      toast.success("Verifikator divisi berhasil diperbarui");
      setValidatorsOpen(false);
      qc.invalidateQueries({ queryKey: ["divisions-data"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui verifikator", { description: e.message }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim()) return;
    addMutation.mutate(newDivName.trim());
  };

  const openEditName = (div: any) => {
    setEditingDiv(div);
    setNewDivName(div.name);
    setEditNameOpen(true);
  };

  const openValidators = (div: any) => {
    setActiveDivId(div.id);
    setSelectedValidatorIds(div.validators.map((v: any) => v.id));
    setValidatorsOpen(true);
  };

  return (
    <Card className="surface-card border-0">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Manajemen Divisi & Validator
        </CardTitle>
        <CardDescription>
          Kelola divisi perusahaan dan tunjuk admin/validator khusus untuk tiap divisi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1">
            <Input
              value={newDivName}
              onChange={(e) => setNewDivName(e.target.value)}
              placeholder="Nama Divisi Baru (misal: Kepesantrenan)"
              className="h-10 rounded-2xl bg-slate-50/50"
              required
            />
          </div>
          <Button type="submit" disabled={addMutation.isPending} className="px-5 rounded-2xl h-10 bg-primary text-white">
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Tambah Divisi
          </Button>
        </form>

        {divLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100">
                <tr>
                  <th className="p-3.5 text-left font-bold text-slate-700 dark:text-slate-300">Nama Divisi</th>
                  <th className="p-3.5 text-left font-bold text-slate-700 dark:text-slate-300">Jumlah Staff</th>
                  <th className="p-3.5 text-left font-bold text-slate-700 dark:text-slate-300">Validator (Atasan)</th>
                  <th className="p-3.5 text-right font-bold text-slate-700 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divisionsList && divisionsList.length > 0 ? (
                  divisionsList.map((div) => (
                    <tr key={div.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors duration-150">
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-150">{div.name}</td>
                      <td className="p-3.5">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-none font-bold py-1">
                          <Users className="w-3.5 h-3.5 mr-1" /> {div.userCount} Orang
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        {div.validators.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {div.validators.map((v: any) => (
                              <Badge key={v.id} className="bg-primary/10 text-primary hover:bg-primary/15 border-none text-[11px] font-bold py-0.5 px-2 rounded-lg">
                                {v.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum ada validator</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <Button variant="outline" size="sm" onClick={() => openValidators(div)} className="h-8 rounded-xl text-xs font-bold">
                          Validator
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditName(div)} className="h-8 rounded-xl">
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingId(div.id)} className="h-8 rounded-xl text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 italic">Belum ada divisi kerja</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Dialog Edit Nama Divisi */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-900">Edit Nama Divisi</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Masukkan nama baru untuk divisi ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Nama Divisi</Label>
              <Input
                value={newDivName}
                onChange={(e) => setNewDivName(e.target.value)}
                placeholder="misal: Ngajar/Fasilitator"
                className="rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditNameOpen(false)} className="rounded-2xl">Batal</Button>
            <Button
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate({ id: editingDiv.id, name: newDivName.trim() })}
              className="rounded-2xl bg-primary text-white"
            >
              {editMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelola Validator */}
      <Dialog open={validatorsOpen} onOpenChange={setValidatorsOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg text-slate-900">Kelola Validator Divisi</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Pilih siapa saja admin yang menjadi penanggung jawab validasi divisi ini.</DialogDescription>
          </DialogHeader>
          <div className="py-3 max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
            {adminsList && adminsList.length > 0 ? (
              adminsList.map((admin) => (
                <label key={admin.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all duration-150">
                  <Checkbox
                    id={`val-${admin.id}`}
                    checked={selectedValidatorIds.includes(admin.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedValidatorIds([...selectedValidatorIds, admin.id]);
                      } else {
                        setSelectedValidatorIds(selectedValidatorIds.filter((id) => id !== admin.id));
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{admin.name}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{admin.email}</div>
                  </div>
                </label>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-4">Tidak ada admin/developer tersedia</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setValidatorsOpen(false)} className="rounded-2xl">Batal</Button>
            <Button
              disabled={saveValidatorsMutation.isPending}
              onClick={() => saveValidatorsMutation.mutate({ divisionId: activeDivId!, validatorIds: selectedValidatorIds })}
              className="rounded-2xl bg-primary text-white"
            >
              {saveValidatorsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Validator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-lg text-slate-900">Hapus Divisi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Tindakan ini permanen. Seluruh penugasan divisi staf pada divisi ini akan dihapus. Logbook yang terkait divisi ini tidak akan terhapus namun asosiasi divisinya akan menjadi kosong.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-2xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/95 text-white rounded-2xl"
              onClick={() => deleteMutation.mutate(deletingId!)}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
