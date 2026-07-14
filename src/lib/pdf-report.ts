// ponytail: Mengganti query Supabase client-side di pdf-report.ts dengan parameter data murni yang sudah di-fetch oleh Server Function
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { TASK_STATUS_LABEL, TASK_PRIORITY_LABEL } from "@/lib/tasks";
import { formatDuration } from "@/lib/tracker";

export interface ReportInput {
  title: string;
  periodStart: string; // ISO date
  periodEnd: string;
  userId?: string | null;
  generatedByName: string;
  reportType?: "standard" | "meeting" | "harian";
}

export async function generateReportPdf(
  input: ReportInput,
  data: {
    cfg: any;
    position: string;
    tasks: any[];
    logs: any[];
  }
): Promise<Blob> {
  const cfg = data.cfg;
  const orientation =
    cfg?.pdfOrientation === "landscape" ? "landscape" : "portrait";
  const paper = (cfg?.pdfPaperSize ?? "A4").toLowerCase();
  const marginMm = Math.max(
    5,
    Math.min(50, parseInt(cfg?.pdfMargin ?? "20", 10) || 20),
  );

  const employeePosition = data.position || "Staf";

  if (input.reportType === "meeting") {
    return generateMeetingPdf(
      input,
      data.tasks,
      employeePosition,
      paper,
      orientation,
      marginMm,
      cfg?.pdfFooterText || "",
    );
  } else if (input.reportType === "harian") {
    return generateHarianPdf(
      input,
      data.logs,
      employeePosition,
      paper,
      orientation,
      marginMm,
      cfg?.pdfFooterText || "",
    );
  }

  // --- STANDARD REPORT ---
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });

  // Header
  const pageW = doc.internal.pageSize.getWidth();
  const startY = marginMm;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Log Book", marginMm, startY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (cfg?.pdfHeaderText) {
    doc.text(cfg.pdfHeaderText, pageW - marginMm, startY, { align: "right" });
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(input.title, marginMm, startY + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const periodText = `Periode: ${format(new Date(input.periodStart), "d MMM yyyy", { locale: idLocale })} — ${format(new Date(input.periodEnd), "d MMM yyyy", { locale: idLocale })}`;
  doc.text(periodText, marginMm, startY + 16);
  doc.text(
    `Dibuat oleh: ${input.generatedByName} • ${format(new Date(), "d MMM yyyy HH:mm", { locale: idLocale })}`,
    marginMm,
    startY + 21,
  );
  doc.setTextColor(0);

  // Summary
  const total = data.tasks?.length ?? 0;
  const done = data.tasks?.filter((t) => t.status === "done").length ?? 0;
  const inProg = data.tasks?.filter((t) => t.status === "in_progress").length ?? 0;
  const todo = data.tasks?.filter((t) => t.status === "todo").length ?? 0;
  const totalMin = (data.logs ?? []).reduce(
    (s, l) => s + (l.durationMinutes ?? 0),
    0,
  );

  autoTable(doc, {
    startY: startY + 26,
    head: [
      [
        "Total Tugas",
        "Selesai",
        "Sedang Dikerjakan",
        "Belum Dikerjakan",
        "Total Waktu",
      ],
    ],
    body: [
      [
        String(total),
        String(done),
        String(inProg),
        String(todo),
        formatDuration(totalMin),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: marginMm, right: marginMm },
  });

  // Tasks table
  const nextY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Daftar Tugas", marginMm, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [["#", "Judul", "Status", "Prioritas", "Deadline", "Selesai"]],
    body: (data.tasks ?? []).map((t, i) => [
      String(i + 1),
      t.title,
      TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL] || t.status,
      TASK_PRIORITY_LABEL[t.priority as keyof typeof TASK_PRIORITY_LABEL] || t.priority,
      t.dueDate
        ? format(new Date(t.dueDate), "d MMM yyyy", { locale: idLocale })
        : "—",
      t.completedAt
        ? format(new Date(t.completedAt), "d MMM yyyy", { locale: idLocale })
        : "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: marginMm, right: marginMm },
  });

  // Time logs
  const y2 =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Log Waktu", marginMm, y2);

  autoTable(doc, {
    startY: y2 + 3,
    head: [["Tanggal", "Durasi", "Catatan"]],
    body: (data.logs ?? []).map((l) => [
      format(new Date(l.loggedDate), "d MMM yyyy", { locale: idLocale }),
      formatDuration(l.durationMinutes),
      l.note ?? "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: marginMm, right: marginMm },
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const footerText = cfg?.pdfFooterText ?? "";
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    const pageH = doc.internal.pageSize.getHeight();
    if (footerText) doc.text(footerText, marginMm, pageH - 6);
    doc.text(`Hal. ${i}/${pages}`, pageW - marginMm, pageH - 6, {
      align: "right",
    });
  }

  return doc.output("blob");
}

function generateMeetingPdf(
  input: ReportInput,
  tasks: any[],
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const pageW = doc.internal.pageSize.getWidth();

  const dateStart = new Date(input.periodStart);
  const monthName = format(dateStart, "MMMM", { locale: idLocale });
  const yearName = format(dateStart, "yyyy", { locale: idLocale });

  // 1. Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LOG BOOK MEETING", pageW / 2, marginMm + 5, { align: "center" });

  // 2. Metadata Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const metadataY = marginMm + 15;
  doc.text(
    `Nama               : ${input.generatedByName}`,
    marginMm,
    metadataY,
  );
  doc.text(`Divisi               : ${position}`, marginMm, metadataY + 5);
  doc.text(
    `Bulan/Tahun    : ${monthName} ${yearName}`,
    marginMm,
    metadataY + 10,
  );

  // Subheading
  doc.setFont("helvetica", "bold");
  doc.text("PENUGASAN ATASAN/HASIL MEETING/.......", marginMm, metadataY + 18);

  // Table
  autoTable(doc, {
    startY: metadataY + 22,
    head: [
      [
        "Hari / Tanggal",
        "Uraian Tugas",
        "Pemberi Tugas",
        "Target Selesai",
        "Out Put",
      ],
    ],
    body: (tasks ?? []).map((t) => {
      const dayDateStr = format(new Date(t.createdAt), "EEEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const descStr = [t.title, t.description].filter(Boolean).join("\n");
      const sourceStr = t.taskSource === "meeting" ? "Meeting" : "Atasan";
      const targetStr = t.dueDate
        ? format(new Date(t.dueDate), "dd MMMM yyyy", { locale: idLocale })
        : "—";
      const outputStr = t.outputDescription ?? "—";
      return [dayDateStr, descStr, sourceStr, targetStr, outputStr];
    }),
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: marginMm, right: marginMm },
  });

  // Footer and Signatures on the last page
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  const pageH = doc.internal.pageSize.getHeight();

  // Signature section space check (needs ~40mm)
  let sigY = finalY + 10;
  if (sigY + 35 > pageH) {
    doc.addPage();
    sigY = marginMm + 10;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Jonggol, ${format(new Date(), "dd MMMM yyyy", { locale: idLocale })}`,
    marginMm,
    sigY,
  );

  doc.text("Yang Membuat", marginMm, sigY + 8);
  doc.text("Yang Mengetahui", pageW - marginMm - 40, sigY + 8);

  doc.text(`( ${input.generatedByName} )`, marginMm, sigY + 30);
  doc.text("( Atasan / Supervisor )", pageW - marginMm - 40, sigY + 30);

  // Global page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    if (footerText) doc.text(footerText, marginMm, pageH - 6);
    doc.text(`Hal. ${i}/${pages}`, pageW - marginMm, pageH - 6, {
      align: "right",
    });
  }

  return doc.output("blob");
}

function generateHarianPdf(
  input: ReportInput,
  logs: any[],
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const pageW = doc.internal.pageSize.getWidth();

  const dateStart = new Date(input.periodStart);
  const monthName = format(dateStart, "MMMM", { locale: idLocale });
  const yearName = format(dateStart, "yyyy", { locale: idLocale });

  // 1. Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LOG BOOK KEGIATAN HARIAN", pageW / 2, marginMm + 5, {
    align: "center",
  });

  // 2. Metadata Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const metadataY = marginMm + 15;
  doc.text(`Nama    : ${input.generatedByName}`, marginMm, metadataY);
  doc.text(`Divisi    : ${position}`, marginMm, metadataY + 5);
  doc.text(
    `Bulan    : ${monthName}                       Tahun: ${yearName}`,
    marginMm,
    metadataY + 10,
  );

  // Table
  autoTable(doc, {
    startY: metadataY + 18,
    head: [
      [
        "Hari / Tanggal",
        "Jam",
        "Implementasi Kegiatan",
        "Status",
        "Validasi Atasan",
        "Keterangan",
      ],
    ],
    body: (logs ?? []).map((l) => {
      const dayDateStr = format(new Date(l.loggedDate), "EEEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
      const activityStr = [l.task?.title, l.note].filter(Boolean).join(" - ");
      const statusStr = l.task?.status === "done" ? "Selesai" : "On Progres";
      const validatedStr = l.isValidated ? "Disetujui" : "Belum";
      const remarksStr = l.remarks ?? "—";
      return [
        dayDateStr,
        timeStr,
        activityStr,
        statusStr,
        validatedStr,
        remarksStr,
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: marginMm, right: marginMm },
  });

  // Footer and Signatures on the last page
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  const pageH = doc.internal.pageSize.getHeight();

  // Signature space check
  let sigY = finalY + 10;
  if (sigY + 35 > pageH) {
    doc.addPage();
    sigY = marginMm + 10;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Jonggol, ${format(new Date(), "dd MMMM yyyy", { locale: idLocale })}`,
    marginMm,
    sigY,
  );

  doc.text("Yang Membuat", marginMm, sigY + 8);
  doc.text("Yang Mengetahui", pageW - marginMm - 40, sigY + 8);

  doc.text(`( ${input.generatedByName} )`, marginMm, sigY + 30);
  doc.text("( Atasan / Supervisor )", pageW - marginMm - 40, sigY + 30);

  // Global page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    if (footerText) doc.text(footerText, marginMm, pageH - 6);
    doc.text(`Hal. ${i}/${pages}`, pageW - marginMm, pageH - 6, {
      align: "right",
    });
  }

  return doc.output("blob");
}
