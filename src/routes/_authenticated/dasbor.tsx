// ponytail: Menggunakan createServerFn untuk memindahkan kueri database ke server-side dengan Drizzle ORM demi keamanan role, performa, dan type safety tanpa Supabase client-side SDK.
import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
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
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { tasks as tasksTable, trackerLogs as logsTable, schedules as schedulesTable } from "@/db/schema";
import { eq, gte, and, desc } from "drizzle-orm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminOrDev } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge } from "@/components/tasks/status-badges";
import { formatDuration, todayISO } from "@/lib/tracker";

// ponytail: Fungsi server untuk mengambil data statistik dasbor terpadu
const getDashboardData = createServerFn({ method: "GET" })
  .validator((isTeamView: boolean) => isTeamView)
  .handler(async ({ data: isTeamView }) => {
    const session = await getSession();
    if (!session || !session.user) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;
    const role = session.user.role || "staff";
    const allowedTeamView = role === "developer" || role === "admin";
    const actualTeamView = isTeamView && allowedTeamView;

    // 1. Ambil data Tugas (Tasks)
    let tasksQuery;
    if (actualTeamView) {
      tasksQuery = db.query.tasks.findMany({
        orderBy: [desc(tasksTable.updatedAt)],
      });
    } else {
      tasksQuery = db.query.tasks.findMany({
        where: eq(tasksTable.assignedTo, userId),
        orderBy: [desc(tasksTable.updatedAt)],
      });
    }

    // 2. Ambil data Tracker Logs minggu ini
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    const weekStartISO = weekStart.toISOString().slice(0, 10);

    const logsQuery = db.query.trackerLogs.findMany({
      where: and(
        eq(logsTable.userId, userId),
        gte(logsTable.loggedDate, weekStartISO)
      ),
      columns: {
        durationMinutes: true,
        loggedDate: true,
      }
    });

    // 3. Ambil Jadwal Terdekat hari ini ke depan
    const schedulesQuery = db.query.schedules.findMany({
      where: and(
        eq(schedulesTable.userId, userId),
        gte(schedulesTable.startTime, now)
      ),
      orderBy: [desc(schedulesTable.startTime)],
      limit: 5,
    });

    const [tasks, logs, schedules] = await Promise.all([
      tasksQuery,
      logsQuery,
      schedulesQuery,
    ]);

    return {
      tasks,
      logs,
      schedules,
    };
  });

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
    queryFn: () => getDashboardData({ data: isTeamView }),
  });

  const stats = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const today = todayISO();
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const doneToday = tasks.filter(
      (t) => t.status === "done" && t.updatedAt && new Date(t.updatedAt).toISOString().slice(0, 10) === today,
    ).length;
    const weekMin = (data?.logs ?? []).reduce(
      (s, l) => s + (l.durationMinutes ?? 0),
      0,
    );
    return { todo, inProgress, doneToday, weekMin };
  }, [data]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return (data?.tasks ?? [])
      .filter((t) => t.dueDate && t.status !== "done")
      .map((t) => ({
        ...t,
        days: differenceInCalendarDays(new Date(t.dueDate!), now),
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
                      {format(new Date(s.startTime), "EEE, d MMM • HH:mm", {
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
                      {format(new Date(t.updatedAt), "d MMM, HH:mm", {
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
