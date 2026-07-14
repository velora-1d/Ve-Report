# DATABASE.md — Skema Database (Drizzle ORM + PostgreSQL)

```typescript
import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean, integer, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===== ENUMS =====
export const roleEnum = pgEnum("role", ["developer", "admin", "staff"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "review", "done"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

// ===== USERS =====
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("staff"),
  avatarUrl: text("avatar_url"),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  bio: text("bio"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== TASKS =====
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== SCHEDULE / CALENDAR =====
export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  taskId: uuid("task_id").references(() => tasks.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  reminderMinutesBefore: integer("reminder_minutes_before").default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== TRACKER LOGS =====
export const trackerLogs = pgTable("tracker_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  note: text("note"),
  durationMinutes: integer("duration_minutes"),
  loggedDate: date("logged_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== REPORTS =====
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  filterUserId: uuid("filter_user_id").references(() => users.id),
  pdfUrl: text("pdf_url"), // path/key file di RustFS
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== APP CONFIG (Branding & PDF Settings) =====
export const appConfig = pgTable("app_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  logoUrl: text("logo_url"),
  pdfPaperSize: varchar("pdf_paper_size", { length: 20 }).default("A4"),
  pdfOrientation: varchar("pdf_orientation", { length: 20 }).default("portrait"),
  pdfHeaderText: text("pdf_header_text"),
  pdfFooterText: text("pdf_footer_text"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  tasksAssigned: many(tasks, { relationName: "assigned" }),
  tasksCreated: many(tasks, { relationName: "created" }),
  schedules: many(schedules),
  trackerLogs: many(trackerLogs),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, { fields: [tasks.assignedTo], references: [users.id], relationName: "assigned" }),
  creator: one(users, { fields: [tasks.createdBy], references: [users.id], relationName: "created" }),
  schedules: many(schedules),
  trackerLogs: many(trackerLogs),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  task: one(tasks, { fields: [schedules.taskId], references: [tasks.id] }),
  user: one(users, { fields: [schedules.userId], references: [users.id] }),
}));

export const trackerLogsRelations = relations(trackerLogs, ({ one }) => ({
  task: one(tasks, { fields: [trackerLogs.taskId], references: [tasks.id] }),
  user: one(users, { fields: [trackerLogs.userId], references: [users.id] }),
}));
```
