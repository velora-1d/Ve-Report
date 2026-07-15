import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Check,
  Clock,
  Users,
  CheckSquare,
  ListChecks,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdminOrDev } from "@/lib/roles";
import { db } from "@/db";
import {
  divisions as divisionsTable,
  divisionValidators as validatorTable,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { createServerFn } from "@tanstack/react-start";
import { formatDuration } from "@/lib/tracker";
import { getAppConfig } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTrackerLogs,
  validateTrackerLog,
  bulkValidateTrackerLogs,
} from "./pelacak";
import { getSimpleUsers } from "@/lib/server-fns";

// ponytail: Fungsi server untuk mengambil daftar divisi yang divalidasi oleh admin validator
export const getValidatorDivisions = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const role = session.user.role || "staff";
    if (role === "developer") {
      return await db
        .select()
        .from(divisionsTable)
        .orderBy(divisionsTable.name);
    }

    return await db
      .select({
        id: divisionsTable.id,
        name: divisionsTable.name,
      })
      .from(validatorTable)
      .innerJoin(
        divisionsTable,
        eq(validatorTable.divisionId, divisionsTable.id),
      )
      .where(eq(validatorTable.userId, session.user.id))
      .orderBy(divisionsTable.name);
  },
);

export const Route = createFileRoute("/_authenticated/validasi")({
  head: () => ({
    meta: [
      { title: "Validasi Log — Admin" },
      {
        name: "description",
        content: "Setujui log harian staff.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ValidasiPage,
});

function ValidasiPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";

  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "validated"
  >("all");
  const [selectedDivId, setSelectedDivId] = useState<string>("all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["tracker-logs", user?.id, selectedDivId],
    enabled: !!user?.id,
    queryFn: () => getTrackerLogs({ data: { divisionId: selectedDivId } }),
  });

  const isAdminOrDevUser = useMemo(
    () => isAdminOrDev(user?.roles ?? []),
    [user?.roles],
  );

  const { data: usersSimple } = useQuery({
    queryKey: ["users-simple"],
    enabled: isAdminOrDevUser,
    queryFn: () => getSimpleUsers(),
  });

  const { data: validatorDivisions } = useQuery({
    queryKey: ["validator-divisions", user?.id],
    enabled: !!user?.id && isAdminOrDevUser,
    queryFn: () => getValidatorDivisions(),
  });

  // Filter logs created by staff (exclude current admin logs, but keep developer logs so they are testable)
  const staffLogs = useMemo(() => {
    if (!logs) return [];
    if (!isAdminOrDevUser) return [];
    if (user?.role === "developer") return logs; // Developer can see all logs including their own
    return logs.filter((l) => l.userId !== user?.id);
  }, [logs, isAdminOrDevUser, user?.id, user?.role]);

  const staffList = useMemo(() => {
    if (!usersSimple) return [];
    // Only show users that are not the current user, UNLESS the current user is a developer (so they can see themselves for testing)
    return usersSimple
      .filter(
        (u: { id: string; name: string | null }) =>
          u.id !== user?.id || user?.role === "developer",
      )
      .map((u: { id: string; name: string | null }) => ({
        id: u.id,
        name: u.name,
      }));
  }, [usersSimple, user?.id, user?.role]);

  const filteredLogs = useMemo(() => {
    return staffLogs.filter((l) => {
      const matchStaff = filterStaffId === "all" || l.userId === filterStaffId;
      const matchStatus =
        filterStatus === "all"
          ? true
          : filterStatus === "pending"
            ? !l.isValidated
            : l.isValidated;
      return matchStaff && matchStatus;
    });
  }, [staffLogs, filterStaffId, filterStatus]);

  const stats = useMemo(() => {
    let pendingCount = 0;
    let validatedCount = 0;
    for (const l of staffLogs) {
      if (l.isValidated) {
        validatedCount++;
      } else {
        pendingCount++;
      }
    }
    return {
      total: staffLogs.length,
      pending: pendingCount,
      validated: validatedCount,
    };
  }, [staffLogs]);

  const pendingCountFiltered = useMemo(() => {
    return filteredLogs.filter((l) => !l.isValidated).length;
  }, [filteredLogs]);

  const validateMutation = useMutation({
    mutationFn: (v: { id: string; isValidated: boolean }) =>
      validateTrackerLog({ data: v }),
    onSuccess: () => {
      toast.success("Status validasi diperbarui");
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memvalidasi", { description: e.message }),
  });

  const bulkValidateMutation = useMutation({
    mutationFn: (v: { ids: string[]; isValidated: boolean }) =>
      bulkValidateTrackerLogs({ data: v }),
    onSuccess: (res) => {
      toast.success(`${res.count} log harian berhasil divalidasi`);
      qc.invalidateQueries({ queryKey: ["tracker-logs"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memvalidasi masal", { description: e.message }),
  });

  if (!isAdminOrDevUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <h3 className="text-lg font-bold text-slate-800">Akses Ditolak</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Hanya Administrator atau Developer yang dapat mengakses halaman
          validasi ini.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Validasi Harian Staff
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Setujui dan validasi log pengerjaan tugas harian yang dikirimkan oleh
          staff.
        </p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="surface-card border-0">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Total Log Staff
              </span>
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {stats.total} Log
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card border-0">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Belum Validasi
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-semibold tracking-tight text-amber-600">
              {stats.pending} Log
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card border-0">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Tervalidasi
              </span>
              <ListChecks className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-semibold tracking-tight text-emerald-600">
              {stats.validated} Log
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions Box */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-border/60 rounded-2xl shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-4">
          {isAdminOrDevUser && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Divisi
              </span>
              <select
                value={selectedDivId}
                onChange={(e) => setSelectedDivId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent min-w-[150px] dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="all">Semua Divisi Saya</option>
                {validatorDivisions?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Filter Staff
            </span>
            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent min-w-[160px] dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="all">Semua Staff</option>
              {staffList.map((s: { id: string; name: string | null }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Status Validasi
            </span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent min-w-[130px] dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Belum Validasi</option>
              <option value="validated">Tervalidasi</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end">
          {pendingCountFiltered > 0 && (
            <Button
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkValidateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all border-0 hover:-translate-y-0.5 active:translate-y-0 animate-pulse"
            >
              <Check className="w-4 h-4" />
              Setujui Semua ({pendingCountFiltered})
            </Button>
          )}
        </div>
      </div>

      {/* Logs Table Card */}
      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle className="text-base">Daftar Log Harian Staff</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Tidak ada log staff yang sesuai dengan kriteria filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hari / Tanggal</TableHead>
                    <TableHead>Nama Staff</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Implementasi Kegiatan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validasi</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l) => {
                    const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
                    const activityStr = l.note || l.task?.title || "—";
                    const isDone = l.status === "done";
                    const statusStr = isDone ? "Selesai" : "On Progres";
                    const validatedStr = l.isValidated ? "Disetujui" : "Belum";
                    const remarksStr = l.remarks ?? "—";

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {l.loggedDate
                            ? format(
                                new Date(l.loggedDate),
                                "EEE, d MMM yyyy",
                                {
                                  locale: idLocale,
                                },
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <div>{l.user?.name ?? "—"}</div>
                          {l.user?.position && (
                            <div className="mt-1">
                              <span className="text-[10px] font-normal text-muted-foreground px-1.5 py-0.5 rounded bg-muted/65">
                                {l.user.position}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {timeStr}
                        </TableCell>
                        <TableCell className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                          {activityStr || "—"}
                          {l.task?.title && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Tugas: {l.task.title}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-800"}`}
                          >
                            {statusStr}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`px-2 py-0.5 h-auto text-xs font-bold ${l.isValidated ? "bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"}`}
                            onClick={() =>
                              validateMutation.mutate({
                                id: l.id,
                                isValidated: !l.isValidated,
                              })
                            }
                          >
                            {validatedStr}
                          </Button>
                          {l.isValidated && l.validator && (
                            <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                              Oleh: {l.validator.name}{" "}
                              {l.validator.position
                                ? `(${l.validator.position})`
                                : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {remarksStr}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Validation Confirmation Dialog */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent className="surface-card border-none rounded-2xl p-6 shadow-soft max-w-sm mx-auto dark:bg-slate-900">
          <AlertDialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 scale-110">
              <Check className="w-6 h-6 animate-pulse text-emerald-600" />
            </div>
            <AlertDialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
              Setujui Masal Log Harian?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Apakah Anda yakin ingin menyetujui sekaligus{" "}
              <b>{pendingCountFiltered} log harian</b> terpilih yang belum
              divalidasi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 font-semibold text-xs py-2">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pendingIds = filteredLogs
                  .filter((l) => !l.isValidated)
                  .map((l) => l.id);
                bulkValidateMutation.mutate({
                  ids: pendingIds,
                  isValidated: true,
                });
                setBulkConfirmOpen(false);
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-xs py-2 shadow-md hover:shadow-lg transition-all"
            >
              Ya, Setujui
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
