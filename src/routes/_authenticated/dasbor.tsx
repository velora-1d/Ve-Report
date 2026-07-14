import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  ListTodo,
  TrendingUp,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminOrDev } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge } from "@/components/tasks/status-badges";
import { formatDuration, todayISO } from "@/lib/tracker";

export const Route = createFileRoute("/_authenticated/dasbor")({
  head: () => ({
    meta: [
      { title: "Dasbor — Log Book" },
      {
        name: "description",
        content:
          "Ringkasan tugas harian, progres mingguan, dan aktivitas terbaru tim Anda.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DasborPage,
});

function DasborPage() {
  const { data: user } = useCurrentUser();
  const isTeamView = user ? isAdminOrDev(user.roles) : false;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, isTeamView],
    enabled: !!user?.id,
    queryFn: async () => {
      // Tasks: assigned to user (staff) or all (admin/dev)
      let tasksQ = supabase
        .from("tasks")
        .select("id,title,status,priority,due_date,assigned_to,updated_at")
        .order("updated_at", { ascending: false });
      if (!isTeamView) tasksQ = tasksQ.eq("assigned_to", user!.id);
      const { data: tasks, error: te } = await tasksQ;
      if (te) throw te;

      // Tracker: this week for current user
      const now = new Date();
      const dow = (now.getDay() + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dow);
      const weekStartISO = weekStart.toISOString().slice(0, 10);
      const { data: logs, error: le } = await supabase
        .from("tracker_logs")
        .select("duration_minutes,logged_date")
        .eq("user_id", user!.id)
        .gte("logged_date", weekStartISO);
      if (le) throw le;

      // Upcoming schedules today+
      const { data: schedules, error: se } = await supabase
        .from("schedules")
        .select("id,title,start_time,end_time")
        .eq("user_id", user!.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(5);
      if (se) throw se;

      return {
        tasks: tasks ?? [],
        logs: logs ?? [],
        schedules: schedules ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const today = todayISO();
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const doneToday = tasks.filter(
      (t) => t.status === "done" && t.updated_at?.slice(0, 10) === today,
    ).length;
    const weekMin = (data?.logs ?? []).reduce(
      (s, l) => s + (l.duration_minutes ?? 0),
      0,
    );
    return { todo, inProgress, doneToday, weekMin };
  }, [data]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return (data?.tasks ?? [])
      .filter((t) => t.due_date && t.status !== "done")
      .map((t) => ({
        ...t,
        days: differenceInCalendarDays(new Date(t.due_date!), now),
      }))
      .filter((t) => t.days >= 0 && t.days <= 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
  }, [data]);

  const recentTasks = useMemo(() => (data?.tasks ?? []).slice(0, 5), [data]);

  const cards = [
    {
      label: "Belum Dikerjakan",
      value: stats.todo,
      icon: ListTodo,
      tone: "text-muted-foreground",
    },
    {
      label: "Dikerjakan",
      value: stats.inProgress,
      icon: Clock,
      tone: "text-info",
    },
    {
      label: "Selesai Hari Ini",
      value: stats.doneToday,
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Waktu Minggu Ini",
      value: formatDuration(stats.weekMin),
      icon: TrendingUp,
      tone: "text-primary",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Halo, {user?.name?.split(" ")[0] ?? "Pengguna"} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isTeamView
            ? "Ringkasan aktivitas tugas seluruh tim."
            : "Berikut ringkasan aktivitas tugas dan jadwal Anda hari ini."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="surface-card border-0">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon className={`w-4 h-4 ${s.tone}`} />
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {isLoading ? <Skeleton className="h-7 w-12" /> : s.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Deadline
              Mendekat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada tugas dengan deadline dalam 7 hari ke depan.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlines.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/tugas"
                        className="text-sm font-medium truncate block hover:text-primary"
                      >
                        {t.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <PriorityBadge priority={t.priority} />
                        <span className="text-xs text-muted-foreground">
                          {t.days === 0
                            ? "Hari ini"
                            : t.days === 1
                              ? "Besok"
                              : `${t.days} hari lagi`}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Jadwal
              Berikutnya
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (data?.schedules ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada jadwal mendatang. Buat jadwal dari menu Tugas &
                Jadwal.
              </p>
            ) : (
              <ul className="space-y-2">
                {data!.schedules.map((s) => (
                  <li key={s.id} className="p-2 rounded-lg hover:bg-muted/50">
                    <div className="text-sm font-medium truncate">
                      {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(s.start_time), "EEE, d MMM • HH:mm", {
                        locale: idLocale,
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle className="text-base">Tugas Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada tugas.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentTasks.map((t) => (
                <li
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {t.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Diperbarui{" "}
                      {format(new Date(t.updated_at), "d MMM, HH:mm", {
                        locale: idLocale,
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
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
