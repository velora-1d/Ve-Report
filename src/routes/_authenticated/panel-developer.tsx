import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { fetchAppConfig, upsertAppConfig } from "@/lib/app-config";
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
import type { Database } from "@/integrations/supabase/types";

type LogLevel = Database["public"]["Enums"]["log_level"];

const LEVEL_TONE: Record<LogLevel, string> = {
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  error: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  critical: "bg-red-600/20 text-red-700 dark:text-red-400",
};

export const Route = createFileRoute("/_authenticated/panel-developer")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!roles?.some((r) => r.role === "developer")) {
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
    queryFn: async () => {
      let q = supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (levelFilter !== "all") q = q.eq("level", levelFilter as LogLevel);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dbHealth } = useQuery({
    queryKey: ["db-health"],
    queryFn: async () => {
      const tables = [
        "profiles",
        "tasks",
        "schedules",
        "tracker_logs",
        "reports",
      ] as const;
      const results = await Promise.all(
        tables.map(async (t) => {
          const { count } = await supabase
            .from(t)
            .select("*", { count: "exact", head: true });
          return { table: t, count: count ?? 0 };
        }),
      );
      return results;
    },
  });

  const clearLogs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_logs")
        .delete()
        .lt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString());
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Log > 30 hari dibersihkan");
      refetchLogs();
    },
    onError: (e: Error) => toast.error("Gagal", { description: e.message }),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
              {logs!.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm"
                >
                  <Badge
                    className={`${LEVEL_TONE[l.level]} shrink-0 text-[10px]`}
                  >
                    {l.level}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{l.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.category && (
                        <span className="mr-2">[{l.category}]</span>
                      )}
                      {format(new Date(l.created_at), "d MMM yyyy HH:mm:ss", {
                        locale: idLocale,
                      })}
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
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: fetchAppConfig,
  });
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) {
      setToken(data.telegram_bot_token ?? "");
      setChatId(data.telegram_chat_id ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await upsertAppConfig(
        {
          telegram_bot_token: token || null,
          telegram_chat_id: chatId || null,
        },
        data?.id,
      );
    },
    onSuccess: () => {
      toast.success("Konfigurasi Telegram disimpan");
      qc.invalidateQueries({ queryKey: ["app-config"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal menyimpan", { description: e.message }),
  });

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
      await supabase.from("system_logs").insert({
        level: "info",
        category: "telegram",
        message: "Uji coba notifikasi Telegram berhasil",
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
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
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
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
