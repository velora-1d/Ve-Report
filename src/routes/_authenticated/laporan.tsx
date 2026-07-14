// ponytail: Mengganti query Supabase client-side untuk laporan dengan Server Functions Drizzle ORM
import { useState } from "react";
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
            reportType: "harian", // fallback, ignored by generator
            periodStart: start,
            periodEnd: end,
            generatedByName: me.name,
            userPosition: me.position,
          },
          {
            employeeName: reportData.name,
            employeePosition: reportData.position,
            tasks: reportData.tasks,
            logs: reportData.logs,
          }
        );
        extension = "xlsx";
      } else {
        blob = await generateReportPdf(
          {
            title: title.trim(),
            periodStart: start,
            periodEnd: end,
            generatedByName: me.name,
            reportType,
          },
          {
            cfg: reportData.cfg,
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
          </div>
          <div className="flex justify-end gap-2">
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

      {/* ponytail: Render pratinjau grid laporan secara live/real-time */}
      <ReportPreviewGrid
        reportType={reportType}
        data={previewData}
        isLoading={previewLoading}
      />

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
  );
}

// ponytail: Komponen pratinjau grid laporan secara live/real-time untuk melihat struktur data sebelum diekspor
function ReportPreviewGrid({
  reportType,
  data,
  isLoading,
}: {
  reportType: "standard" | "meeting" | "harian";
  data: any;
  isLoading: boolean;
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
    return (
      <Card className="surface-card border-0 p-6 space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-bold text-base">Pratinjau Live: LOG BOOK MEETING</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {tasks.length} Baris Ditemukan
          </span>
        </div>

        <div className="border border-slate-300 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-300">
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Hari / Tanggal</th>
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Uraian Tugas</th>
                <th colSpan={2} className="p-2 border-b border-r border-slate-300 text-center">Pemberi Tugas</th>
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Target Selesai</th>
                <th rowSpan={2} className="p-2.5 text-center align-middle">Out Put</th>
              </tr>
              <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300 text-center">Atasan</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Meeting</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
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
                    <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-200 text-black font-medium">{dayDateStr}</td>
                      <td className="p-2 border-r border-slate-200 whitespace-pre-line text-black">{descStr}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-success font-bold">{!isMeeting ? "✓" : ""}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-success font-bold">{isMeeting ? "✓" : ""}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-black">{targetStr}</td>
                      <td className="p-2 text-black">{outputStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  // Pratinjau Log Book Harian
  if (reportType === "harian") {
    const logs = data.logs ?? [];
    return (
      <Card className="surface-card border-0 p-6 space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-bold text-base">Pratinjau Live: LOG BOOK KEGIATAN HARIAN</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {logs.length} Baris Ditemukan
          </span>
        </div>

        <div className="border border-slate-300 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-300">
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Hari / Tanggal</th>
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Jam</th>
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Implementasi Kegiatan</th>
                <th colSpan={2} className="p-2 border-b border-r border-slate-300 text-center">Status</th>
                <th rowSpan={2} className="p-2.5 border-r border-slate-300 text-center align-middle">Validasi Atasan</th>
                <th rowSpan={2} className="p-2.5 text-center align-middle">Keterangan</th>
              </tr>
              <tr className="bg-[#DADEE5] text-black font-bold border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300 text-center">On Progres</th>
                <th className="p-1.5 border-r border-slate-300 text-center">Selesai</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
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
                    <tr key={l.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-200 text-black font-medium">{dayDateStr}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-black">{timeStr}</td>
                      <td className="p-2 border-r border-slate-200 whitespace-pre-line text-black">{activityStr}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-success font-bold">{!isDone ? "✓" : ""}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-success font-bold">{isDone ? "✓" : ""}</td>
                      <td className="p-2 border-r border-slate-200 text-center text-success font-bold">{validatedStr}</td>
                      <td className="p-2 text-black">{remarksStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return null;
}
