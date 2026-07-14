// ponytail: Mengganti tipe Supabase Database dengan tipe string literal biasa untuk menyingkirkan Supabase (YAGNI)
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string | null;
  taskSource?: string | null;
  outputDescription?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  startedAt?: string | null;
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Belum dikerjakan",
  in_progress: "Sedang dikerjakan",
  review: "Ditinjau",
  done: "Selesai",
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  urgent: "Mendesak",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
];
export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];
