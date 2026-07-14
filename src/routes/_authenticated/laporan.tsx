import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminOrDev } from "@/lib/roles";
import { generateReportPdf } from "@/lib/pdf-report";
import { generateReportExcel } from "@/lib/excel-report";
import { todayISO } from "@/lib/tracker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan — Log Book" },
      {
        name: "description",
        content: "Generate dan unduh laporan tim dalam format PDF.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LaporanPage,
});

function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
// ponytail: gunakan import todayISO dari @/lib/tracker untuk mereduksi boilerplate redundant (YAGNI/Optimasi Baris)

function LaporanPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const canFilterUser = me ? isAdminOrDev(me.roles) : false;

  const [title, setTitle] = useState("Laporan Kinerja");
  const [reportType, setReportType] = useState<
    "standard" | "meeting" | "harian"
  >("standard");
  const [start, setStart] = useState(firstOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [userId, setUserId] = useState<string>("me");

  const { data: users } = useQuery({
    queryKey: ["users-simple"],
    enabled: canFilterUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["reports-history", me?.id, canFilterUser],
    enabled: !!me?.id,
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!canFilterUser) q = q.eq("generated_by", me!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async (fileFormat: "pdf" | "excel") => {
      if (!me) throw new Error("Belum masuk");
      if (!title.trim()) throw new Error("Judul laporan wajib diisi");
      if (start > end) throw new Error("Periode tidak valid");
      const targetUser =
        !canFilterUser || userId === "me"
          ? me.id
          : userId === "all"
            ? null
            : userId;

      let blob: Blob;
      let extension = "";

      if (fileFormat === "excel") {
        if (reportType === "standard") {
          throw new Error("Format Standard tidak mendukung ekspor Excel.");
        }
        blob = await generateReportExcel({
          reportType: reportType as "meeting" | "harian",
          periodStart: start,
          periodEnd: end,
          userId: targetUser,
          generatedByName: me.name,
          userPosition: me.position,
        });
        extension = "xlsx";
      } else {
        blob = await generateReportPdf({
          title: title.trim(),
          periodStart: start,
          periodEnd: end,
          userId: targetUser,
          generatedByName: me.name,
          reportType,
        });
        extension = "pdf";
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9-_]+/gi, "_")}_${start}_${end}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Save record
      const { error } = await supabase.from("reports").insert({
        title: title.trim(),
        period_start: start,
        period_end: end,
        generated_by: me.id,
        filter_user_id: targetUser,
        filters: {
          user_filter: userId,
          report_type: reportType,
          file_format: fileFormat,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Laporan berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["reports-history"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal membuat laporan", { description: e.message }),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Laporan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Buat laporan tugas & waktu untuk periode tertentu, unduh sebagai Excel
          atau PDF.
        </p>
      </div>

      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Buat Laporan Baru
          </CardTitle>
          <CardDescription>
            Dokumen akan dibuat di sisi klien dan otomatis terunduh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Judul Laporan</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Format Laporan</Label>
              <Select
                value={reportType}
                onValueChange={(v) => {
                  const type = v as "standard" | "meeting" | "harian";
                  setReportType(type);
                  if (type === "standard") setTitle("Laporan Kinerja");
                  else if (type === "meeting") setTitle("Log Book Meeting");
                  else if (type === "harian") setTitle("Log Book Harian");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Laporan Kinerja (Standar)
                  </SelectItem>
                  <SelectItem value="meeting">
                    Log Book Meeting (Excel / PDF)
                  </SelectItem>
                  <SelectItem value="harian">
                    Log Book Harian (Excel / PDF)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Dari</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            {canFilterUser && (
              <div className="space-y-2">
                <Label>Filter Pengguna</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">Saya sendiri</SelectItem>
                    <SelectItem value="all">Semua pengguna</SelectItem>
                    {(users ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {reportType !== "standard" && (
              <Button
                variant="outline"
                onClick={() => generate.mutate("excel")}
                disabled={generate.isPending}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" /> Buat & Unduh Excel
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => generate.mutate("pdf")}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Buat & Unduh PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle className="text-base">Riwayat Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (history ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada laporan.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {history!.map((r) => (
                <li
                  key={r.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {r.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(r.period_start), "d MMM yyyy", {
                        locale: idLocale,
                      })}{" "}
                      —{" "}
                      {format(new Date(r.period_end), "d MMM yyyy", {
                        locale: idLocale,
                      })}
                      {" • "}
                      {format(new Date(r.created_at), "d MMM yyyy HH:mm", {
                        locale: idLocale,
                      })}
                    </div>
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
