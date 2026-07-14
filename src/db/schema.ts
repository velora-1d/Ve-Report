import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===== USERS (Better Auth compatible + custom fields) =====
export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
  // Custom fields from brief/DATABASE.md
  role: varchar("role", { length: 20 }).notNull().default("staff"), // 'developer' | 'admin' | 'staff'
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  bio: text("bio"),
  isActive: boolean("is_active").notNull().default(true),
});

// ===== SESSIONS (Better Auth standard) =====
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

// ===== ACCOUNTS (Better Auth standard) =====
export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== VERIFICATIONS (Better Auth standard) =====
export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ===== TASKS =====
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("todo"), // 'todo' | 'in_progress' | 'review' | 'done'
  priority: varchar("priority", { length: 50 }).notNull().default("medium"), // 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
  // Logbook columns
  taskSource: varchar("task_source", { length: 20 }).default("atasan"), // 'atasan' | 'meeting'
  outputDescription: text("output_description"),
});

// ===== SCHEDULE / CALENDAR =====
export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  reminderMinutesBefore: integer("reminder_minutes_before").default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== TRACKER LOGS =====
export const trackerLogs = pgTable("tracker_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
  durationMinutes: integer("duration_minutes"),
  loggedDate: date("logged_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  
  // Logbook columns
  startTime: varchar("start_time", { length: 10 }).default("08:00"),
  endTime: varchar("end_time", { length: 10 }).default("17:00"),
  status: varchar("status", { length: 20 }).default("progress"), // 'progress' | 'done'
  isValidated: boolean("is_validated").default(false),
  validatedBy: uuid("validated_by").references(() => users.id, { onDelete: "set null" }),
  remarks: text("remarks"),
});

// ===== REPORTS =====
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  generatedBy: uuid("generated_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  filterUserId: uuid("filter_user_id").references(() => users.id, { onDelete: "set null" }),
  pdfUrl: text("pdf_url"), // path/key file di RustFS
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== APP CONFIG (Branding & PDF Settings) =====
export const appConfig = pgTable("app_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  logoUrl: text("logo_url"),
  appName: text("app_name").default("Log Book"), // ponytail: Menambahkan nama aplikasi dinamis
  permissions: jsonb("permissions"), // ponytail: Kolom permissions RBAC Matrix dinamis
  pdfPaperSize: varchar("pdf_paper_size", { length: 20 }).default("A4"),
  pdfOrientation: varchar("pdf_orientation", { length: 20 }).default("portrait"),
  pdfHeaderText: text("pdf_header_text"),
  pdfFooterText: text("pdf_footer_text"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== SYSTEM LOGS =====
export const systemLogs = pgTable("system_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: varchar("level", { length: 20 }).notNull().default("info"), // 'info' | 'warning' | 'error' | 'critical'
  category: varchar("category", { length: 50 }),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  tasksAssigned: many(tasks, { relationName: "assigned" }),
  tasksCreated: many(tasks, { relationName: "created" }),
  schedules: many(schedules),
  trackerLogs: many(trackerLogs),
  trackerLogsValidated: many(trackerLogs, { relationName: "validated" }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assigned",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "created",
  }),
  schedules: many(schedules),
  trackerLogs: many(trackerLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  task: one(tasks, { fields: [schedules.taskId], references: [tasks.id] }),
  user: one(users, { fields: [schedules.userId], references: [users.id] }),
}));

export const trackerLogsRelations = relations(trackerLogs, ({ one }) => ({
  task: one(tasks, { fields: [trackerLogs.taskId], references: [tasks.id] }),
  user: one(users, { fields: [trackerLogs.userId], references: [users.id] }),
  validator: one(users, {
    fields: [trackerLogs.validatedBy],
    references: [users.id],
    relationName: "validated",
  }),
}));
