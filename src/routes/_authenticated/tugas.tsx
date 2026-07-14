// ponytail: Mengganti query Supabase client-side untuk tugas dan jadwal dengan Server Functions Drizzle ORM
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskListTab } from "@/components/tasks/task-list-tab";
import { CalendarTab } from "@/components/schedules/calendar-tab";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { tasks as tasksTable, users as usersTable, schedules as schedulesTable } from "@/db/schema";
import { eq, desc, and, gte, lt, ne, inArray } from "drizzle-orm";

// ponytail: Fungsi server untuk mengambil semua daftar tugas (berikut nama assignee)
export const getTasksList = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  return db.query.tasks.findMany({
    with: {
      assignee: {
        columns: {
          id: true,
          name: true,
        }
      }
    },
    orderBy: [desc(tasksTable.createdAt)],
  });
});

// ponytail: Fungsi server untuk mengambil daftar pengguna aktif yang dapat ditugaskan
export const getAssignableUsers = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  return db.query.users.findMany({
    where: eq(usersTable.isActive, true),
    columns: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [desc(usersTable.name)],
  });
});

// ponytail: Fungsi server untuk menyimpan/memperbarui tugas
export const saveTask = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().nullable().optional(),
      status: z.string(),
      priority: z.string(),
      dueDate: z.string().nullable().optional(),
      assignedTo: z.string().nullable().optional(),
      taskSource: z.string().optional(),
      outputDescription: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const payload = {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedTo: data.assignedTo === "__none__" || !data.assignedTo ? null : data.assignedTo,
      taskSource: data.taskSource || "atasan",
      outputDescription: data.outputDescription || null,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db.update(tasksTable).set(payload).where(eq(tasksTable.id, data.id));
    } else {
      await db.insert(tasksTable).values({
        ...payload,
        createdBy: session.user.id,
      });
    }
  });

// ponytail: Fungsi server untuk menghapus tugas
export const deleteTask = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";
    if (role !== "admin" && role !== "developer") throw new Error("Forbidden");

    await db.delete(tasksTable).where(eq(tasksTable.id, id));
  });

// ponytail: Fungsi server untuk memperbarui status pengerjaan tugas secara instan
export const updateTaskStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      status: z.string(),
      startedAt: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    await db.update(tasksTable)
      .set({
        status: data.status,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(tasksTable.id, data.id));
  });

// ponytail: Fungsi server untuk mengambil daftar jadwal (schedules) dalam range waktu tertentu
export const getSchedules = createServerFn({ method: "GET" })
  .validator(z.object({ start: z.string(), end: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    return db.query.schedules.findMany({
      where: and(
        eq(schedulesTable.userId, session.user.id),
        gte(schedulesTable.startTime, new Date(data.start)),
        lt(schedulesTable.startTime, new Date(data.end))
      ),
      orderBy: [desc(schedulesTable.startTime)],
    });
  });

// ponytail: Fungsi server untuk mengambil daftar tugas aktif untuk dihubungkan ke jadwal
export const getLinkableTasks = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();
  if (!session || !session.user) throw new Error("Unauthorized");

  return db.query.tasks.findMany({
    where: ne(tasksTable.status, "done"),
    columns: {
      id: true,
      title: true,
    },
    orderBy: [desc(tasksTable.createdAt)],
    limit: 50,
  });
});

// ponytail: Fungsi server untuk menyimpan/memperbarui jadwal (schedule)
export const saveSchedule = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().nullable().optional(),
      taskId: z.string().nullable().optional(),
      startTime: z.string(),
      endTime: z.string(),
      reminderMinutesBefore: z.number().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const payload = {
      title: data.title,
      description: data.description || null,
      taskId: data.taskId === "__none__" || !data.taskId ? null : data.taskId,
      userId: session.user.id,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      reminderMinutesBefore: data.reminderMinutesBefore ?? 30,
    };

    if (data.id) {
      await db.update(schedulesTable).set(payload).where(eq(schedulesTable.id, data.id));
    } else {
      await db.insert(schedulesTable).values(payload);
    }
  });

// ponytail: Fungsi server untuk menghapus jadwal (schedule)
export const deleteSchedule = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    await db.delete(schedulesTable)
      .where(and(eq(schedulesTable.id, id), eq(schedulesTable.userId, session.user.id)));
  });

export const Route = createFileRoute("/_authenticated/tugas")({
  head: () => ({
    meta: [
      { title: "Tugas & Jadwal — Log Book" },
      {
        name: "description",
        content: "Kelola daftar tugas dan jadwal kalender tim Anda.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TugasPage,
});

function TugasPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Tugas & Jadwal
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Daftar tugas dan jadwal kalender dalam satu tempat.
        </p>
      </div>

      <Tabs defaultValue="daftar">
        <TabsList>
          <TabsTrigger value="daftar">Daftar Tugas</TabsTrigger>
          <TabsTrigger value="kalender">Kalender</TabsTrigger>
        </TabsList>
        <TabsContent value="daftar" className="mt-4">
          <TaskListTab />
        </TabsContent>
        <TabsContent value="kalender" className="mt-4">
          <CalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
