import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export interface ExcelReportInput {
  reportType: "meeting" | "harian";
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string;
  userId?: string | null;
  generatedByName: string;
  userPosition?: string | null;
}

export async function generateReportExcel(
  input: ExcelReportInput,
): Promise<Blob> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, position")
    .eq("id", input.userId || "")
    .single();

  const employeeName = profile?.name ?? input.generatedByName;
  const employeePosition = profile?.position ?? input.userPosition ?? "Staf";

  const dateStart = new Date(input.periodStart);
  const dateEnd = new Date(input.periodEnd);

  const monthName = format(dateStart, "MMMM", { locale: idLocale });
  const yearName = format(dateStart, "yyyy", { locale: idLocale });

  const wb = XLSX.utils.book_new();

  if (input.reportType === "meeting") {
    // === LOG BOOK MEETING ===
    let tasksQ = supabase
      .from("tasks")
      .select(
        "id, title, description, created_at, due_date, task_source, output_description",
      )
      .gte("created_at", input.periodStart)
      .lte("created_at", input.periodEnd + "T23:59:59")
      .order("created_at", { ascending: true });

    if (input.userId) {
      tasksQ = tasksQ.eq("assigned_to", input.userId);
    }
    const { data: tasks, error } = await tasksQ;
    if (error) throw error;

    const rows: unknown[][] = [];

    // Rows 1-5: Header & Metadata
    rows.push(["LOG BOOK MEETING"]);
    rows.push([]);
    rows.push(["Nama", ":", employeeName]);
    rows.push(["Divisi", ":", employeePosition]);
    rows.push(["Bulan dan Tahun", ":", `${monthName} ${yearName}`]);
    rows.push([]);
    rows.push(["PENUGASAN ATASAN/HASIL MEETING/......."]);

    // Rows 8-9: Table Headers
    rows.push([
      "Hari / Tanggal",
      "Uraian Tugas",
      "", // Merged for Uraian Tugas
      "", // Merged for Uraian Tugas
      "Pemberi Tugas",
      "", // Merged for Pemberi Tugas
      "Target Selesai",
      "Out Put",
    ]);
    rows.push(["", "", "", "", "Atasan", "Meeting", "", ""]);

    // Row 10 onwards: Data
    const dataStartRow = 10;
    if (tasks && tasks.length > 0) {
      tasks.forEach((t) => {
        const taskDate = new Date(t.created_at);
        const dayDateStr = format(taskDate, "EEEE, dd MMMM yyyy", {
          locale: idLocale,
        });
        const descStr = [t.title, t.description].filter(Boolean).join("\n");
        const isAtasan = t.task_source === "atasan" ? "V" : "";
        const isMeeting = t.task_source === "meeting" ? "V" : "";
        const targetStr = t.due_date
          ? format(new Date(t.due_date), "dd MMMM yyyy", { locale: idLocale })
          : "-";
        const outputStr = t.output_description ?? "-";

        rows.push([
          dayDateStr,
          descStr,
          "", // Spanned
          "", // Spanned
          isAtasan,
          isMeeting,
          targetStr,
          outputStr,
        ]);
      });
    } else {
      rows.push([
        "Tidak ada data tugas untuk periode ini",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    }

    // Add spacing rows before footer
    rows.push([]);
    rows.push([]);

    const footerStartRow = rows.length + 1;
    rows.push([
      "Jonggol, " + format(new Date(), "dd MMMM yyyy", { locale: idLocale }),
    ]);
    rows.push([]);
    rows.push(["Yang Membuat", "", "", "", "", "", "Yang Mengetahui"]);
    rows.push([]);
    rows.push([]);
    rows.push([]);
    rows.push([]);
    rows.push([
      `(${employeeName})`,
      "",
      "",
      "",
      "",
      "",
      "( Atasan / Supervisor )",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merges configuration
    const merges = [
      // Title
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      // Description header
      { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },
      // Table Header Row 1 (r:7)
      { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }, // Hari/Tanggal
      { s: { r: 7, c: 1 }, e: { r: 8, c: 3 } }, // Uraian Tugas
      { s: { r: 7, c: 4 }, e: { r: 7, c: 5 } }, // Pemberi Tugas
      { s: { r: 7, c: 6 }, e: { r: 8, c: 6 } }, // Target Selesai
      { s: { r: 7, c: 7 }, e: { r: 8, c: 7 } }, // Out Put
    ];

    // Data row merges (Uraian Tugas spans columns 1 to 3)
    const endDataRowIdx = dataStartRow + (tasks?.length || 1) - 1;
    for (let r = dataStartRow - 1; r <= endDataRowIdx; r++) {
      merges.push({ s: { r, c: 1 }, e: { r, c: 3 } });
    }

    ws["!merges"] = merges;

    // Adjust column widths
    ws["!cols"] = [
      { wch: 25 }, // Hari/Tanggal
      { wch: 15 }, // Uraian Tugas col 1
      { wch: 15 }, // Uraian Tugas col 2
      { wch: 15 }, // Uraian Tugas col 3
      { wch: 10 }, // Atasan
      { wch: 10 }, // Meeting
      { wch: 20 }, // Target Selesai
      { wch: 20 }, // Out Put
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Log book meeting");
  } else {
    // === LOG BOOK HARIAN ===
    let logsQ = supabase
      .from("tracker_logs")
      .select(
        "id, logged_date, duration_minutes, note, start_time, end_time, is_validated, remarks, tasks(title, status)",
      )
      .gte("logged_date", input.periodStart)
      .lte("logged_date", input.periodEnd)
      .order("logged_date", { ascending: true });

    if (input.userId) {
      logsQ = logsQ.eq("user_id", input.userId);
    }
    const { data: logs, error } = await logsQ;
    if (error) throw error;

    const rows: unknown[][] = [];

    // Headers
    rows.push(["LOG BOOK KEGIATAN HARIAN"]);
    rows.push([]);
    rows.push(["Nama", ":", employeeName]);
    rows.push(["Divisi", ":", employeePosition]);
    rows.push(["Bulan", ":", monthName, "", "Tahun", ":", yearName]);
    rows.push([]);
    rows.push([
      "Hari / Tanggal",
      "Jam",
      "", // Merged for Jam
      "Implementasi Kegiatan",
      "Status",
      "", // Merged for Status
      "Validasi Atasan",
      "Keterangan",
    ]);
    rows.push(["", "", "", "", "On Progres", "Selesai", "", ""]);

    interface LogItem {
      logged_date: string;
      start_time: string | null;
      end_time: string | null;
      note: string | null;
      is_validated: boolean | null;
      remarks: string | null;
      tasks: { title: string; status: string } | null;
    }

    const dataStartRow = 9;
    if (logs && logs.length > 0) {
      logs.forEach((logItem) => {
        const l = logItem as unknown as LogItem;
        const logDate = new Date(l.logged_date);
        const dayDateStr = format(logDate, "EEEE, dd MMMM yyyy", {
          locale: idLocale,
        });
        const timeStr = `${l.start_time ?? "08:00"} - ${l.end_time ?? "17:00"}`;
        const activityStr = [l.tasks?.title, l.note]
          .filter(Boolean)
          .join(" - ");

        const isDone = l.tasks?.status === "done";
        const isOnProgress = !isDone;

        const progressCheck = isOnProgress ? "V" : "";
        const doneCheck = isDone ? "V" : "";
        const validatedStr = l.is_validated ? "Disetujui" : "Belum";
        const remarksStr = l.remarks ?? "-";

        rows.push([
          dayDateStr,
          timeStr,
          "", // Spanned
          activityStr,
          progressCheck,
          doneCheck,
          validatedStr,
          remarksStr,
        ]);
      });
    } else {
      rows.push([
        "Tidak ada data kegiatan harian untuk periode ini",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    }

    // Add spacing rows
    rows.push([]);
    rows.push([]);

    const footerStartRow = rows.length + 1;
    rows.push([
      "Jonggol, " + format(new Date(), "dd MMMM yyyy", { locale: idLocale }),
    ]);
    rows.push([]);
    rows.push(["Yang Membuat", "", "", "", "", "", "Yang Mengetahui"]);
    rows.push([]);
    rows.push([]);
    rows.push([]);
    rows.push([]);
    rows.push([
      `(${employeeName})`,
      "",
      "",
      "",
      "",
      "",
      "( Atasan / Supervisor )",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merges
    const merges = [
      // Title
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      // Table Header Row 1 (r:6)
      { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // Hari/Tanggal
      { s: { r: 6, c: 1 }, e: { r: 7, c: 2 } }, // Jam
      { s: { r: 6, c: 3 }, e: { r: 7, c: 3 } }, // Implementasi Kegiatan
      { s: { r: 6, c: 4 }, e: { r: 6, c: 5 } }, // Status
      { s: { r: 6, c: 6 }, e: { r: 7, c: 6 } }, // Validasi Atasan
      { s: { r: 6, c: 7 }, e: { r: 7, c: 7 } }, // Keterangan
    ];

    // Data row merges (Jam spans columns 1 to 2)
    const endDataRowIdx = dataStartRow + (logs?.length || 1) - 1;
    for (let r = dataStartRow - 1; r <= endDataRowIdx; r++) {
      merges.push({ s: { r, c: 1 }, e: { r, c: 2 } });
    }

    ws["!merges"] = merges;

    // Adjust column widths
    ws["!cols"] = [
      { wch: 25 }, // Hari/Tanggal
      { wch: 15 }, // Jam col 1
      { wch: 10 }, // Jam col 2
      { wch: 35 }, // Implementasi Kegiatan
      { wch: 12 }, // On Progres
      { wch: 10 }, // Selesai
      { wch: 18 }, // Validasi Atasan
      { wch: 20 }, // Keterangan
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Log book harian");
  }

  // Write sheet to array buffer
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
