// ponytail: Mengganti tipe Supabase Database dengan tipe interface biasa untuk menyingkirkan Supabase (YAGNI)
export interface TrackerLogRow {
  id: string;
  userId: string;
  taskId?: string | null;
  durationMinutes: number;
  loggedDate: string;
  note?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isValidated?: boolean | null;
  remarks?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function formatDuration(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
