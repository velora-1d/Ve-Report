// ponytail: Mengganti query Supabase client-side di pdf-report.ts dengan parameter data murni yang sudah di-fetch oleh Server Function
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { TASK_STATUS_LABEL, TASK_PRIORITY_LABEL } from "@/lib/tasks";
import { formatDuration } from "@/lib/tracker";

async function addWatermarkToAllPages(doc: jsPDF, watermarkUrl: string) {
  try {
    const response = await fetch(watermarkUrl);
    const blob = await response.blob();
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const base64Png = canvas.toDataURL("image/png");

    const pageCount = doc.getNumberOfPages();
    const imgAspect = img.height / img.width;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const w = pageW * 0.5;
      const h = w * imgAspect;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      doc.saveGraphicsState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gState = new (doc as any).GState({ opacity: 0.12 });
      doc.setGState(gState);
      doc.addImage(base64Png, "PNG", x, y, w, h);
      doc.restoreGraphicsState();
    }
  } catch (err) {
    console.error("Failed to add watermark to PDF:", err);
  }
}

export interface ReportInput {
  title: string;
  periodStart: string; // ISO date
  periodEnd: string;
  userId?: string | null;
  generatedByName: string;
  reportType?: "standard" | "meeting" | "harian";
  checkerName?: string | null;
  divisionName?: string | null;
  makerSigImg?: string | null;
  makerSigScale?: number;
  makerSigOffsetX?: number;
  makerSigOffsetY?: number;
  checkerSigImg?: string | null;
  checkerSigScale?: number;
  checkerSigOffsetX?: number;
  checkerSigOffsetY?: number;
}

interface CellData {
  cell: {
    text: string[];
    x: number;
    y: number;
    width: number;
    height: number;
  };
  column: {
    index: number;
  };
  row: {
    section: string;
  };
}

function drawAestheticCheckmark(
  doc: jsPDF,
  cellData: CellData,
  colorRgb: [number, number, number] = [59, 130, 246],
) {
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

export interface TaskReportItem {
  id?: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string | Date;
  completedAt?: string | Date | null;
  dueDate?: string | Date | null;
  description?: string | null;
  taskSource?: string | null;
  outputDescription?: string | null;
}

export interface LogReportItem {
  id: string;
  loggedDate: string | Date;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  status?: string | null;
  durationMinutes?: number | null;
  isValidated?: boolean | null;
  remarks?: string | null;
  task?: { title: string; status: string } | null;
}

export interface PdfConfig {
  pdfMargin?: string | null;
  pdfOrientation?: string | null;
  logoUrl?: string | null;
  pdfPaperSize?: string | null;
  pdfHeaderText?: string | null;
  pdfFooterText?: string | null;
  appName?: string | null;
}

export async function generateReportPdf(
  input: ReportInput,
  data: {
    cfg: PdfConfig | null;
    position: string;
    tasks: TaskReportItem[];
    logs: LogReportItem[];
  },
): Promise<Blob> {
  const cfg = data.cfg;
  const orientation =
    cfg?.pdfOrientation === "landscape" ? "landscape" : "portrait";
  const paper = (cfg?.pdfPaperSize ?? "A4").toLowerCase();
  const isLogbook =
    input.reportType === "meeting" || input.reportType === "harian";
  const defaultMargin = isLogbook ? 10 : 20;
  const marginMm = Math.max(
    5,
    Math.min(
      50,
      parseInt(cfg?.pdfMargin ?? String(defaultMargin), 10) || defaultMargin,
    ),
  );

  const employeePosition = data.position || "Staf";

  if (input.reportType === "meeting") {
    return await generateMeetingPdf(
      input,
      data.tasks,
      employeePosition,
      paper,
      orientation,
      marginMm,
      cfg?.pdfFooterText || "",
    );
  } else if (input.reportType === "harian") {
    return await generateHarianPdf(
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
  const inProg =
    data.tasks?.filter((t) => t.status === "in_progress").length ?? 0;
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
      TASK_PRIORITY_LABEL[t.priority as keyof typeof TASK_PRIORITY_LABEL] ||
        t.priority,
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

  await addWatermarkToAllPages(doc, "/watermark.webp");
  return doc.output("blob");
}

// ponytail: Mengubah desain PDF Log Book Meeting agar persis dengan template Excel yang diminta (split header, kotak info, tandatangan, dan abu-abu)
async function generateMeetingPdf(
  input: ReportInput,
  tasks: TaskReportItem[],
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
  doc.setTextColor(0, 119, 182); // Brand color #0077B6
  doc.text("LOG BOOK MEETING", pageW / 2, marginMm + 5, { align: "center" });

  // Decorative underline below title
  doc.setDrawColor(0, 119, 182);
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - 20, marginMm + 7, pageW / 2 + 20, marginMm + 7);
  doc.setTextColor(0, 0, 0); // reset color

  // 2. Metadata Info Box (2 rows)
  const metadataY = marginMm + 16;
  const boxW = pageW - marginMm * 2;

  // Draw card background
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(marginMm, metadataY - 3, boxW, 14, "F");

  // Draw blue accent bar on the left
  doc.setFillColor(0, 119, 182);
  doc.rect(marginMm, metadataY - 3, 2.5, 14, "F");

  // Draw card border
  doc.setDrawColor(148, 163, 184); // Slate 400
  doc.setLineWidth(0.3);
  doc.rect(marginMm, metadataY - 3, boxW, 14, "D");

  doc.setFontSize(9.5);
  // Row 1: Nama & Divisi
  doc.setFont("helvetica", "bold");
  doc.text("Nama", marginMm + 6, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${input.generatedByName}`, marginMm + 22, metadataY + 2);

  doc.setFont("helvetica", "bold");
  doc.text("Divisi", marginMm + 100, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(
    `: ${input.divisionName || position || "—"}`,
    marginMm + 115,
    metadataY + 2,
  );

  // Row 2: Bulan & Tahun
  doc.setFont("helvetica", "bold");
  doc.text("Bulan", marginMm + 6, metadataY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${monthName}`, marginMm + 22, metadataY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Tahun", marginMm + 100, metadataY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${yearName}`, marginMm + 115, metadataY + 8);

  // Subheading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 119, 182); // Brand color #0077B6
  doc.text("DAFTAR PENUGASAN / HASIL MEETING", marginMm, metadataY + 20);
  doc.setTextColor(0, 0, 0); // reset color

  // Table
  autoTable(doc, {
    startY: doc.getNumberOfPages() === 1 ? metadataY + 24 : marginMm + 24,
    head: [
      [
        {
          content: "No",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Hari / Tanggal",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Uraian Tugas",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        { content: "Pemberi Tugas", colSpan: 2, styles: { halign: "center" } },
        {
          content: "Target Selesai",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Out Put",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
      ],
      [
        { content: "Atasan", styles: { halign: "center" } },
        { content: "Meeting", styles: { halign: "center" } },
      ],
    ],
    body:
      (tasks ?? []).length === 0
        ? Array.from({ length: 5 }).map((_, index) => [
            String(index + 1), // No
            "", // Hari / Tanggal
            "", // Uraian Tugas
            "", // Atasan
            "", // Meeting
            "", // Target Selesai
            "", // Out Put
          ])
        : (tasks ?? []).map((t, index) => {
            const dayDateStr = format(
              new Date(t.createdAt),
              "EEE, dd MMMM yyyy",
              {
                locale: idLocale,
              },
            );
            const descStr = [t.title, t.description].filter(Boolean).join("\n");

            const sourceLower = (t.taskSource ?? "").toLowerCase();
            const isMeeting =
              sourceLower.includes("meeting") || sourceLower.includes("rapat");
            const atasanCheck = !isMeeting ? "✓" : "";
            const meetingCheck = isMeeting ? "✓" : "";

            const targetStr = t.dueDate
              ? format(new Date(t.dueDate), "dd MMMM yyyy", {
                  locale: idLocale,
                })
              : "—";
            const outputStr = t.outputDescription ?? "—";
            return [
              String(index + 1),
              dayDateStr,
              descStr,
              atasanCheck,
              meetingCheck,
              targetStr,
              outputStr,
            ];
          }),
    theme: "grid",
    headStyles: {
      fillColor: [0, 119, 182],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [148, 163, 184],
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8.5,
      lineColor: [148, 163, 184],
      lineWidth: 0.3,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
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
      if (
        cellData.row.section === "body" &&
        (cellData.column.index === 3 || cellData.column.index === 4)
      ) {
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
    { align: "center" },
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
  doc.text(
    formatSig(input.generatedByName, `( ${input.generatedByName} )`),
    sigLeftX,
    sigY + 28,
    { align: "center" },
  );

  const hasChecker =
    !!input.checkerName &&
    input.checkerName.trim() !== "" &&
    !input.checkerName.includes("...");
  if (hasChecker) {
    doc.setFont("helvetica", "bold");
  } else {
    doc.setFont("helvetica", "normal");
  }
  doc.text(
    formatSig(input.checkerName, "( .................................... )"),
    sigRightX,
    sigY + 28,
    { align: "center" },
  );
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

  await addWatermarkToAllPages(doc, "/watermark.webp");
  return doc.output("blob");
}

// ponytail: Mengubah desain PDF Log Book Harian agar persis dengan template Excel yang diminta (split header status, kotak info, tandatangan, dan abu-abu)
async function generateHarianPdf(
  input: ReportInput,
  logs: LogReportItem[],
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
  doc.setTextColor(0, 119, 182); // Brand color #0077B6
  doc.text("LOG BOOK KEGIATAN HARIAN", pageW / 2, marginMm + 5, {
    align: "center",
  });

  // Decorative underline below title
  doc.setDrawColor(0, 119, 182);
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - 25, marginMm + 7, pageW / 2 + 25, marginMm + 7);
  doc.setTextColor(0, 0, 0); // reset color

  // 2. Metadata Info Box (2 rows)
  const metadataY = marginMm + 16;
  const boxW = pageW - marginMm * 2;

  // Draw card background
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(marginMm, metadataY - 3, boxW, 14, "F");

  // Draw blue accent bar on the left
  doc.setFillColor(0, 119, 182);
  doc.rect(marginMm, metadataY - 3, 2.5, 14, "F");

  // Draw card border
  doc.setDrawColor(148, 163, 184); // Slate 400
  doc.setLineWidth(0.3);
  doc.rect(marginMm, metadataY - 3, boxW, 14, "D");

  doc.setFontSize(9.5);
  // Row 1: Nama & Divisi
  doc.setFont("helvetica", "bold");
  doc.text("Nama", marginMm + 6, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${input.generatedByName}`, marginMm + 22, metadataY + 2);

  doc.setFont("helvetica", "bold");
  doc.text("Divisi", marginMm + 100, metadataY + 2);
  doc.setFont("helvetica", "normal");
  doc.text(
    `: ${input.divisionName || position || "—"}`,
    marginMm + 115,
    metadataY + 2,
  );

  // Row 2: Bulan & Tahun
  doc.setFont("helvetica", "bold");
  doc.text("Bulan", marginMm + 6, metadataY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${monthName}`, marginMm + 22, metadataY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Tahun", marginMm + 100, metadataY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(`: ${yearName}`, marginMm + 115, metadataY + 8);

  // Subheading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 119, 182); // Brand color #0077B6
  doc.text("DAFTAR KEGIATAN HARIAN", marginMm, metadataY + 20);
  doc.setTextColor(0, 0, 0); // reset color

  // Table
  autoTable(doc, {
    startY: doc.getNumberOfPages() === 1 ? metadataY + 24 : marginMm + 24,
    head: [
      [
        {
          content: "No",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Hari / Tanggal",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Jam",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Implementasi Kegiatan",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        { content: "Status", colSpan: 2, styles: { halign: "center" } },
        {
          content: "Validasi Atasan",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
        {
          content: "Keterangan",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle" },
        },
      ],
      [
        { content: "On Progres", styles: { halign: "center" } },
        { content: "Selesai", styles: { halign: "center" } },
      ],
    ],
    body:
      (logs ?? []).length === 0
        ? Array.from({ length: 5 }).map((_, index) => [
            String(index + 1), // No
            "", // Hari / Tanggal
            "", // Jam
            "", // Implementasi Kegiatan
            "", // On Progres
            "", // Selesai
            "", // Validasi Atasan
            "", // Keterangan
          ])
        : (logs ?? []).map((l, index) => {
            const dayDateStr = format(
              new Date(l.loggedDate),
              "EEE, dd MMMM yyyy",
              {
                locale: idLocale,
              },
            );
            const timeStr = `${l.startTime ?? "08:00"} - ${l.endTime ?? "17:00"}`;
            const activityStr = [l.task?.title, l.note]
              .filter(Boolean)
              .join(" - ");

            const isDone =
              l.status === "Selesai" ||
              l.status === "selesai" ||
              l.task?.status === "done";
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
    headStyles: {
      fillColor: [0, 119, 182],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [148, 163, 184],
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8.5,
      lineColor: [148, 163, 184],
      lineWidth: 0.3,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
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
      if (
        cellData.row.section === "body" &&
        (cellData.column.index === 4 ||
          cellData.column.index === 5 ||
          cellData.column.index === 6)
      ) {
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
    { align: "center" },
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
  doc.text(
    formatSig(input.generatedByName, `( ${input.generatedByName} )`),
    sigLeftX,
    sigY + 28,
    { align: "center" },
  );

  const hasChecker =
    !!input.checkerName &&
    input.checkerName.trim() !== "" &&
    !input.checkerName.includes("...");
  if (hasChecker) {
    doc.setFont("helvetica", "bold");
  } else {
    doc.setFont("helvetica", "normal");
  }
  doc.text(
    formatSig(input.checkerName, "( .................................... )"),
    sigRightX,
    sigY + 28,
    { align: "center" },
  );
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

  await addWatermarkToAllPages(doc, "/watermark.webp");
  return doc.output("blob");
}
