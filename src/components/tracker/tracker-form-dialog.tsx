// ponytail: Menyederhanakan form dialog harian agar menggunakan penamaan Judul Tugas, Deskripsi/Keterangan, dan Status
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { saveTrackerLog } from "@/routes/_authenticated/pelacak";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  defaultTaskId?: string;
}

export function TrackerFormDialog({
  open,
  onOpenChange,
  editing,
  defaultTaskId,
}: Props) {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const [date, setDate] = useState<string>(todayISO());
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("30");
  const [note, setNote] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [status, setStatus] = useState<string>("progress"); // 'progress' | 'done'
  const [remarks, setRemarks] = useState<string>("");

  function parseTimeToMinutes(timeStr: string): number | null {
    const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(editing.loggedDate);
      const total = editing.durationMinutes ?? 0;
      setHours(String(Math.floor(total / 60)));
      setMinutes(String(total % 60));
      setNote(editing.note ?? "");
      setStartTime(editing.startTime ?? "08:00");
      setEndTime(editing.endTime ?? "17:00");
      setStatus(editing.status ?? "progress");
      setRemarks(editing.remarks ?? "");
    } else {
      setDate(todayISO());
      setHours("0");
      setMinutes("30");
      setNote("");
      setStartTime("08:00");
      setEndTime("17:00");
      setStatus("progress");
      setRemarks("");
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin !== null && endMin !== null) {
      let diff = endMin - startMin;
      if (diff < 0) {
        diff += 24 * 60;
      }
      setHours(String(Math.floor(diff / 60)));
      setMinutes(String(diff % 60));
    }
  }, [startTime, endTime, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Belum masuk");
      if (!note.trim()) throw new Error("Judul Tugas tidak boleh kosong");
      const totalMin =
        (parseInt(hours || "0", 10) || 0) * 60 +
        (parseInt(minutes || "0", 10) || 0);
      if (totalMin <= 0) throw new Error("Durasi harus lebih dari 0 menit");
      
      await saveTrackerLog({
        data: {
          id: editing?.id,
          taskId: null,
          loggedDate: date,
          durationMinutes: totalMin,
          note: note.trim() || null,
          startTime,
          endTime,
          status,
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
            {editing ? "Ubah Log Harian" : "Tambah Log Harian"}
          </DialogTitle>
          <DialogDescription>
            Catat detail implementasi kegiatan harian Anda secara manual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Durasi (Jam)</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Durasi (Menit)</Label>
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
            <Label htmlFor="note">Judul Tugas / Kegiatan</Label>
            <Textarea
              id="note"
              rows={3}
              placeholder="Contoh: Pembuatan laporan bulanan"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="progress">On Progres</SelectItem>
                <SelectItem value="done">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Deskripsi / Keterangan</Label>
            <Input
              id="remarks"
              placeholder="Contoh: Hambatan server down atau keterangan tambahan"
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
