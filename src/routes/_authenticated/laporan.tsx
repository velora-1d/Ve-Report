// ponytail: Mengganti query Supabase client-side untuk laporan dengan Server Functions Drizzle ORM
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileText, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import {
  reports as reportsTable,
  users as usersTable,
  appConfig as appConfigTable,
  trackerLogs as trackerLogsTable,
  tasks as tasksTable
} from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { isAdminOrDev } from "@/lib/roles";
import { todayISO } from "@/lib/tracker";
import { uploadToRustFS } from "@/lib/storage";
import { sendTelegramNotification } from "@/lib/telegram";
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

// ponytail: Fungsi server untuk mengambil daftar nama pengguna sederhana (untuk filter)
export const getSimpleUsers = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  const role = session.user.role || "staff";
  if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

  return db.query.users.findMany({
    columns: {
      id: true,
      name: true,
    },
    orderBy: [desc(usersTable.name)],
  });
});

// ponytail: Fungsi server untuk mengambil riwayat laporan terbit
const getReportsHistory = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");
  const role = session.user.role || "staff";
  const canFilterUser = role === "admin" || role === "developer";

  if (canFilterUser) {
    return db.query.reports.findMany({
      orderBy: [desc(reportsTable.createdAt)],
      limit: 20,
    });
  } else {
    return db.query.reports.findMany({
      where: eq(reportsTable.generatedBy, session.user.id),
      orderBy: [desc(reportsTable.createdAt)],
      limit: 20,
    });
  }
});

// ponytail: Fungsi server untuk menyimpan log pembuatan laporan baru
const saveReportRecord = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string(),
      periodStart: z.string(),
      periodEnd: z.string(),
      filterUserId: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    await db.insert(reportsTable).values({
      title: data.title,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      generatedBy: session.user.id,
      filterUserId: data.filterUserId || null,
    });

    // ponytail: Kirim notifikasi instan ke grup/channel Telegram
    await sendTelegramNotification(
      `📄 *Laporan Baru Diterbitkan*\n\n` +
      `• *Judul*: ${data.title}\n` +
      `• *Periode*: ${data.periodStart} s/d ${data.periodEnd}\n` +
      `• *Dibuat Oleh*: ${session.user.name || session.user.email}`
    );
  });

// ponytail: Fungsi server untuk mengambil semua data yang dibutuhkan laporan (tugas, log, config, position) sekaligus
const getReportData = createServerFn({ method: "POST" })
  .validator(
    z.object({
      periodStart: z.string(),
      periodEnd: z.string(),
      userId: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    // Fetch config
    const config = await db.query.appConfig.findMany({
      orderBy: [desc(appConfigTable.updatedAt)],
      limit: 1,
    });
    const cfg = config[0] || null;

    // Fetch targeted employee position/name
    let position = "Staf";
    let name = session.user.name || "";
    if (data.userId) {
      const u = await db.query.users.findFirst({
        where: eq(usersTable.id, data.userId),
        columns: { position: true, name: true }
      });
      if (u?.position) position = u.position;
      if (u?.name) name = u.name;
    }

    // Fetch tasks
    let tasksQuery;
    if (data.userId) {
      tasksQuery = db.query.tasks.findMany({
        where: and(
          eq(tasksTable.assignedTo, data.userId),
          gte(tasksTable.createdAt, new Date(data.periodStart + "T00:00:00")),
          lte(tasksTable.createdAt, new Date(data.periodEnd + "T23:59:59"))
        ),
        orderBy: [desc(tasksTable.createdAt)]
      });
    } else {
      tasksQuery = db.query.tasks.findMany({
        where: and(
          gte(tasksTable.createdAt, new Date(data.periodStart + "T00:00:00")),
          lte(tasksTable.createdAt, new Date(data.periodEnd + "T23:59:59"))
        ),
        orderBy: [desc(tasksTable.createdAt)]
      });
    }

    // Fetch logs
    let logsQuery;
    if (data.userId) {
      logsQuery = db
        .select({
          id: trackerLogsTable.id,
          taskId: trackerLogsTable.taskId,
          userId: trackerLogsTable.userId,
          note: trackerLogsTable.note,
          durationMinutes: trackerLogsTable.durationMinutes,
          loggedDate: trackerLogsTable.loggedDate,
          createdAt: trackerLogsTable.createdAt,
          startTime: trackerLogsTable.startTime,
          endTime: trackerLogsTable.endTime,
          status: trackerLogsTable.status,
          isValidated: trackerLogsTable.isValidated,
          validatedBy: trackerLogsTable.validatedBy,
          remarks: trackerLogsTable.remarks,
          task: {
            title: tasksTable.title,
            status: tasksTable.status,
          },
        })
        .from(trackerLogsTable)
        .leftJoin(tasksTable, eq(trackerLogsTable.taskId, tasksTable.id))
        .where(
          and(
            eq(trackerLogsTable.userId, data.userId),
            gte(trackerLogsTable.loggedDate, data.periodStart),
            lte(trackerLogsTable.loggedDate, data.periodEnd)
          )
        )
        .orderBy(desc(trackerLogsTable.loggedDate));
    } else {
      logsQuery = db
        .select({
          id: trackerLogsTable.id,
          taskId: trackerLogsTable.taskId,
          userId: trackerLogsTable.userId,
          note: trackerLogsTable.note,
          durationMinutes: trackerLogsTable.durationMinutes,
          loggedDate: trackerLogsTable.loggedDate,
          createdAt: trackerLogsTable.createdAt,
          startTime: trackerLogsTable.startTime,
          endTime: trackerLogsTable.endTime,
          status: trackerLogsTable.status,
          isValidated: trackerLogsTable.isValidated,
          validatedBy: trackerLogsTable.validatedBy,
          remarks: trackerLogsTable.remarks,
          task: {
            title: tasksTable.title,
            status: tasksTable.status,
          },
        })
        .from(trackerLogsTable)
        .leftJoin(tasksTable, eq(trackerLogsTable.taskId, tasksTable.id))
        .where(
          and(
            gte(trackerLogsTable.loggedDate, data.periodStart),
            lte(trackerLogsTable.loggedDate, data.periodEnd)
          )
        )
        .orderBy(desc(trackerLogsTable.loggedDate));
    }

    const [tasks, rawLogs] = await Promise.all([tasksQuery, logsQuery]);
    const logs = rawLogs.map((l: any) => ({
      ...l,
      task: l.task?.title ? l.task : null,
    }));

    return {
      cfg,
      position,
      name,
      tasks,
      logs,
    };
  });

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

function LaporanPage() {
  const { data: me } = useCurrentUser();
  const { hasPermission } = usePermission();
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";
  const canFilterUser = me ? isAdminOrDev(me.roles) : false;

  const [title, setTitle] = useState("Laporan Kinerja");
  const [reportType, setReportType] = useState<
    "standard" | "meeting" | "harian"
  >("standard");
  const [start, setStart] = useState(firstOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [userId, setUserId] = useState<string>("me");
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [makerName, setMakerName] = useState("");
  const [checkerName, setCheckerName] = useState("");
  const [makerSigImg, setMakerSigImg] = useState<string | null>(null);
  const [makerSigScale, setMakerSigScale] = useState<number>(100);
  const [makerSigOffsetX, setMakerSigOffsetX] = useState<number>(0);
  const [makerSigOffsetY, setMakerSigOffsetY] = useState<number>(0);
  const [checkerSigImg, setCheckerSigImg] = useState<string | null>(null);
  const [checkerSigScale, setCheckerSigScale] = useState<number>(100);
  const [checkerSigOffsetX, setCheckerSigOffsetX] = useState<number>(0);
  const [checkerSigOffsetY, setCheckerSigOffsetY] = useState<number>(0);

  const [isUploadingSig, setIsUploadingSig] = useState(false);

  // ponytail: Membaca konfigurasi tanda tangan & kertas yang tersimpan di localStorage agar tetap persisten saat reload
  useEffect(() => {
    try {
      const savedMakerName = localStorage.getItem("pdf_maker_name");
      if (savedMakerName) setMakerName(savedMakerName);
      
      const savedCheckerName = localStorage.getItem("pdf_checker_name");
      if (savedCheckerName) setCheckerName(savedCheckerName);

      const savedMakerSig = localStorage.getItem("pdf_maker_sig");
      if (savedMakerSig) setMakerSigImg(savedMakerSig);

      const savedCheckerSig = localStorage.getItem("pdf_checker_sig");
      if (savedCheckerSig) setCheckerSigImg(savedCheckerSig);

      const savedPaperSize = localStorage.getItem("pdf_paper_size");
      if (savedPaperSize === "A4" || savedPaperSize === "F4") setPaperSize(savedPaperSize as "A4" | "F4");

      const savedOrientation = localStorage.getItem("pdf_orientation");
      if (savedOrientation === "portrait" || savedOrientation === "landscape") setOrientation(savedOrientation as "portrait" | "landscape");

      const savedMakerSigScale = localStorage.getItem("pdf_maker_sig_scale");
      if (savedMakerSigScale) setMakerSigScale(Number(savedMakerSigScale));

      const savedMakerSigOffsetX = localStorage.getItem("pdf_maker_sig_offset_x");
      if (savedMakerSigOffsetX) setMakerSigOffsetX(Number(savedMakerSigOffsetX));

      const savedMakerSigOffsetY = localStorage.getItem("pdf_maker_sig_offset_y");
      if (savedMakerSigOffsetY) setMakerSigOffsetY(Number(savedMakerSigOffsetY));

      const savedCheckerSigScale = localStorage.getItem("pdf_checker_sig_scale");
      if (savedCheckerSigScale) setCheckerSigScale(Number(savedCheckerSigScale));

      const savedCheckerSigOffsetX = localStorage.getItem("pdf_checker_sig_offset_x");
      if (savedCheckerSigOffsetX) setCheckerSigOffsetX(Number(savedCheckerSigOffsetX));

      const savedCheckerSigOffsetY = localStorage.getItem("pdf_checker_sig_offset_y");
      if (savedCheckerSigOffsetY) setCheckerSigOffsetY(Number(savedCheckerSigOffsetY));
    } catch (e) {
      console.error("Failed to load PDF config from localStorage", e);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingSig(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await uploadToRustFS({
            data: {
              base64Data: reader.result as string,
              fileName: file.name,
              contentType: file.type || "image/png",
            }
          });
          if (res?.url) {
            setter(reader.result as string);
            toast.success("Tanda tangan berhasil di-upload ke S3");
          }
        } catch (err: any) {
          toast.error(err.message || "Gagal mengupload tanda tangan ke S3");
        } finally {
          setIsUploadingSig(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const { data: users } = useQuery({
    queryKey: ["users-simple"],
    enabled: canFilterUser,
    queryFn: () => getSimpleUsers(),
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["reports-history", me?.id, canFilterUser],
    enabled: !!me?.id,
    queryFn: () => getReportsHistory(),
  });

  // ponytail: Mengambil data pratinjau grid laporan secara real-time (reactive) setiap kali filter berubah
  const targetUser =
    !canFilterUser || userId === "me"
      ? me?.id
      : userId === "all"
        ? null
        : userId;

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["report-preview", start, end, targetUser, reportType],
    enabled: !!me && !!start && !!end && !((reportType === "meeting" || reportType === "harian") && !targetUser),
    queryFn: () =>
      getReportData({
        data: {
          periodStart: start,
          periodEnd: end,
          userId: targetUser,
        },
      }),
  });

  // ponytail: Sinkronisasi nama pembuat dan konfigurasi kertas saat data pratinjau berhasil dimuat
  useEffect(() => {
    if (previewData?.name) {
      setMakerName(previewData.name);
    }
    if (previewData?.cfg) {
      if (previewData.cfg.pdfPaperSize) {
        setPaperSize(previewData.cfg.pdfPaperSize.toUpperCase() === "F4" ? "F4" : "A4");
      }
      if (previewData.cfg.pdfOrientation) {
        setOrientation(previewData.cfg.pdfOrientation === "landscape" ? "landscape" : "portrait");
      }
    }
  }, [previewData?.name, previewData?.cfg]);

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

      // ponytail: Memastikan laporan Log Book Harian & Meeting tidak dibuat secara global/tanpa filter user
      if ((reportType === "meeting" || reportType === "harian") && !targetUser) {
        throw new Error(`Laporan ${appName} harus difilter untuk satu pengguna tertentu (tidak bisa Semua Pengguna).`);
      }

      // ponytail: Mengambil semua data laporan dari Server Function sekaligus (YAGNI / optimasi database roundtrip)
      const reportData = await getReportData({
        data: {
          periodStart: start,
          periodEnd: end,
          userId: targetUser,
        }
      });

      let blob: Blob;
      let extension = "";

      if (fileFormat === "excel") {
        const { generateReportExcel } = await import("@/lib/excel-report");
        blob = await generateReportExcel(
          {
            reportType: reportType === "meeting" ? "meeting" : "harian",
            periodStart: start,
            periodEnd: end,
            generatedByName: makerName || me.name,
            userPosition: reportData.position,
            checkerName: checkerName || null,
          },
          {
            employeeName: makerName || reportData.name,
            employeePosition: reportData.position,
            tasks: reportData.tasks,
            logs: reportData.logs,
            checkerName: checkerName || null,
          }
        );
        extension = "xlsx";
      } else {
        const { generateReportPdf } = await import("@/lib/pdf-report");
        blob = await generateReportPdf(
          {
            title: title.trim(),
            periodStart: start,
            periodEnd: end,
            generatedByName: makerName || me.name,
            reportType,
            checkerName: checkerName || null,
            makerSigImg,
            makerSigScale,
            makerSigOffsetX,
            makerSigOffsetY,
            checkerSigImg,
            checkerSigScale,
            checkerSigOffsetX,
            checkerSigOffsetY,
          },
          {
            cfg: {
              ...reportData.cfg,
              pdfPaperSize: paperSize,
              pdfOrientation: orientation,
            },
            position: reportData.position,
            tasks: reportData.tasks,
            logs: reportData.logs,
          }
        );
        extension = "pdf";
      }

      // Unduh file secara client-side
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9-_]+/gi, "_")}_${start}_${end}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Simpan log pembuatan laporan ke database
      await saveReportRecord({
        data: {
          title: title.trim(),
          periodStart: start,
          periodEnd: end,
          filterUserId: targetUser,
        }
      });
    },
    onSuccess: () => {
      toast.success("Laporan berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["reports-history"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal membuat laporan", { description: e.message }),
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Laporan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Buat laporan tugas & waktu untuk periode tertentu, unduh sebagai Excel
          atau PDF.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Kolom Kiri: Form & Riwayat */}
        <div className="w-full lg:w-[450px] space-y-6 shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                    if (type === "standard") {
                      setTitle("Laporan Kinerja");
                    } else {
                      if (type === "meeting") setTitle(`${appName} Meeting`);
                      else if (type === "harian") setTitle(`${appName} Harian`);
                      if (userId === "all") setUserId("me");
                    }
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
                      {appName} Meeting (Excel / PDF)
                    </SelectItem>
                    <SelectItem value="harian">
                      {appName} Harian (Excel / PDF)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      {reportType === "standard" && (
                        <SelectItem value="all">Semua pengguna</SelectItem>
                      )}
                      {(users ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ponytail: Ukuran kertas dan orientasi khusus logbook */}
              {(reportType === "meeting" || reportType === "harian") && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Ukuran Kertas</Label>
                    <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="F4">F4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Orientasi</Label>
                    <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* ponytail: Form nama tanda tangan custom & upload gambar ttd */}
              {(reportType === "meeting" || reportType === "harian") && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tanda Tangan Laporan</h4>
                  
                  {/* Yang Membuat */}
                  <div className="space-y-2 border-b pb-3">
                    <Label className="text-xs font-medium">Yang Membuat (Pembuat)</Label>
                    <Input
                      value={makerName}
                      onChange={(e) => setMakerName(e.target.value)}
                      placeholder="Nama Karyawan..."
                      className="h-9 text-xs"
                    />
                    
                    <div className="space-y-1.5 mt-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                      <Label className="text-[11px] text-muted-foreground block font-medium">Upload Tanda Tangan (PNG/JPG)</Label>
                      {makerSigImg ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-success font-semibold">Ttd Terunggah</span>
                            <button
                              type="button"
                              onClick={() => {
                                setMakerSigImg(null);
                                setMakerSigScale(100);
                                setMakerSigOffsetX(0);
                                setMakerSigOffsetY(0);
                              }}
                              className="text-[10px] text-destructive hover:underline font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                              <span>Ukuran: {makerSigScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="500"
                              value={makerSigScale}
                              onChange={(e) => setMakerSigScale(Number(e.target.value))}
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-semibold">
                            <div className="space-y-1">
                              <span>Geser X: {makerSigOffsetX}mm</span>
                              <input
                                type="range"
                                min="-30"
                                max="30"
                                value={makerSigOffsetX}
                                onChange={(e) => setMakerSigOffsetX(Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Geser Y: {makerSigOffsetY}mm</span>
                              <input
                                type="range"
                                min="-30"
                                max="30"
                                value={makerSigOffsetY}
                                onChange={(e) => setMakerSigOffsetY(Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, setMakerSigImg)}
                            disabled={isUploadingSig}
                            className="h-8 text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                          />
                          {isUploadingSig && (
                            <span className="text-[10px] text-[#0077B6] flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-[#0077B6]" />
                              Mengupload ke S3...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Yang Mengetahui */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Yang Mengetahui (Atasan)</Label>
                    <Input
                      value={checkerName}
                      onChange={(e) => setCheckerName(e.target.value)}
                      placeholder="Kosongkan untuk titik-titik"
                      className="h-9 text-xs"
                    />
                    
                    <div className="space-y-1.5 mt-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                      <Label className="text-[11px] text-muted-foreground block font-medium">Upload Tanda Tangan (PNG/JPG)</Label>
                      {checkerSigImg ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-success font-semibold">Ttd Terunggah</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCheckerSigImg(null);
                                setCheckerSigScale(100);
                                setCheckerSigOffsetX(0);
                                setCheckerSigOffsetY(0);
                              }}
                              className="text-[10px] text-destructive hover:underline font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                              <span>Ukuran: {checkerSigScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="500"
                              value={checkerSigScale}
                              onChange={(e) => setCheckerSigScale(Number(e.target.value))}
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-semibold">
                            <div className="space-y-1">
                              <span>Geser X: {checkerSigOffsetX}mm</span>
                              <input
                                type="range"
                                min="-30"
                                max="30"
                                value={checkerSigOffsetX}
                                onChange={(e) => setCheckerSigOffsetX(Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Geser Y: {checkerSigOffsetY}mm</span>
                              <input
                                type="range"
                                min="-30"
                                max="30"
                                value={checkerSigOffsetY}
                                onChange={(e) => setCheckerSigOffsetY(Number(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, setCheckerSigImg)}
                            disabled={isUploadingSig}
                            className="h-8 text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                          />
                          {isUploadingSig && (
                            <span className="text-[10px] text-[#0077B6] flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-[#0077B6]" />
                              Mengupload ke S3...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      try {
                        localStorage.setItem("pdf_maker_name", makerName);
                        localStorage.setItem("pdf_checker_name", checkerName);
                        if (makerSigImg) localStorage.setItem("pdf_maker_sig", makerSigImg);
                        else localStorage.removeItem("pdf_maker_sig");
                        if (checkerSigImg) localStorage.setItem("pdf_checker_sig", checkerSigImg);
                        else localStorage.removeItem("pdf_checker_sig");
                        localStorage.setItem("pdf_paper_size", paperSize);
                        localStorage.setItem("pdf_orientation", orientation);
                        localStorage.setItem("pdf_maker_sig_scale", String(makerSigScale));
                        localStorage.setItem("pdf_maker_sig_offset_x", String(makerSigOffsetX));
                        localStorage.setItem("pdf_maker_sig_offset_y", String(makerSigOffsetY));
                        localStorage.setItem("pdf_checker_sig_scale", String(checkerSigScale));
                        localStorage.setItem("pdf_checker_sig_offset_x", String(checkerSigOffsetX));
                        localStorage.setItem("pdf_checker_sig_offset_y", String(checkerSigOffsetY));
                        toast.success("Konfigurasi & tanda tangan berhasil disimpan!");
                      } catch (e) {
                        toast.error("Gagal menyimpan konfigurasi");
                      }
                    }}
                    className="w-full text-xs font-semibold border-primary/20 text-[#0077B6] hover:bg-[#0077B6]/5 flex items-center justify-center gap-2 rounded-xl h-10 mb-2 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Konfigurasi & Ttd
                  </Button>
                <Button
                  onClick={() => generate.mutate("pdf")}
                  disabled={generate.isPending || !hasPermission("laporan", "create")}
                  className="w-full"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat PDF…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" /> Buat & Unduh PDF
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generate.mutate("excel")}
                  disabled={generate.isPending || !hasPermission("laporan", "create")}
                  className="w-full"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat Excel…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" /> Buat & Unduh Excel
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
                          {r.periodStart ? format(new Date(r.periodStart), "d MMM yyyy", {
                            locale: idLocale,
                          }) : ""}
                          {" — "}
                          {r.periodEnd ? format(new Date(r.periodEnd), "d MMM yyyy", {
                            locale: idLocale,
                          }) : ""}
                          {" • "}
                          {r.createdAt ? format(new Date(r.createdAt), "d MMM yyyy HH:mm", {
                            locale: idLocale,
                          }) : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Pratinjau Kertas A4/F4 */}
        <div className="flex-1 w-full overflow-hidden">
          <ReportPreviewGrid
            reportType={reportType}
            data={previewData}
            isLoading={previewLoading}
            paperSize={paperSize}
            orientation={orientation}
            makerName={makerName}
            checkerName={checkerName}
            makerSigImg={makerSigImg}
            makerSigScale={makerSigScale}
            makerSigOffsetX={makerSigOffsetX}
            makerSigOffsetY={makerSigOffsetY}
            checkerSigImg={checkerSigImg}
            checkerSigScale={checkerSigScale}
            checkerSigOffsetX={checkerSigOffsetX}
            checkerSigOffsetY={checkerSigOffsetY}
          />
        </div>
      </div>
    </div>
  );
}

// ponytail: Komponen pratinjau grid laporan secara live/real-time untuk melihat struktur data dalam format A4/F4 sebelum diekspor
function ReportPreviewGrid({
  reportType,
  data,
  isLoading,
  paperSize,
  orientation,
  makerName,
  checkerName,
  makerSigImg,
  makerSigScale,
  makerSigOffsetX,
  makerSigOffsetY,
  checkerSigImg,
  checkerSigScale,
  checkerSigOffsetX,
  checkerSigOffsetY,
}: {
  reportType: "standard" | "meeting" | "harian";
  data: any;
  isLoading: boolean;
  paperSize: "A4" | "F4";
  orientation: "portrait" | "landscape";
  makerName: string;
  checkerName: string;
  makerSigImg: string | null;
  makerSigScale: number;
  makerSigOffsetX: number;
  makerSigOffsetY: number;
  checkerSigImg: string | null;
  checkerSigScale: number;
  checkerSigOffsetX: number;
  checkerSigOffsetY: number;
}) {
  const [scale, setScale] = useState(1);
  
  const paperWidth = orientation === "landscape"
    ? (paperSize === "F4" ? 1247 : 1122)
    : (paperSize === "F4" ? 812 : 794);
  const paperHeight = orientation === "landscape"
    ? (paperSize === "F4" ? 812 : 794)
    : (paperSize === "F4" ? 1247 : 1122);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        const width = window.innerWidth;
        if (width < 1024) { // on screens smaller than large desktop (e.g. tablet & mobile)
          const pad = width < 640 ? 32 : 48; // padding margin
          setScale(Math.max(0.2, Math.min(1, (width - pad) / paperWidth)));
        } else {
          // even on desktop, fit container width if desktop screen is smaller than paper width
          const colWidth = 600; // estimated available right column space
          setScale(1);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [paperSize, orientation, paperWidth]);

  if (isLoading) {
    return (
      <Card className="surface-card border-0 p-6">
        <div className="space-y-3">
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          <div className="h-[200px] w-full bg-muted/60 animate-pulse rounded" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="surface-card border-0 p-6 text-center text-muted-foreground">
        Masukkan periode dan filter pengguna untuk memuat pratinjau.
      </Card>
    );
  }

  const isLogbook = reportType === "meeting" || reportType === "harian";
  const defaultMargin = isLogbook ? 10 : 20;
  const marginMm = Math.max(5, Math.min(50, parseInt(data.cfg?.pdfMargin ?? String(defaultMargin), 10) || defaultMargin));

  const formatSigText = (name: string | null | undefined, fallback: string) => {
    if (!name) return fallback;
    const clean = name.trim();
    if (clean.startsWith("(") && clean.endsWith(")")) return clean;
    return `( ${clean} )`;
  };

  // Pratinjau Kinerja Standar
  if (reportType === "standard") {
    const total = data.tasks?.length ?? 0;
    const done = data.tasks?.filter((t: any) => t.status === "done").length ?? 0;
    const inProg = data.tasks?.filter((t: any) => t.status === "in_progress").length ?? 0;
    const todo = data.tasks?.filter((t: any) => t.status === "todo").length ?? 0;

    return (
      <Card className="surface-card border-0 p-6 space-y-4">
        <h3 className="font-semibold text-base">Pratinjau Laporan Kinerja (Standar)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total Tugas</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-success">{done}</div>
            <div className="text-xs text-muted-foreground">Selesai</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{inProg}</div>
            <div className="text-xs text-muted-foreground">Sedang Berjalan</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-warning">{todo}</div>
            <div className="text-xs text-muted-foreground">Belum Mulai</div>
          </div>
        </div>
      </Card>
    );
  }

  // Pratinjau Log Book Meeting
  if (reportType === "meeting") {
    const tasks = data.tasks ?? [];
    const employeeName = makerName || data.name || "";
    const employeePosition = data.position || "Staf";
    const dateStart = new Date(data.periodStart ?? new Date());
    const monthName = format(dateStart, "MMMM", { locale: idLocale });
    const yearName = format(dateStart, "yyyy", { locale: idLocale });

    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Pratinjau Kertas ({paperSize} - {orientation === "landscape" ? "Landscape" : "Portrait"})</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {tasks.length} Baris Ditemukan
          </span>
        </div>

        <div 
          className="w-full bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-center p-4 md:p-8 overflow-hidden"
          style={{ height: scale < 1 ? `${paperHeight * scale + 64}px` : "auto" }}
        >
          <div 
            className="relative bg-white text-black shadow-2xl border border-slate-300 flex flex-col justify-between font-sans transition-all duration-300 origin-top shrink-0 mx-auto overflow-hidden"
            style={{ 
              padding: `${marginMm}mm`,
              width: `${paperWidth}px`,
              height: `${paperHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] select-none z-20">
              <img src="/watermark.webp" alt="watermark" className="w-[50%] h-auto object-contain" />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Title */}
              <div className="text-center mb-6 flex flex-col items-center">
                <h2 className="text-lg font-bold tracking-wide text-[#0077B6] uppercase">LOG BOOK MEETING</h2>
                <div className="w-16 h-0.5 bg-[#0077B6] mt-1.5 rounded-full"></div>
              </div>

              {/* Metadata Info Box (2 rows) */}
              <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl mb-6 text-xs text-black space-y-1.5 relative overflow-hidden pl-5 border-l-4 border-l-[#0077B6]">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Nama</div>
                    <div className="truncate font-semibold text-black">: {employeeName}</div>
                  </div>
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Divisi</div>
                    <div className="truncate font-semibold text-black">: {employeePosition}</div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Bulan</div>
                    <div className="truncate font-semibold text-black">: {monthName}</div>
                  </div>
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Tahun</div>
                    <div className="truncate font-semibold text-black">: {yearName}</div>
                  </div>
                </div>
              </div>

              {/* Subheading */}
              <div className="font-bold text-xs mb-3 text-[#0077B6] uppercase tracking-wide">
                DAFTAR PENUGASAN / HASIL MEETING
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-[#0077B6] border-b border-slate-200">
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[5%] font-bold text-white">No</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[15%] font-bold text-white">Hari / Tanggal</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[35%] font-bold text-white">Uraian Tugas</th>
                    <th colSpan={2} className="p-2.5 border border-slate-200 text-center w-[20%] font-bold text-white">Pemberi Tugas</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[12%] font-bold text-white">Target Selesai</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[13%] font-bold text-white">Out Put</th>
                  </tr>
                  <tr className="bg-[#0077B6] border-b border-slate-200">
                    <th className="p-1.5 border border-slate-200 text-center w-[10%] font-bold text-white">Atasan</th>
                    <th className="p-1.5 border border-slate-200 text-center w-[10%] font-bold text-white">Meeting</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={`empty-task-${index}`} className="even:bg-slate-50/30 odd:bg-white border-b border-slate-200 text-black h-8">
                        <td className="p-2 border border-slate-200 text-center font-medium text-slate-400">{index + 1}</td>
                        <td className="p-2 border border-slate-200"></td>
                        <td className="p-2 border border-slate-200"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200"></td>
                      </tr>
                    ))
                  ) : (
                    tasks.map((t: any, index: number) => {
                      const dayDateStr = format(new Date(t.createdAt), "EEE, dd MMMM yyyy", { locale: idLocale });
                      const descStr = [t.title, t.description].filter(Boolean).join(" - ");
                      const sourceLower = (t.taskSource ?? "").toLowerCase();
                      const isMeeting = sourceLower.includes("meeting") || sourceLower.includes("rapat");
                      const targetStr = t.dueDate ? format(new Date(t.dueDate), "dd MMMM yyyy", { locale: idLocale }) : "—";
                      const outputStr = t.outputDescription ?? "—";
 
                      return (
                        <tr key={t.id} className="even:bg-slate-50/30 odd:bg-white hover:bg-slate-100/30 border-b border-slate-200 text-black">
                          <td className="p-2 border border-slate-200 text-center font-medium text-slate-500">{index + 1}</td>
                          <td className="p-2 border border-slate-200 font-medium text-slate-700">{dayDateStr}</td>
                          <td className="p-2 border border-slate-200 whitespace-pre-line text-slate-800">{descStr}</td>
                          <td className="p-2 border border-slate-200 text-center text-[#0077B6] font-bold text-sm">{!isMeeting ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-200 text-center text-[#0077B6] font-bold text-sm">{isMeeting ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-200 text-center text-slate-700">{targetStr}</td>
                          <td className="p-2 border border-slate-200 text-slate-700">{outputStr}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="mt-12 text-xs text-black space-y-4">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div className="space-y-4 relative flex flex-col items-center">
                  <div>
                    <div>Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Membuat</div>
                  </div>
                  <div className="h-12 w-full relative flex items-center justify-center">
                    {makerSigImg ? (
                      <img
                        src={makerSigImg}
                        alt="Tanda Tangan Karyawan"
                        style={{
                          width: `${30 * (makerSigScale / 100)}mm`,
                          height: `${15 * (makerSigScale / 100)}mm`,
                          objectFit: "contain",
                          transform: `translate(${makerSigOffsetX}mm, ${makerSigOffsetY}mm)`,
                        }}
                        className="transition-all duration-100 select-none pointer-events-none"
                      />
                    ) : (
                      <div className="h-12" />
                    )}
                  </div>
                  <div className="font-bold">{formatSigText(employeeName, `( ${employeeName} )`)}</div>
                </div>
                <div className="space-y-4 relative flex flex-col items-center">
                  <div>
                    <div className="opacity-0">Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Mengetahui</div>
                  </div>
                  <div className="h-12 w-full relative flex items-center justify-center">
                    {checkerSigImg ? (
                      <img
                        src={checkerSigImg}
                        alt="Tanda Tangan Atasan"
                        style={{
                          width: `${30 * (checkerSigScale / 100)}mm`,
                          height: `${15 * (checkerSigScale / 100)}mm`,
                          objectFit: "contain",
                          transform: `translate(${checkerSigOffsetX}mm, ${checkerSigOffsetY}mm)`,
                        }}
                        className="transition-all duration-100 select-none pointer-events-none"
                      />
                    ) : (
                      <div className="h-12" />
                    )}
                  </div>
                  <div className="font-bold">{formatSigText(checkerName, "( .................................... )")}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Pratinjau Log Book Harian
  if (reportType === "harian") {
    const logs = data.logs ?? [];
    const employeeName = makerName || data.name || "";
    const employeePosition = data.position || "Staf";
    const dateStart = new Date(data.periodStart ?? new Date());
    const monthName = format(dateStart, "MMMM", { locale: idLocale });
    const yearName = format(dateStart, "yyyy", { locale: idLocale });

    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Pratinjau Kertas ({paperSize} - {orientation === "landscape" ? "Landscape" : "Portrait"})</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {logs.length} Baris Ditemukan
          </span>
        </div>

        <div 
          className="w-full bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-center p-4 md:p-8 overflow-hidden"
          style={{ height: scale < 1 ? `${paperHeight * scale + 64}px` : "auto" }}
        >
          <div 
            className="relative bg-white text-black shadow-2xl border border-slate-300 flex flex-col justify-between font-sans transition-all duration-300 origin-top shrink-0 mx-auto overflow-hidden"
            style={{ 
              padding: `${marginMm}mm`,
              width: `${paperWidth}px`,
              height: `${paperHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12] select-none z-20">
              <img src="/watermark.webp" alt="watermark" className="w-[50%] h-auto object-contain" />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Title */}
              <div className="text-center mb-6 flex flex-col items-center">
                <h2 className="text-lg font-bold tracking-wide text-[#0077B6] uppercase">LOG BOOK KEGIATAN HARIAN</h2>
                <div className="w-16 h-0.5 bg-[#0077B6] mt-1.5 rounded-full"></div>
              </div>

              {/* Metadata Info Box (2 rows) */}
              <div className="border border-slate-200 bg-slate-50/50 p-4 rounded-xl mb-6 text-xs text-black space-y-1.5 relative overflow-hidden pl-5 border-l-4 border-l-[#0077B6]">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Nama</div>
                    <div className="truncate font-semibold text-black">: {employeeName}</div>
                  </div>
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Divisi</div>
                    <div className="truncate font-semibold text-black">: {employeePosition}</div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Bulan</div>
                    <div className="truncate font-semibold text-black">: {monthName}</div>
                  </div>
                  <div className="col-span-6 flex">
                    <div className="w-16 font-bold shrink-0 text-black">Tahun</div>
                    <div className="truncate font-semibold text-black">: {yearName}</div>
                  </div>
                </div>
              </div>

              {/* Subheading */}
              <div className="font-bold text-xs mb-3 text-[#0077B6] uppercase tracking-wide">
                DAFTAR KEGIATAN HARIAN
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-[#0077B6] border-b border-slate-200">
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[5%] font-bold text-white">No</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[15%] font-bold text-white">Hari / Tanggal</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[10%] font-bold text-white">Jam</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[30%] font-bold text-white">Implementasi Kegiatan</th>
                    <th colSpan={2} className="p-2.5 border border-slate-200 text-center w-[20%] font-bold text-white">Status</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[10%] font-bold text-white">Validasi Atasan</th>
                    <th rowSpan={2} className="p-2.5 border border-slate-200 text-center align-middle w-[10%] font-bold text-white">Keterangan</th>
                  </tr>
                  <tr className="bg-[#0077B6] border-b border-slate-200">
                    <th className="p-1.5 border border-slate-200 text-center w-[10%] font-bold text-white">On Progres</th>
                    <th className="p-1.5 border border-slate-200 text-center w-[10%] font-bold text-white">Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={`empty-log-${index}`} className="even:bg-slate-50/30 odd:bg-white border-b border-slate-200 text-black h-8">
                        <td className="p-2 border border-slate-200 text-center font-medium text-slate-400">{index + 1}</td>
                        <td className="p-2 border border-slate-200"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200 text-center"></td>
                        <td className="p-2 border border-slate-200"></td>
                      </tr>
                    ))
                  ) : (
                    logs.map((l: any, index: number) => {
                      const dayDateStr = format(new Date(l.loggedDate), "EEE, dd MMMM yyyy", { locale: idLocale });
                      const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
                      const activityStr = [l.task?.title, l.note].filter(Boolean).join(" - ");
                      const isDone = l.status === "Selesai" || l.status === "selesai" || l.task?.status === "done";
                      const validatedStr = l.isValidated ? "✓" : "";
                      const remarksStr = l.remarks ?? "—";
 
                      return (
                        <tr key={l.id} className="even:bg-slate-50/30 odd:bg-white hover:bg-slate-100/30 border-b border-slate-200 text-black">
                          <td className="p-2 border border-slate-200 text-center font-medium text-slate-500">{index + 1}</td>
                          <td className="p-2 border border-slate-200 font-medium text-slate-700">{dayDateStr}</td>
                          <td className="p-2 border border-slate-200 text-center text-slate-700">{timeStr}</td>
                          <td className="p-2 border border-slate-200 whitespace-pre-line text-slate-800">{activityStr}</td>
                          <td className="p-2 border border-slate-200 text-center text-amber-500 font-bold text-sm">{!isDone ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-200 text-center text-emerald-500 font-bold text-sm">{isDone ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-200 text-center text-[#0077B6] font-bold text-sm">{validatedStr}</td>
                          <td className="p-2 border border-slate-200 text-slate-700">{remarksStr}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="mt-12 text-xs text-black space-y-4">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div className="space-y-4 relative flex flex-col items-center">
                  <div>
                    <div>Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Membuat</div>
                  </div>
                  <div className="h-12 w-full relative flex items-center justify-center">
                    {makerSigImg ? (
                      <img
                        src={makerSigImg}
                        alt="Tanda Tangan Karyawan"
                        style={{
                          width: `${30 * (makerSigScale / 100)}mm`,
                          height: `${15 * (makerSigScale / 100)}mm`,
                          objectFit: "contain",
                          transform: `translate(${makerSigOffsetX}mm, ${makerSigOffsetY}mm)`,
                        }}
                        className="transition-all duration-100 select-none pointer-events-none"
                      />
                    ) : (
                      <div className="h-12" />
                    )}
                  </div>
                  <div className="font-bold">{formatSigText(employeeName, `( ${employeeName} )`)}</div>
                </div>
                <div className="space-y-4 relative flex flex-col items-center">
                  <div>
                    <div className="opacity-0">Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Mengetahui</div>
                  </div>
                  <div className="h-12 w-full relative flex items-center justify-center">
                    {checkerSigImg ? (
                      <img
                        src={checkerSigImg}
                        alt="Tanda Tangan Atasan"
                        style={{
                          width: `${30 * (checkerSigScale / 100)}mm`,
                          height: `${15 * (checkerSigScale / 100)}mm`,
                          objectFit: "contain",
                          transform: `translate(${checkerSigOffsetX}mm, ${checkerSigOffsetY}mm)`,
                        }}
                        className="transition-all duration-100 select-none pointer-events-none"
                      />
                    ) : (
                      <div className="h-12" />
                    )}
                  </div>
                  <div className="font-bold">{formatSigText(checkerName, "( .................................... )")}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return null;
}
