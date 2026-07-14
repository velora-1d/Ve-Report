import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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

export type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schedule: ScheduleRow | null;
  defaultDate?: Date;
  currentUserId: string;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  schedule,
  defaultDate,
  currentUserId,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!schedule;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reminder, setReminder] = useState<string>("0");
  const [taskId, setTaskId] = useState<string>("__none__");

  useEffect(() => {
    if (!open) return;
    if (schedule) {
      setTitle(schedule.title);
      setDescription(schedule.description ?? "");
      setStartTime(toLocalInput(schedule.start_time));
      setEndTime(toLocalInput(schedule.end_time));
      setReminder(String(schedule.reminder_minutes_before ?? 0));
      setTaskId(schedule.task_id ?? "__none__");
    } else {
      const base = defaultDate ?? new Date();
      const start = new Date(base);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);
      setTitle("");
      setDescription("");
      setStartTime(toLocalInput(start.toISOString()));
      setEndTime(toLocalInput(end.toISOString()));
      setReminder("15");
      setTaskId("__none__");
    }
  }, [open, schedule, defaultDate]);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", "linkable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Judul jadwal wajib diisi.");
      if (!startTime || !endTime) throw new Error("Waktu mulai dan selesai wajib diisi.");
      if (new Date(endTime) <= new Date(startTime))
        throw new Error("Waktu selesai harus setelah waktu mulai.");
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        reminder_minutes_before: Number(reminder) || null,
        task_id: taskId === "__none__" ? null : taskId,
      };
      if (isEdit && schedule) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedules")
          .insert({ ...payload, user_id: currentUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Jadwal diperbarui." : "Jadwal dibuat.");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      const { error } = await supabase.from("schedules").delete().eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Jadwal dihapus.");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Jadwal" : "Jadwal Baru"}</DialogTitle>
          <DialogDescription>
            Tambahkan agenda dengan pengingat, opsional terhubung ke tugas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Judul</Label>
            <Input
              id="s-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Rapat mingguan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-start">Mulai</Label>
              <Input
                id="s-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-end">Selesai</Label>
              <Input
                id="s-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pengingat</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tanpa pengingat</SelectItem>
                  <SelectItem value="5">5 menit sebelumnya</SelectItem>
                  <SelectItem value="15">15 menit sebelumnya</SelectItem>
                  <SelectItem value="30">30 menit sebelumnya</SelectItem>
                  <SelectItem value="60">1 jam sebelumnya</SelectItem>
                  <SelectItem value="1440">1 hari sebelumnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Terhubung ke tugas</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tidak terhubung</SelectItem>
                  {tasks?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-desc">Deskripsi</Label>
            <Textarea
              id="s-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Hapus
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
