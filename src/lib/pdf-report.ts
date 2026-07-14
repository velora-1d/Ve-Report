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
  checkerName?: string | null;
  makerSigImg?: string | null;
  makerSigScale?: number;
  makerSigOffsetX?: number;
  makerSigOffsetY?: number;
  checkerSigImg?: string | null;
  checkerSigScale?: number;
  checkerSigOffsetX?: number;
  checkerSigOffsetY?: number;
}

function drawAestheticCheckmark(doc: jsPDF, cellData: any, colorRgb: [number, number, number] = [59, 130, 246]) {
  if (cellData.cell.text[0] === "✓") {
    cellData.cell.text = [""];
    const x = cellData.cell.x + cellData.cell.width / 2;
    const y = cellData.cell.y + cellData.cell.height / 2;
    doc.setDrawColor(colorRgb[0], colorRgb[1], colorRgb[2]);
    doc.setLineWidth(0.5);
    doc.line(x - 1.8, y - 0.2, x - 0.3, y + 1.3);
    doc.line(x - 0.3, y + 1.3, x + 2.0, y - 1.5);
  }
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
  const isLogbook = input.reportType === "meeting" || input.reportType === "harian";
  const defaultMargin = isLogbook ? 10 : 20;
  const marginMm = Math.max(
    5,
    Math.min(50, parseInt(cfg?.pdfMargin ?? String(defaultMargin), 10) || defaultMargin),
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

// ponytail: Mengubah desain PDF Log Book Meeting agar persis dengan template Excel yang diminta (split header, kotak info, tandatangan, dan abu-abu)
function generateMeetingPdf(
  input: ReportInput,
  tasks: any[],
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Blob {
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const pageW = doc.internal.pageSize.getWidth();

  const dateStart = new Date(input.periodStart);
  const monthName = format(dateStart, "MMMM", { locale: idLocale });
  const yearName = format(dateStart, "yyyy", { locale: idLocale });

  // 1. Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LOG BOOK MEETING", pageW / 2, marginMm + 5, { align: "center" });

  // 2. Metadata Info Box
  const metadataY = marginMm + 15;
  const boxW = pageW - (marginMm * 2);
  doc.rect(marginMm, metadataY - 3, boxW, 18);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Nama", marginMm + 3, metadataY + 2);
  doc.text("Divisi", marginMm + 3, metadataY + 7);
  doc.text("Bulan dan Tahun", marginMm + 3, metadataY + 12);
  
  doc.setFont("helvetica", "normal");
  doc.text(`: ${input.generatedByName}`, marginMm + 35, metadataY + 2);
  doc.text(`: ${position}`, marginMm + 35, metadataY + 7);
  doc.text(`: ${monthName} ${yearName}`, marginMm + 35, metadataY + 12);

  // Subheading
  doc.setFont("helvetica", "bold");
  doc.text("PENUGASAN ATASAN/HASIL MEETING/.......", marginMm, metadataY + 20);

  // Table
  autoTable(doc, {
    startY: metadataY + 24,
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Hari / Tanggal", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Uraian Tugas", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Pemberi Tugas", colSpan: 2, styles: { halign: "center" } },
        { content: "Target Selesai", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Out Put", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Atasan", styles: { halign: "center" } },
        { content: "Meeting", styles: { halign: "center" } },
      ]
    ],
    body: (tasks ?? []).map((t, index) => {
      const dayDateStr = format(new Date(t.createdAt), "EEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const descStr = [t.title, t.description].filter(Boolean).join("\n");
      
      const sourceLower = (t.taskSource ?? "").toLowerCase();
      const isMeeting = sourceLower.includes("meeting") || sourceLower.includes("rapat");
      const atasanCheck = !isMeeting ? "✓" : "";
      const meetingCheck = isMeeting ? "✓" : "";

      const targetStr = t.dueDate
        ? format(new Date(t.dueDate), "dd MMMM yyyy", { locale: idLocale })
        : "—";
      const outputStr = t.outputDescription ?? "—";
      return [String(index + 1), dayDateStr, descStr, atasanCheck, meetingCheck, targetStr, outputStr];
    }),
    theme: "grid",
    headStyles: { fillColor: [218, 222, 229], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.1 },
    bodyStyles: { fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 35 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 30, halign: "center" },
      6: { cellWidth: 30 },
    },
    margin: { left: marginMm, right: marginMm },
    didDrawCell: (cellData) => {
      if (cellData.row.section === "body" && (cellData.column.index === 3 || cellData.column.index === 4)) {
        drawAestheticCheckmark(doc, cellData, [59, 130, 246]);
      }
    },
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

  const sigLeftX = marginMm + 30;
  const sigRightX = pageW - marginMm - 30;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Jonggol, ${format(new Date(), "dd MMMM yyyy", { locale: idLocale })}`,
    sigLeftX,
    sigY,
    { align: "center" }
  );

  const formatSig = (name: string | null | undefined, fallback: string) => {
    if (!name) return fallback;
    const clean = name.trim();
    if (clean.startsWith("(") && clean.endsWith(")")) return clean;
    return `( ${clean} )`;
  };

  doc.text("Yang Membuat", sigLeftX, sigY + 6, { align: "center" });
  doc.text("Yang Mengetahui", sigRightX, sigY + 6, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.text(formatSig(input.generatedByName, `( ${input.generatedByName} )`), sigLeftX, sigY + 28, { align: "center" });
  
  const hasChecker = !!input.checkerName && input.checkerName.trim() !== "" && !input.checkerName.includes("...");
  if (hasChecker) {
    doc.setFont("helvetica", "bold");
  } else {
    doc.setFont("helvetica", "normal");
  }
  doc.text(formatSig(input.checkerName, "( .................................... )"), sigRightX, sigY + 28, { align: "center" });
  doc.setFont("helvetica", "normal");

  // Draw signature images if provided
  if (input.makerSigImg) {
    try {
      const scale = input.makerSigScale ?? 100;
      const imgW = 30 * (scale / 100);
      const imgH = 15 * (scale / 100);
      const imgX = sigLeftX - imgW / 2 + (input.makerSigOffsetX ?? 0);
      const imgY = sigY + 17 - imgH / 2 + (input.makerSigOffsetY ?? 0);
      doc.addImage(input.makerSigImg, "PNG", imgX, imgY, imgW, imgH);
    } catch (e) {
      console.error("Error drawing maker signature in PDF:", e);
    }
  }

  if (input.checkerSigImg) {
    try {
      const scale = input.checkerSigScale ?? 100;
      const imgW = 30 * (scale / 100);
      const imgH = 15 * (scale / 100);
      const imgX = sigRightX - imgW / 2 + (input.checkerSigOffsetX ?? 0);
      const imgY = sigY + 17 - imgH / 2 + (input.checkerSigOffsetY ?? 0);
      doc.addImage(input.checkerSigImg, "PNG", imgX, imgY, imgW, imgH);
    } catch (e) {
      console.error("Error drawing checker signature in PDF:", e);
    }
  }

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

// ponytail: Mengubah desain PDF Log Book Harian agar persis dengan template Excel yang diminta (split header status, kotak info, tandatangan, dan abu-abu)
function generateHarianPdf(
  input: ReportInput,
  logs: any[],
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Blob {
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

  // 2. Metadata Info Box (2 rows)
  const metadataY = marginMm + 15;
  const boxW = pageW - (marginMm * 2);
  doc.rect(marginMm, metadataY - 3, boxW, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  // Row 1: Nama & Divisi
  doc.text("Nama", marginMm + 3, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${input.generatedByName}`, marginMm + 20, metadataY + 2);

  doc.setFont("helvetica", "bold");
  doc.text("Divisi", marginMm + 100, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${position}`, marginMm + 115, metadataY + 2);

  // Row 2: Bulan & Tahun
  doc.setFont("helvetica", "bold");
  doc.text("Bulan", marginMm + 3, metadataY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${monthName}`, marginMm + 20, metadataY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Tahun", marginMm + 100, metadataY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${yearName}`, marginMm + 115, metadataY + 7);

  // Table
  autoTable(doc, {
    startY: metadataY + 15,
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Hari / Tanggal", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Jam", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Implementasi Kegiatan", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Status", colSpan: 2, styles: { halign: "center" } },
        { content: "Validasi Atasan", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Keterangan", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "On Progres", styles: { halign: "center" } },
        { content: "Selesai", styles: { halign: "center" } },
      ]
    ],
    body: (logs ?? []).map((l, index) => {
      const dayDateStr = format(new Date(l.loggedDate), "EEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
      const activityStr = [l.task?.title, l.note].filter(Boolean).join(" - ");
      
      const isDone = l.status === "Selesai" || l.status === "selesai" || l.task?.status === "done";
      const onProgresCheck = !isDone ? "✓" : "";
      const selesaiCheck = isDone ? "✓" : "";
      
      const validatedStr = l.isValidated ? "✓" : "";
      const remarksStr = l.remarks ?? "—";
      return [
        String(index + 1),
        dayDateStr,
        timeStr,
        activityStr,
        onProgresCheck,
        selesaiCheck,
        validatedStr,
        remarksStr,
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [218, 222, 229], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.1 },
    bodyStyles: { fontSize: 8.5, lineColor: [180, 180, 180], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 35 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 25 },
    },
    margin: { left: marginMm, right: marginMm },
    didDrawCell: (cellData) => {
      if (cellData.row.section === "body" && (cellData.column.index === 4 || cellData.column.index === 5 || cellData.column.index === 6)) {
        let color: [number, number, number] = [59, 130, 246];
        if (cellData.column.index === 4) {
          color = [245, 158, 11];
        } else if (cellData.column.index === 5) {
          color = [16, 185, 129];
        }
        drawAestheticCheckmark(doc, cellData, color);
      }
    },
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

  const sigLeftX = marginMm + 30;
  const sigRightX = pageW - marginMm - 30;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Jonggol, ${format(new Date(), "dd MMMM yyyy", { locale: idLocale })}`,
    sigLeftX,
    sigY,
    { align: "center" }
  );

  const formatSig = (name: string | null | undefined, fallback: string) => {
    if (!name) return fallback;
    const clean = name.trim();
    if (clean.startsWith("(") && clean.endsWith(")")) return clean;
    return `( ${clean} )`;
  };

  doc.text("Yang Membuat", sigLeftX, sigY + 6, { align: "center" });
  doc.text("Yang Mengetahui", sigRightX, sigY + 6, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.text(formatSig(input.generatedByName, `( ${input.generatedByName} )`), sigLeftX, sigY + 28, { align: "center" });
  
  const hasChecker = !!input.checkerName && input.checkerName.trim() !== "" && !input.checkerName.includes("...");
  if (hasChecker) {
    doc.setFont("helvetica", "bold");
  } else {
    doc.setFont("helvetica", "normal");
  }
  doc.text(formatSig(input.checkerName, "( .................................... )"), sigRightX, sigY + 28, { align: "center" });
  doc.setFont("helvetica", "normal");

  // Draw signature images if provided
  if (input.makerSigImg) {
    try {
      const scale = input.makerSigScale ?? 100;
      const imgW = 30 * (scale / 100);
      const imgH = 15 * (scale / 100);
      const imgX = sigLeftX - imgW / 2 + (input.makerSigOffsetX ?? 0);
      const imgY = sigY + 17 - imgH / 2 + (input.makerSigOffsetY ?? 0);
      doc.addImage(input.makerSigImg, "PNG", imgX, imgY, imgW, imgH);
    } catch (e) {
      console.error("Error drawing maker signature in PDF:", e);
    }
  }

  if (input.checkerSigImg) {
    try {
      const scale = input.checkerSigScale ?? 100;
      const imgW = 30 * (scale / 100);
      const imgH = 15 * (scale / 100);
      const imgX = sigRightX - imgW / 2 + (input.checkerSigOffsetX ?? 0);
      const imgY = sigY + 17 - imgH / 2 + (input.checkerSigOffsetY ?? 0);
      doc.addImage(input.checkerSigImg, "PNG", imgX, imgY, imgW, imgH);
    } catch (e) {
      console.error("Error drawing checker signature in PDF:", e);
    }
  }

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
