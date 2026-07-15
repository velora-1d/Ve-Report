import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  date,
  json,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import crypto from "crypto";

// ===== USERS (Better Auth compatible + custom fields) =====
export const users = mysqlTable("user", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
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
export const sessions = mysqlTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// ===== ACCOUNTS (Better Auth standard) =====
export const accounts = mysqlTable("account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== VERIFICATIONS (Better Auth standard) =====
export const verifications = mysqlTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ===== TASKS =====
export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("todo"), // 'todo' | 'in_progress' | 'review' | 'done'
  priority: varchar("priority", { length: 50 }).notNull().default("medium"), // 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: varchar("assigned_to", { length: 36 }).references(
    () => users.id,
    { onDelete: "set null" },
  ),
  createdBy: varchar("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Logbook columns
  taskSource: varchar("task_source", { length: 20 }).default("atasan"), // 'atasan' | 'meeting'
  outputDescription: text("output_description"),
  divisionId: varchar("division_id", { length: 36 }).references(
    () => divisions.id,
    { onDelete: "set null" },
  ),
});

// ===== SCHEDULE / CALENDAR =====
export const schedules = mysqlTable("schedules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, {
    onDelete: "set null",
  }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  reminderMinutesBefore: int("reminder_minutes_before").default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== TRACKER LOGS =====
export const trackerLogs = mysqlTable("tracker_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, {
    onDelete: "cascade",
  }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  note: text("note"),
  durationMinutes: int("duration_minutes"),
  loggedDate: date("logged_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Logbook columns
  startTime: varchar("start_time", { length: 10 }).default("08:00"),
  endTime: varchar("end_time", { length: 10 }).default("17:00"),
  status: varchar("status", { length: 20 }).default("progress"), // 'progress' | 'done'
  isValidated: boolean("is_validated").default(false),
  validatedBy: varchar("validated_by", { length: 36 }).references(
    () => users.id,
    { onDelete: "set null" },
  ),
  remarks: text("remarks"),
  divisionId: varchar("division_id", { length: 36 }).references(
    () => divisions.id,
    { onDelete: "set null" },
  ),
});

// ===== REPORTS =====
export const reports = mysqlTable("reports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar("title", { length: 200 }).notNull(),
  generatedBy: varchar("generated_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  filterUserId: varchar("filter_user_id", { length: 36 }).references(
    () => users.id,
    { onDelete: "set null" },
  ),
  pdfUrl: text("pdf_url"), // path/key file di RustFS
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== APP CONFIG (Branding & PDF Settings) =====
export const appConfig = mysqlTable("app_config", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  logoUrl: text("logo_url"),
  appName: varchar("app_name", { length: 255 }).default("Log Book"), // ponytail: Menambahkan nama aplikasi dinamis
  permissions: json("permissions"), // ponytail: Kolom permissions RBAC Matrix dinamis
  pdfPaperSize: varchar("pdf_paper_size", { length: 20 }).default("A4"),
  pdfOrientation: varchar("pdf_orientation", { length: 20 }).default(
    "portrait",
  ),
  pdfHeaderText: text("pdf_header_text"),
  pdfFooterText: text("pdf_footer_text"),
  logLimit: int("log_limit").default(200),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== SYSTEM LOGS =====
export const systemLogs = mysqlTable("system_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  level: varchar("level", { length: 20 }).notNull().default("info"), // 'info' | 'warning' | 'error' | 'critical'
  category: varchar("category", { length: 50 }),
  message: text("message").notNull(),
  metadata: json("metadata"),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== DIVISIONS & VALIDATORS (Multi-Divisi) =====
// ponytail: Struktur tabel divisi dan pivot table relasi user/validator demi mendukung validasi per divisi
export const divisions = mysqlTable("divisions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userDivisions = mysqlTable(
  "user_divisions",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    divisionId: varchar("division_id", { length: 36 })
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    position: varchar("position", { length: 100 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.divisionId] }),
  }),
);

export const divisionValidators = mysqlTable(
  "division_validators",
  {
    divisionId: varchar("division_id", { length: 36 })
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.divisionId, table.userId] }),
  }),
);

// ===== RELATIONS =====
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  tasksAssigned: many(tasks, { relationName: "assigned" }),
  tasksCreated: many(tasks, { relationName: "created" }),
  schedules: many(schedules),
  trackerLogs: many(trackerLogs),
  trackerLogsValidated: many(trackerLogs, { relationName: "validated" }),
  userDivisions: many(userDivisions),
  divisionValidators: many(divisionValidators),
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
  division: one(divisions, {
    fields: [tasks.divisionId],
    references: [divisions.id],
  }),
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
  division: one(divisions, {
    fields: [trackerLogs.divisionId],
    references: [divisions.id],
  }),
}));

export const divisionsRelations = relations(divisions, ({ many }) => ({
  userDivisions: many(userDivisions),
  divisionValidators: many(divisionValidators),
  trackerLogs: many(trackerLogs),
  tasks: many(tasks),
}));

export const userDivisionsRelations = relations(userDivisions, ({ one }) => ({
  user: one(users, { fields: [userDivisions.userId], references: [users.id] }),
  division: one(divisions, {
    fields: [userDivisions.divisionId],
    references: [divisions.id],
  }),
}));

export const divisionValidatorsRelations = relations(
  divisionValidators,
  ({ one }) => ({
    division: one(divisions, {
      fields: [divisionValidators.divisionId],
      references: [divisions.id],
    }),
    user: one(users, {
      fields: [divisionValidators.userId],
      references: [users.id],
    }),
  }),
);
