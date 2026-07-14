import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
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
import { formatDuration, todayISO, type TrackerLogRow } from "@/lib/tracker";

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

interface LogWithTask extends TrackerLogRow {
  tasks: { id: string; title: string } | null;
}

function PelacakPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrackerLogRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["tracker-logs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracker_logs")
        .select("*, tasks:task_id(id,title)")
        .eq("user_id", user!.id)
        .order("logged_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LogWithTask[];
    },
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
      const m = l.duration_minutes ?? 0;
      totalMin += m;
      if (l.logged_date === today) todayMin += m;
      if (l.logged_date >= weekStartISO) weekMin += m;
      const key = l.tasks?.id ?? l.task_id;
      const title = l.tasks?.title ?? "(Tugas dihapus)";
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tracker_logs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Log dihapus");
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeletingId(null);
    },
    onError: (e: Error) =>
      toast.error("Gagal menghapus", { description: e.message }),
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Pelacak Waktu
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Catat berapa lama Anda mengerjakan setiap tugas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Catat Waktu
        </Button>
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
                Belum ada log. Klik <b>Catat Waktu</b> untuk mulai.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tugas</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead className="w-24 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(l.logged_date), "d MMM yyyy", {
                            locale: idLocale,
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.tasks?.title ?? (
                            <span className="text-muted-foreground italic">
                              (dihapus)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatDuration(l.duration_minutes)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {l.note ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingId(l.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
