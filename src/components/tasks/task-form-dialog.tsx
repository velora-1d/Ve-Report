// ponytail: Menyederhanakan CRUD tugas dengan menghapus dropdown penugasan user dan merubahnya menjadi manual Pemberi Tugas
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { saveTask } from "@/routes/_authenticated/tugas";
import { useCurrentUser } from "@/hooks/use-current-user";

export interface TaskFormData {
  id?: string;
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  startedAt?: Date | string | null;
  dueDate?: Date | string | null;
  assignedTo?: string | null;
  taskSource?: string | null;
  outputDescription?: string | null;
  divisionId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskFormData | null;
  currentUserId: string;
  divisionId?: string | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  currentUserId,
  divisionId,
}: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [startedAt, setStartedAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskSource, setTaskSource] = useState<string>("");
  const [outputDescription, setOutputDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? "todo");
    setPriority(task?.priority ?? "medium");
    setStartedAt(
      task?.startedAt
        ? new Date(task.startedAt).toISOString().slice(0, 10)
        : "",
    );
    setDueDate(
      task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
    );
    setTaskSource(task?.taskSource ?? "");
    setOutputDescription(task?.outputDescription ?? "");
  }, [open, task]);

  const mutation = useMutation({
    mutationFn: () =>
      saveTask({
        data: {
          id: task?.id,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          startedAt: startedAt || null,
          dueDate: dueDate || null,
          assignedTo: currentUserId,
          taskSource: taskSource.trim() || undefined,
          outputDescription: outputDescription.trim() || null,
          divisionId: task?.divisionId ?? divisionId,
        },
      }),
    onSuccess: () => {
      toast.success(task ? "Tugas diperbarui." : "Tugas dibuat.");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error("Gagal menyimpan", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {task ? "Ubah Log Meeting / Tugas" : "Tambah Log Meeting / Tugas"}
          </DialogTitle>
          <DialogDescription>
            Isi rincian detail tugas/meeting yang ditugaskan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Judul / Uraian Tugas</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Susun laporan bulanan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Detail Uraian Tugas (Opsional)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail tambahan (opsional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startedAt">Target Mulai</Label>
              <Input
                id="startedAt"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Target Selesai</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="taskSource">Pemberi Tugas</Label>
              <Input
                id="taskSource"
                value={taskSource}
                onChange={(e) => setTaskSource(e.target.value)}
                placeholder="Contoh: Atasan / Rapat Kerja"
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="output">Out Put (Hasil Kerja)</Label>
              <Input
                id="output"
                value={outputDescription}
                onChange={(e) => setOutputDescription(e.target.value)}
                placeholder="Contoh: Dokumen PDF Laporan"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
