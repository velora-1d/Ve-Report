// ponytail: Menggunakan Server Functions dari tugas.tsx dengan Drizzle ORM
// ponytail: Memanfaatkan join native Drizzle dengan relations `assignee` untuk menyingkirkan query profiles-map (YAGNI)
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminOrDev } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type TaskStatus,
} from "@/lib/tasks";
import { StatusBadge, PriorityBadge } from "./status-badges";
import { TaskFormDialog } from "./task-form-dialog";
import { getTasksList, updateTaskStatus, deleteTask } from "@/routes/_authenticated/tugas";

export function TaskListTab() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const canManage = user ? isAdminOrDev(user.roles) : false;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", "list"],
    queryFn: () => getTasksList(),
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter)
        return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, search]);

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) => {
      const startedAt = v.status === "in_progress" ? new Date().toISOString() : null;
      const completedAt = v.status === "done" ? new Date().toISOString() : null;
      return updateTaskStatus({
        data: {
          id: v.id,
          status: v.status,
          startedAt,
          completedAt,
        }
      });
    },
    onSuccess: () => {
      toast.success("Status diperbarui.");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask({ data: id }),
    onSuccess: () => {
      toast.success("Tugas dihapus.");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 surface-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2 flex-1">
            <Input
              placeholder="Cari uraian tugas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua prioritas</SelectItem>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {TASK_PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 border border-primary/20"
          >
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
            <span>Tambah Log Meeting</span>
          </Button>
        </div>
      </Card>

      <Card className="surface-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Tidak ada log meeting yang cocok dengan filter Anda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hari / Tanggal</TableHead>
                <TableHead>Uraian Tugas</TableHead>
                <TableHead>Pemberi Tugas</TableHead>
                <TableHead>Target Selesai</TableHead>
                <TableHead>Out Put</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    {format(new Date(t.createdAt), "EEEE, d MMM yyyy", {
                      locale: idLocale,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-slate-800">
                    {t.taskSource || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.dueDate ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {format(new Date(t.dueDate), "d MMM yyyy", {
                          locale: idLocale,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.outputDescription ? (
                      <span className="font-medium text-slate-800">{t.outputDescription}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={t.status}
                      onValueChange={(v) =>
                        statusMutation.mutate({
                          id: t.id,
                          status: v as TaskStatus,
                        })
                      }
                      disabled={!(isAdminOrDev(user?.roles ?? []) || t.assignedTo === user?.id || t.createdBy === user?.id)}
                    >
                      <SelectTrigger className="h-8 w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                        <StatusBadge status={t.status as any} />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {TASK_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(isAdminOrDev(user?.roles ?? []) || t.createdBy === user?.id) && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(t);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingId(t.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {user && (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          task={editing}
          currentUserId={user.id}
        />
      )}

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Riwayat status dan log
              pelacak terkait juga akan ikut terhapus.
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
