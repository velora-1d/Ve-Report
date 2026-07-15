// ponytail: Mengganti query Supabase client-side di excel-report.ts dengan parameter data murni yang sudah di-fetch oleh Server Function
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export interface ExcelReportInput {
  reportType: "meeting" | "harian";
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string;
  generatedByName: string;
  userPosition?: string | null;
  checkerName?: string | null;
  divisionName?: string | null;
}

export async function generateReportExcel(
  input: ExcelReportInput,
  data: {
    employeeName: string;
    employeePosition: string;
    tasks: any[];
    logs: any[];
    checkerName?: string | null;
    divisionName?: string | null;
  }
): Promise<Blob> {
  const employeeName = data.employeeName || input.generatedByName;
  const employeePosition = data.employeePosition || "Staf";
  const checkerName = data.checkerName || input.checkerName || "";

  const formatSig = (name: string, fallback: string) => {
    if (!name) return fallback;
    const clean = name.trim();
    if (clean.startsWith("(") && clean.endsWith(")")) return clean;
    return `(${clean})`;
  };
  const checkerSig = formatSig(checkerName, "( Atasan / Supervisor )");

  const dateStart = new Date(input.periodStart);
  const monthName = format(dateStart, "MMMM", { locale: idLocale });
  const yearName = format(dateStart, "yyyy", { locale: idLocale });

  const wb = XLSX.utils.book_new();

  // === LOG BOOK MEETING ===
  {
    const rows: unknown[][] = [];

    // Rows 1-5: Header & Metadata
    rows.push(["LOG BOOK MEETING"]);
    rows.push([]);
    rows.push(["Nama", ":", employeeName]);
    rows.push(["Divisi", ":", input.divisionName || data.divisionName || employeePosition]);
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
    if (data.tasks && data.tasks.length > 0) {
      data.tasks.forEach((t) => {
        const taskDate = new Date(t.createdAt);
        const dayDateStr = format(taskDate, "EEEE, dd MMMM yyyy", {
          locale: idLocale,
        });
        const descStr = [t.title, t.description].filter(Boolean).join("\n");
        const isAtasan = t.taskSource === "atasan" ? "V" : "";
        const isMeeting = t.taskSource === "meeting" ? "V" : "";
        const targetStr = t.dueDate
          ? format(new Date(t.dueDate), "dd MMMM yyyy", { locale: idLocale })
          : "-";
        const outputStr = t.outputDescription ?? "-";

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
      checkerSig,
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
    const endDataRowIdx = dataStartRow + (data.tasks?.length || 1) - 1;
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
  }

  // === LOG BOOK HARIAN ===
  {
    const rows: unknown[][] = [];

    // Headers
    rows.push(["LOG BOOK KEGIATAN HARIAN"]);
    rows.push([]);
    rows.push(["Nama", ":", employeeName]);
    rows.push(["Divisi", ":", input.divisionName || data.divisionName || employeePosition]);
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

    const dataStartRow = 9;
    if (data.logs && data.logs.length > 0) {
      data.logs.forEach((l) => {
        const logDate = new Date(l.loggedDate);
        const dayDateStr = format(logDate, "EEEE, dd MMMM yyyy", {
          locale: idLocale,
        });
        const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
        const activityStr = l.note || l.task?.title || "-";

        const isDone = l.status === "done";
        const isOnProgress = !isDone;

        const progressCheck = isOnProgress ? "V" : "";
        const doneCheck = isDone ? "V" : "";
        const validatedStr = l.isValidated ? "Disetujui" : "Belum";
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
      checkerSig,
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
    const endDataRowIdx = dataStartRow + (data.logs?.length || 1) - 1;
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
