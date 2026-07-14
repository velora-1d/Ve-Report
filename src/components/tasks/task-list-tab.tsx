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
              placeholder="Cari judul tugas..."
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
          {canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Tugas Baru
            </Button>
          )}
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
            Tidak ada tugas yang cocok dengan filter Anda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioritas</TableHead>
                <TableHead>Penanggung jawab</TableHead>
                <TableHead>Tenggat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {t.description}
                      </div>
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
                    >
                      <SelectTrigger className="h-8 w-40 border-0 bg-transparent p-0 shadow-none focus:ring-0">
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
                  <TableCell>
                    <PriorityBadge priority={t.priority as any} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.assignee ? (
                      t.assignee.name
                    ) : (
                      <span className="text-muted-foreground">
                        Belum ditugaskan
                      </span>
                    )}
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
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
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
                      </div>
                    )}
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
