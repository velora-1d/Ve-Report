// ponytail: Mengganti query Supabase client-side dengan TanStack Start Server Functions dan Drizzle ORM
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getAppConfig } from "@/lib/app-config";
import { db } from "@/db";
import { trackerLogs as logsTable, tasks as tasksTable } from "@/db/schema";
import { eq, desc, and, gte, inArray, or } from "drizzle-orm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { isAdminOrDev } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerFormDialog } from "@/components/tracker/tracker-form-dialog";
import { formatDuration, todayISO } from "@/lib/tracker";

// ponytail: Fungsi server untuk mengambil log pelacak milik user saat ini / semua user (jika admin)
export const getTrackerLogs = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  const role = session.user.role || "staff";
  const whereClause = role === "staff"
    ? eq(logsTable.userId, session.user.id)
    : undefined;

  const configs = await db.query.appConfig.findMany({
    limit: 1,
  });
  const limitVal = configs[0]?.logLimit ?? 200;

  const logs = await db.query.trackerLogs.findMany({
    where: whereClause,
    with: {
      task: {
        columns: {
          id: true,
          title: true,
          status: true,
        }
      },
      user: {
        columns: {
          id: true,
          name: true,
        }
      }
    },
    orderBy: [desc(logsTable.loggedDate), desc(logsTable.createdAt)],
    limit: limitVal,
  });

  return logs;
});

// ponytail: Fungsi server untuk mengambil tugas aktif yang dapat dicatat waktunya
export const getAssignableTasks = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  const role = session.user.role || "staff";
  const whereClause = role === "staff"
    ? and(
        inArray(tasksTable.status, ["todo", "in_progress", "review"]),
        eq(tasksTable.assignedTo, session.user.id)
      )
    : inArray(tasksTable.status, ["todo", "in_progress", "review"]);

  const tasksList = await db.query.tasks.findMany({
    where: whereClause,
    columns: {
      id: true,
      title: true,
      status: true,
    },
    orderBy: [desc(tasksTable.createdAt)],
  });

  return tasksList;
});

// ponytail: Fungsi server untuk menyimpan/memperbarui log pelacak waktu
export const saveTrackerLog = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      taskId: z.string().nullable().optional(),
      loggedDate: z.string(),
      durationMinutes: z.number(),
      note: z.string().nullable().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      status: z.string().optional(),
      remarks: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const payload = {
      taskId: data.taskId || null,
      userId: session.user.id,
      loggedDate: data.loggedDate,
      durationMinutes: data.durationMinutes,
      note: data.note || null,
      startTime: data.startTime || "08:00",
      endTime: data.endTime || "17:00",
      status: data.status || "progress",
      remarks: data.remarks || null,
    };

    if (data.id) {
      await db.update(logsTable).set(payload).where(eq(logsTable.id, data.id));
    } else {
      await db.insert(logsTable).values(payload);
    }
  });

// ponytail: Fungsi server untuk menghapus log pelacak waktu
export const deleteTrackerLog = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    await db.delete(logsTable)
      .where(and(eq(logsTable.id, id), eq(logsTable.userId, session.user.id)));
  });

// ponytail: Fungsi server untuk memvalidasi/menyetujui log harian oleh atasan/admin
export const validateTrackerLog = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      isValidated: z.boolean(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    await db.update(logsTable)
      .set({
        isValidated: data.isValidated,
        validatedBy: data.isValidated ? session.user.id : null,
      })
      .where(eq(logsTable.id, data.id));
  });

export const Route = createFileRoute("/_authenticated/pelacak")({
  head: () => ({
    meta: [
      { title: "Pelacak — Log Book" },
      {
        name: "description",
        content: "Catat dan lihat log progres/waktu per tugas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PelacakPage,
});

function PelacakPage() {
  const { data: user } = useCurrentUser();
  const { hasPermission } = usePermission();
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["tracker-logs", user?.id],
    enabled: !!user?.id,
    queryFn: () => getTrackerLogs(),
  });

  const summary = useMemo(() => {
    const today = todayISO();
    const now = new Date();
    const weekStart = new Date(now);
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    weekStart.setDate(now.getDate() - dow);
    const weekStartISO = weekStart.toISOString().slice(0, 10);

    let todayMin = 0;
    let weekMin = 0;
    let totalMin = 0;
    const perTask = new Map<string, { title: string; mins: number }>();

    for (const l of logs ?? []) {
      const m = l.durationMinutes ?? 0;
      totalMin += m;
      if (l.loggedDate === today) todayMin += m;
      if (l.loggedDate >= weekStartISO) weekMin += m;
      const key = l.task?.id ?? l.taskId ?? "manual";
      const title = l.note ?? l.task?.title ?? "Aktivitas Manual";
      const cur = perTask.get(key);
      perTask.set(key, { title, mins: (cur?.mins ?? 0) + m });
    }

    const topTasks = Array.from(perTask.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 5);

    return { todayMin, weekMin, totalMin, topTasks };
  }, [logs]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrackerLog({ data: id }),
    onSuccess: () => {
      toast.success("Log dihapus");
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeletingId(null);
    },
    onError: (e: Error) =>
      toast.error("Gagal menghapus", { description: e.message }),
  });

  const validateMutation = useMutation({
    mutationFn: (v: { id: string; isValidated: boolean }) =>
      validateTrackerLog({ data: v }),
    onSuccess: () => {
      toast.success("Status validasi diperbarui");
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memvalidasi", { description: e.message }),
  });

  const stats = [
    {
      label: "Hari Ini",
      value: formatDuration(summary.todayMin),
      icon: Clock,
      tone: "text-primary",
    },
    {
      label: "Minggu Ini",
      value: formatDuration(summary.weekMin),
      icon: TrendingUp,
      tone: "text-info",
    },
    {
      label: "Total Tercatat",
      value: formatDuration(summary.totalMin),
      icon: ListChecks,
      tone: "text-success",
    },
  ];

  const showStaffName = isAdminOrDev(user?.roles ?? []);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {appName} Harian
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Catat aktivitas kegiatan harian dan log pengerjaan tugas.
          </p>
        </div>
        {hasPermission("pelacak", "create") && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 border border-primary/20"
          >
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
            <span>Tambah Log Harian</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => {
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
                  {s.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="surface-card border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Riwayat Log</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (logs ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Belum ada log. Klik <b>Tambah Log Harian</b> untuk mulai.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hari / Tanggal</TableHead>
                      {showStaffName && <TableHead>Nama Staff</TableHead>}
                      <TableHead>Jam</TableHead>
                      <TableHead>Implementasi Kegiatan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validasi</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="w-24 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs ?? []).map((l) => {
                      const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
                      const activityStr = l.note || l.task?.title || "—";
                      const isDone = l.status === "done";
                      const statusStr = isDone ? "Selesai" : "On Progres";
                      const validatedStr = l.isValidated ? "Disetujui" : "Belum";
                      const remarksStr = l.remarks ?? "—";
                      const canEditOrDeleteLog = !l.isValidated || isAdminOrDev(user?.roles ?? []);

                      return (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {l.loggedDate ? format(new Date(l.loggedDate), "EEEE, d MMM yyyy", {
                              locale: idLocale,
                            }) : "—"}
                          </TableCell>
                          {showStaffName && (
                            <TableCell className="text-sm font-semibold text-slate-700">
                              {l.user?.name ?? "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-sm font-medium">
                            {timeStr}
                          </TableCell>
                          <TableCell className="text-sm text-slate-800 font-medium">
                            {activityStr || "—"}
                            {l.task?.title && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Tugas: {l.task.title}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                              {statusStr}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {isAdminOrDev(user?.roles ?? []) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`px-2 py-0.5 h-auto text-xs font-bold ${l.isValidated ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                onClick={() => validateMutation.mutate({ id: l.id, isValidated: !l.isValidated })}
                              >
                                {validatedStr}
                              </Button>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${l.isValidated ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-500'}`}>
                                {validatedStr}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {remarksStr}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canEditOrDeleteLog && (hasPermission("pelacak", "update") || hasPermission("pelacak", "delete")) ? (
                                <>
                                  {hasPermission("pelacak", "update") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setEditing(l);
                                        setFormOpen(true);
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  {hasPermission("pelacak", "delete") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => setDeletingId(l.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground px-2 py-1">Terkunci</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle className="text-base">Top Tugas</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ul className="space-y-3">
                {summary.topTasks.map((t) => {
                  const pct =
                    summary.totalMin > 0
                      ? Math.round((t.mins / summary.totalMin) * 100)
                      : 0;
                  return (
                    <li key={t.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{t.title}</span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {formatDuration(t.mins)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TrackerFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
      />

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus log?</AlertDialogTitle>
            <AlertDialogDescription>
              Log waktu ini akan dihapus permanen. Tindakan tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
