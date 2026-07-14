// ponytail: Mengganti query Supabase client-side pada form dialog pelacak dengan Server Functions Drizzle ORM
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayISO } from "@/lib/tracker";
import { getAssignableTasks, saveTrackerLog } from "@/routes/_authenticated/pelacak";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: any | null;
  defaultTaskId?: string | null;
}

export function TrackerFormDialog({
  open,
  onOpenChange,
  editing,
  defaultTaskId,
}: Props) {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const [taskId, setTaskId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("30");
  const [note, setNote] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [remarks, setRemarks] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTaskId(editing.taskId);
      setDate(editing.loggedDate);
      const total = editing.durationMinutes ?? 0;
      setHours(String(Math.floor(total / 60)));
      setMinutes(String(total % 60));
      setNote(editing.note ?? "");
      setStartTime(editing.startTime ?? "08:00");
      setEndTime(editing.endTime ?? "17:00");
      setRemarks(editing.remarks ?? "");
    } else {
      setTaskId(defaultTaskId ?? "");
      setDate(todayISO());
      setHours("0");
      setMinutes("30");
      setNote("");
      setStartTime("08:00");
      setEndTime("17:00");
      setRemarks("");
    }
  }, [open, editing, defaultTaskId]);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", "assignable", user?.id],
    enabled: open && !!user?.id,
    queryFn: () => getAssignableTasks(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Belum masuk");
      if (!taskId) throw new Error("Pilih tugas terlebih dulu");
      const totalMin =
        (parseInt(hours || "0", 10) || 0) * 60 +
        (parseInt(minutes || "0", 10) || 0);
      if (totalMin <= 0) throw new Error("Durasi harus lebih dari 0 menit");
      
      await saveTrackerLog({
        data: {
          id: editing?.id,
          taskId,
          loggedDate: date,
          durationMinutes: totalMin,
          note: note.trim() || null,
          startTime,
          endTime,
          remarks: remarks.trim() || null,
        }
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Log diperbarui" : "Log tersimpan");
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["tracker-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
            {editing ? "Ubah Log Pelacak" : "Catat Waktu"}
          </DialogTitle>
          <DialogDescription>
            Catat berapa lama Anda mengerjakan sebuah tugas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pilih Tugas / Log Rapat</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih tugas aktif" />
              </SelectTrigger>
              <SelectContent>
                {(tasks ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
                {(!tasks || tasks.length === 0) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Belum ada tugas aktif.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hari / Tanggal</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jam</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Menit</Label>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Implementasi Kegiatan (Catatan)</Label>
            <Textarea
              rows={3}
              placeholder="Apa yang dikerjakan?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_time">Jam Mulai</Label>
              <Input
                id="start_time"
                type="text"
                placeholder="08:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Jam Selesai</Label>
              <Input
                id="end_time"
                type="text"
                placeholder="17:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Keterangan</Label>
            <Input
              id="remarks"
              placeholder="Contoh: Hambatan server down"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
