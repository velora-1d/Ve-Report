// ponytail: Mengganti query Supabase client-side untuk laporan dengan Server Functions Drizzle ORM
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileText, Download, Loader2 } from "lucide-react";
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

// ponytail: Fungsi server untuk mengambil daftar nama pengguna sederhana (untuk filter)
const getSimpleUsers = createServerFn({ method: "GET" }).handler(async () => {
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
      logsQuery = db.query.trackerLogs.findMany({
        where: and(
          eq(trackerLogsTable.userId, data.userId),
          gte(trackerLogsTable.loggedDate, data.periodStart),
          lte(trackerLogsTable.loggedDate, data.periodEnd)
        ),
        with: {
          task: {
            columns: {
              title: true,
              status: true,
            }
          }
        },
        orderBy: [desc(trackerLogsTable.loggedDate)]
      });
    } else {
      logsQuery = db.query.trackerLogs.findMany({
        where: and(
          gte(trackerLogsTable.loggedDate, data.periodStart),
          lte(trackerLogsTable.loggedDate, data.periodEnd)
        ),
        with: {
          task: {
            columns: {
              title: true,
              status: true,
            }
          }
        },
        orderBy: [desc(trackerLogsTable.loggedDate)]
      });
    }

    const [tasks, logs] = await Promise.all([tasksQuery, logsQuery]);

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
  const qc = useQueryClient();
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
        throw new Error("Laporan Log Book harus difilter untuk satu pengguna tertentu (tidak bisa Semua Pengguna).");
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
        blob = await generateReportPdf(
          {
            title: title.trim(),
            periodStart: start,
            periodEnd: end,
            generatedByName: makerName || me.name,
            reportType,
            checkerName: checkerName || null,
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
                      if (type === "meeting") setTitle("Log Book Meeting");
                      else if (type === "harian") setTitle("Log Book Harian");
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
                      Log Book Meeting (Excel / PDF)
                    </SelectItem>
                    <SelectItem value="harian">
                      Log Book Harian (Excel / PDF)
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

              {/* ponytail: Form nama tanda tangan custom */}
              {(reportType === "meeting" || reportType === "harian") && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tanda Tangan Laporan</h4>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nama Yang Membuat</Label>
                    <Input
                      value={makerName}
                      onChange={(e) => setMakerName(e.target.value)}
                      placeholder="Nama Karyawan..."
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nama Yang Mengetahui (Atasan)</Label>
                    <Input
                      value={checkerName}
                      onChange={(e) => setCheckerName(e.target.value)}
                      placeholder="Kosongkan untuk titik-titik"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => generate.mutate("pdf")}
                  disabled={generate.isPending}
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
                  disabled={generate.isPending}
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
        <div className="flex-1 w-full min-w-0">
          <ReportPreviewGrid
            reportType={reportType}
            data={previewData}
            isLoading={previewLoading}
            paperSize={paperSize}
            orientation={orientation}
            makerName={makerName}
            checkerName={checkerName}
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
}: {
  reportType: "standard" | "meeting" | "harian";
  data: any;
  isLoading: boolean;
  paperSize: "A4" | "F4";
  orientation: "portrait" | "landscape";
  makerName: string;
  checkerName: string;
}) {
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

  const marginMm = Math.max(5, Math.min(50, parseInt(data.cfg?.pdfMargin ?? "20", 10) || 20));

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

        <div className="w-full overflow-x-auto p-4 md:p-8 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-start lg:justify-center">
          <div 
            className="bg-white text-black shadow-2xl border border-slate-300 flex flex-col justify-between font-sans transition-all duration-300 origin-top shrink-0"
            style={{ 
              padding: `${marginMm}mm`,
              width: orientation === "landscape" 
                ? (paperSize === "F4" ? "330mm" : "297mm")
                : (paperSize === "F4" ? "215mm" : "210mm"),
              minHeight: orientation === "landscape" 
                ? (paperSize === "F4" ? "215mm" : "210mm")
                : (paperSize === "F4" ? "330mm" : "297mm"),
            }}
          >
            <div>
              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold tracking-wide text-black uppercase">LOG BOOK MEETING</h2>
              </div>

              {/* Metadata Info Box */}
              <div className="border border-black p-3 mb-6 text-xs text-black space-y-1.5">
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Nama</div>
                  <div className="col-span-9">: {employeeName}</div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Divisi</div>
                  <div className="col-span-9">: {employeePosition}</div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Bulan dan Tahun</div>
                  <div className="col-span-9">: {monthName} {yearName}</div>
                </div>
              </div>

              {/* Subheading */}
              <div className="font-bold text-xs mb-3 text-black uppercase">
                PENUGASAN ATASAN/HASIL MEETING/.......
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-400">
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[15%]">Hari / Tanggal</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[40%]">Uraian Tugas</th>
                    <th colSpan={2} className="p-2 border border-slate-400 text-center w-[20%]">Pemberi Tugas</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[12%]">Target Selesai</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[13%]">Out Put</th>
                  </tr>
                  <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-400">
                    <th className="p-1 border border-slate-400 text-center w-[10%]">Atasan</th>
                    <th className="p-1 border border-slate-400 text-center w-[10%]">Meeting</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 border border-slate-400 text-center text-muted-foreground bg-white">
                        Tidak ada data tugas meeting pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((t: any) => {
                      const dayDateStr = format(new Date(t.createdAt), "EEEE, dd MMMM yyyy", { locale: idLocale });
                      const descStr = [t.title, t.description].filter(Boolean).join(" - ");
                      const sourceLower = (t.taskSource ?? "").toLowerCase();
                      const isMeeting = sourceLower.includes("meeting") || sourceLower.includes("rapat");
                      const targetStr = t.dueDate ? format(new Date(t.dueDate), "dd MMMM yyyy", { locale: idLocale }) : "—";
                      const outputStr = t.outputDescription ?? "—";

                      return (
                        <tr key={t.id} className="bg-white hover:bg-slate-50 border-b border-slate-400 text-black">
                          <td className="p-2 border border-slate-400 font-medium">{dayDateStr}</td>
                          <td className="p-2 border-slate-400 whitespace-pre-line">{descStr}</td>
                          <td className="p-2 border-slate-400 text-center text-success font-bold text-sm">{!isMeeting ? "✓" : ""}</td>
                          <td className="p-2 border-slate-400 text-center text-success font-bold text-sm">{isMeeting ? "✓" : ""}</td>
                          <td className="p-2 border-slate-400 text-center">{targetStr}</td>
                          <td className="p-2 border-slate-400">{outputStr}</td>
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
                <div className="space-y-4">
                  <div>
                    <div>Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Membuat</div>
                  </div>
                  <div className="h-12" />
                  <div className="font-bold">{formatSigText(employeeName, `( ${employeeName} )`)}</div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="opacity-0">Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Mengetahui</div>
                  </div>
                  <div className="h-12" />
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

        <div className="w-full overflow-x-auto p-4 md:p-8 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-start lg:justify-center">
          <div 
            className="bg-white text-black shadow-2xl border border-slate-300 flex flex-col justify-between font-sans transition-all duration-300 origin-top shrink-0"
            style={{ 
              padding: `${marginMm}mm`,
              width: orientation === "landscape" 
                ? (paperSize === "F4" ? "330mm" : "297mm")
                : (paperSize === "F4" ? "215mm" : "210mm"),
              minHeight: orientation === "landscape" 
                ? (paperSize === "F4" ? "215mm" : "210mm")
                : (paperSize === "F4" ? "330mm" : "297mm"),
            }}
          >
            <div>
              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold tracking-wide text-black uppercase">LOG BOOK KEGIATAN HARIAN</h2>
              </div>

              {/* Metadata Info Box */}
              <div className="border border-black p-3 mb-6 text-xs text-black space-y-1.5">
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Nama</div>
                  <div className="col-span-9">: {employeeName}</div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Divisi</div>
                  <div className="col-span-9">: {employeePosition}</div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-3 font-bold">Bulan</div>
                  <div className="col-span-3">: {monthName}</div>
                  <div className="col-span-3 font-bold text-right pr-4">Tahun</div>
                  <div className="col-span-3">: {yearName}</div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-400">
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[15%]">Hari / Tanggal</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[10%]">Jam</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[35%]">Implementasi Kegiatan</th>
                    <th colSpan={2} className="p-2 border-slate-400 text-center w-[20%]">Status</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[10%]">Validasi Atasan</th>
                    <th rowSpan={2} className="p-2 border border-slate-400 text-center align-middle w-[10%]">Keterangan</th>
                  </tr>
                  <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-400">
                    <th className="p-1 border border-slate-400 text-center w-[10%]">On Progres</th>
                    <th className="p-1 border border-slate-400 text-center w-[10%]">Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 border border-slate-400 text-center text-muted-foreground bg-white">
                        Tidak ada data log harian pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l: any) => {
                      const dayDateStr = format(new Date(l.loggedDate), "EEEE, dd MMMM yyyy", { locale: idLocale });
                      const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
                      const activityStr = [l.task?.title, l.note].filter(Boolean).join(" - ");
                      const isDone = l.status === "Selesai" || l.status === "selesai" || l.task?.status === "done";
                      const validatedStr = l.isValidated ? "✓" : "";
                      const remarksStr = l.remarks ?? "—";

                      return (
                        <tr key={l.id} className="bg-white hover:bg-slate-50 border-b border-slate-400 text-black">
                          <td className="p-2 border border-slate-400 font-medium">{dayDateStr}</td>
                          <td className="p-2 border border-slate-400 text-center">{timeStr}</td>
                          <td className="p-2 border border-slate-400 whitespace-pre-line">{activityStr}</td>
                          <td className="p-2 border border-slate-400 text-center text-success font-bold text-sm">{!isDone ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-400 text-center text-success font-bold text-sm">{isDone ? "✓" : ""}</td>
                          <td className="p-2 border border-slate-400 text-center text-success font-bold text-sm">{validatedStr}</td>
                          <td className="p-2 border border-slate-400">{remarksStr}</td>
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
                <div className="space-y-4">
                  <div>
                    <div>Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Membuat</div>
                  </div>
                  <div className="h-12" />
                  <div className="font-bold">{formatSigText(employeeName, `( ${employeeName} )`)}</div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="opacity-0">Jonggol, {format(new Date(), "dd MMMM yyyy", { locale: idLocale })}</div>
                    <div className="mt-1">Yang Mengetahui</div>
                  </div>
                  <div className="h-12" />
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
