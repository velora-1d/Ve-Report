import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { fetchAppConfig } from "@/lib/app-config";
import { TASK_STATUS_LABEL, TASK_PRIORITY_LABEL } from "@/lib/tasks";
import { formatDuration } from "@/lib/tracker";

export interface ReportInput {
  title: string;
  periodStart: string; // ISO date
  periodEnd: string;
  userId?: string | null; // filter tugas per assigned user
  generatedByName: string;
  reportType?: "standard" | "meeting" | "harian";
}

export async function generateReportPdf(input: ReportInput): Promise<Blob> {
  const cfg = await fetchAppConfig();
  const orientation =
    cfg?.pdf_orientation === "landscape" ? "landscape" : "portrait";
  const paper = (cfg?.pdf_paper_size ?? "A4").toLowerCase();
  const marginMm = Math.max(
    5,
    Math.min(50, parseInt(cfg?.pdf_margin ?? "20", 10) || 20),
  );

  // Fetch user profile info
  let employeePosition = "Staf";
  if (input.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("position")
      .eq("id", input.userId)
      .single();
    if (profile?.position) {
      employeePosition = profile.position;
    }
  }

  if (input.reportType === "meeting") {
    return generateMeetingPdf(
      input,
      employeePosition,
      paper,
      orientation,
      marginMm,
      cfg?.pdf_footer_text || "",
    );
  } else if (input.reportType === "harian") {
    return generateHarianPdf(
      input,
      employeePosition,
      paper,
      orientation,
      marginMm,
      cfg?.pdf_footer_text || "",
    );
  }

  // --- STANDARD REPORT ---
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });

  // Fetch data
  let tasksQ = supabase
    .from("tasks")
    .select(
      "id,title,status,priority,due_date,assigned_to,completed_at,created_at",
    )
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd + "T23:59:59");
  if (input.userId) tasksQ = tasksQ.eq("assigned_to", input.userId);
  const { data: tasks, error: te } = await tasksQ;
  if (te) throw te;

  let logsQ = supabase
    .from("tracker_logs")
    .select("task_id,user_id,duration_minutes,logged_date,note")
    .gte("logged_date", input.periodStart)
    .lte("logged_date", input.periodEnd);
  if (input.userId) logsQ = logsQ.eq("user_id", input.userId);
  const { data: logs, error: le } = await logsQ;
  if (le) throw le;

  // Header
  const pageW = doc.internal.pageSize.getWidth();
  const startY = marginMm;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(cfg?.app_name ?? "VeReport", marginMm, startY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (cfg?.pdf_header_text) {
    doc.text(cfg.pdf_header_text, pageW - marginMm, startY, { align: "right" });
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
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const inProg = tasks?.filter((t) => t.status === "in_progress").length ?? 0;
  const todo = tasks?.filter((t) => t.status === "todo").length ?? 0;
  const totalMin = (logs ?? []).reduce(
    (s, l) => s + (l.duration_minutes ?? 0),
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
    body: (tasks ?? []).map((t, i) => [
      String(i + 1),
      t.title,
      TASK_STATUS_LABEL[t.status],
      TASK_PRIORITY_LABEL[t.priority],
      t.due_date
        ? format(new Date(t.due_date), "d MMM yyyy", { locale: idLocale })
        : "—",
      t.completed_at
        ? format(new Date(t.completed_at), "d MMM yyyy", { locale: idLocale })
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
    body: (logs ?? []).map((l) => [
      format(new Date(l.logged_date), "d MMM yyyy", { locale: idLocale }),
      formatDuration(l.duration_minutes),
      l.note ?? "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    margin: { left: marginMm, right: marginMm },
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const footerText = cfg?.pdf_footer_text ?? "";
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

async function generateMeetingPdf(
  input: ReportInput,
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const pageW = doc.internal.pageSize.getWidth();

  // Fetch tasks
  let tasksQ = supabase
    .from("tasks")
    .select(
      "id, title, description, created_at, due_date, task_source, output_description",
    )
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd + "T23:59:59")
    .order("created_at", { ascending: true });
  if (input.userId) tasksQ = tasksQ.eq("assigned_to", input.userId);
  const { data: tasks, error } = await tasksQ;
  if (error) throw error;

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
      const dayDateStr = format(new Date(t.created_at), "EEEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const descStr = [t.title, t.description].filter(Boolean).join("\n");
      const sourceStr = t.task_source === "meeting" ? "Meeting" : "Atasan";
      const targetStr = t.due_date
        ? format(new Date(t.due_date), "dd MMMM yyyy", { locale: idLocale })
        : "—";
      const outputStr = t.output_description ?? "—";
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

async function generateHarianPdf(
  input: ReportInput,
  position: string,
  paper: string,
  orientation: "portrait" | "landscape",
  marginMm: number,
  footerText: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation, unit: "mm", format: paper });
  const pageW = doc.internal.pageSize.getWidth();

  // Fetch log harian
  let logsQ = supabase
    .from("tracker_logs")
    .select(
      "id, logged_date, duration_minutes, note, start_time, end_time, is_validated, remarks, tasks(title, status)",
    )
    .gte("logged_date", input.periodStart)
    .lte("logged_date", input.periodEnd)
    .order("logged_date", { ascending: true });
  if (input.userId) logsQ = logsQ.eq("user_id", input.userId);
  const { data: logs, error } = await logsQ;
  if (error) throw error;

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
    body: (logs ?? []).map((logItem) => {
      const l = logItem as unknown as {
        logged_date: string;
        start_time: string | null;
        end_time: string | null;
        note: string | null;
        is_validated: boolean | null;
        remarks: string | null;
        tasks: { title: string; status: string } | null;
      };
      const dayDateStr = format(new Date(l.logged_date), "EEEE, dd MMMM yyyy", {
        locale: idLocale,
      });
      const timeStr = `${l.start_time ?? "08:00"} - ${l.end_time ?? "17:00"}`;
      const activityStr = [l.tasks?.title, l.note].filter(Boolean).join(" - ");
      const statusStr = l.tasks?.status === "done" ? "Selesai" : "On Progres";
      const validatedStr = l.is_validated ? "Disetujui" : "Belum";
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
