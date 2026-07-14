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

    const logs = await db.query.systemLogs.findMany({
      where: levelFilter !== "all" ? eq(systemLogsTable.level, levelFilter) : undefined,
      orderBy: [desc(systemLogsTable.createdAt)],
      limit: 200,
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

      <TelegramConfigCard />

      <Card className="surface-card border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Log Sistem</CardTitle>
            <CardDescription>200 log terbaru.</CardDescription>
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
              onClick={() => clearLogs.mutate()}
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
    </div>
  );
}

function TelegramConfigCard() {
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [testing, setTesting] = useState(false);

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
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF…"
            />
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
