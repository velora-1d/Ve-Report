import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAppConfig } from "@/lib/app-config";
import { createServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskListTab } from "@/components/tasks/task-list-tab";
import { CalendarTab } from "@/components/schedules/calendar-tab";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { tasks as tasksTable, users as usersTable, schedules as schedulesTable } from "@/db/schema";
import { eq, desc, and, gte, lt, ne, inArray, or } from "drizzle-orm";
import { sendTelegramNotification } from "@/lib/telegram";
import { useEffect, useState, useMemo } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getUserDivisionsList } from "./pelacak";
import { DivisionSelectDialog } from "@/components/tracker/division-select-dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft } from "lucide-react";

// ponytail: Fungsi server untuk mengambil semua daftar tugas (berikut nama assignee) dengan filter divisi
export const getTasksList = createServerFn({ method: "GET" })
  .validator(z.object({ divisionId: z.string().nullable().optional() }))
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");

    const role = session.user.role || "staff";
    let whereClause = role === "staff"
      ? or(
          eq(tasksTable.assignedTo, session.user.id),
          eq(tasksTable.createdBy, session.user.id)
        )
      : undefined;

    if (data.divisionId) {
      if (whereClause) {
        whereClause = and(whereClause, eq(tasksTable.divisionId, data.divisionId));
      } else {
        whereClause = eq(tasksTable.divisionId, data.divisionId);
      }
    }

    const rawTasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        assignedTo: tasksTable.assignedTo,
        createdBy: tasksTable.createdBy,
        dueDate: tasksTable.dueDate,
        startedAt: tasksTable.startedAt,
        completedAt: tasksTable.completedAt,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        taskSource: tasksTable.taskSource,
        outputDescription: tasksTable.outputDescription,
        divisionId: tasksTable.divisionId,
        assignee: {
          id: usersTable.id,
          name: usersTable.name,
        },
      })
      .from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedTo, usersTable.id))
      .where(whereClause)
      .orderBy(desc(tasksTable.createdAt));

    const tasks = rawTasks.map((t) => ({
      ...t,
      assignee: t.assignee?.id ? t.assignee : null,
    }));

    return tasks;
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

// ponytail: Menambahkan field startedAt (Target Mulai) pada server function saveTask
export const saveTask = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().nullable().optional(),
      status: z.string(),
      priority: z.string(),
      startedAt: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      assignedTo: z.string().nullable().optional(),
      taskSource: z.string().optional(),
      outputDescription: z.string().nullable().optional(),
      divisionId: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";

    const payload = {
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedTo: role === "staff"
        ? session.user.id
        : (data.assignedTo === "__none__" || !data.assignedTo ? null : data.assignedTo),
      taskSource: data.taskSource || "atasan",
      outputDescription: data.outputDescription || null,
      updatedAt: new Date(),
    };

    if (data.id) {
      if (role === "staff") {
        const existing = await db.query.tasks.findFirst({
          where: and(eq(tasksTable.id, data.id), eq(tasksTable.createdBy, session.user.id)),
        });
        if (!existing) throw new Error("Forbidden");
      }
      await db.update(tasksTable).set(payload).where(eq(tasksTable.id, data.id));
    } else {
      await db.insert(tasksTable).values({
        ...payload,
        createdBy: session.user.id,
      });

      // ponytail: Ambil nama penerima tugas jika ada
      let assigneeName = "";
      if (data.assignedTo && data.assignedTo !== "__none__") {
        const u = await db.query.users.findFirst({
          where: eq(usersTable.id, data.assignedTo),
          columns: { name: true }
        });
        if (u?.name) assigneeName = u.name;
      }

      // ponytail: Kirim notifikasi instan ke grup/channel Telegram
      await sendTelegramNotification(
        `📋 *Log Book Meeting Baru*\n\n` +
        `• *Judul*: ${data.title}\n` +
        `• *Sifat*: ${data.priority.toUpperCase()}\n` +
        `• *Sumber*: ${data.taskSource || "atasan"}\n` +
        (assigneeName ? `• *Penerima*: ${assigneeName}\n` : "") +
        `• *Batas Waktu*: ${data.dueDate || "-"}\n` +
        `• *Deskripsi*: ${data.description || "-"}`
      );
    }
  });

// ponytail: Fungsi server untuk menghapus tugas
export const deleteTask = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const session = await getSession();
    if (!session || !session.user) throw new Error("Unauthorized");
    const role = session.user.role || "staff";

    if (role === "staff") {
      const task = await db.query.tasks.findFirst({
        where: and(eq(tasksTable.id, id), eq(tasksTable.createdBy, session.user.id)),
      });
      if (!task) throw new Error("Forbidden");
    } else if (role !== "admin" && role !== "developer") {
      throw new Error("Forbidden");
    }

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
  const { data: user } = useCurrentUser();
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
  });
  const appName = config?.appName || "Log Book";

  // States untuk multi-divisi
  const [activeDivId, setActiveDivId] = useState<string | null>(null);
  const [divDialogOpen, setDivDialogOpen] = useState(false);

  const { data: userDivs } = useQuery({
    queryKey: ["user-divisions-list", user?.id],
    enabled: !!user?.id,
    queryFn: () => getUserDivisionsList(),
  });

  const activeDivName = useMemo(() => {
    if (!userDivs || !activeDivId) return null;
    return userDivs.find((d) => d.id === activeDivId)?.name || null;
  }, [userDivs, activeDivId]);

  useEffect(() => {
    // Selalu tampilkan pemilih divisi setiap kali masuk menu
    setDivDialogOpen(true);
    const cached = sessionStorage.getItem("active_division_id");
    if (cached) {
      setActiveDivId(cached);
    }
  }, []);

  const handleSelectDivision = (id: string) => {
    setActiveDivId(id);
    sessionStorage.setItem("active_division_id", id);
    setDivDialogOpen(false);
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {appName} Meeting
            {activeDivName && (
              <Badge className="bg-gradient-to-r from-primary to-blue-600 text-white font-extrabold text-[11px] rounded-xl px-2.5 py-0.5 border-none shadow-sm ml-2">
                {activeDivName}
              </Badge>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <p className="text-sm text-muted-foreground">
              Daftar penugasan dari atasan dan hasil meeting harian.
            </p>
            {userDivs && userDivs.length > 0 && (
              <button
                onClick={() => setDivDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-extrabold text-primary bg-primary/10 hover:bg-primary/15 transition-all shadow-none cursor-pointer border border-primary/5"
              >
                <ArrowRightLeft className="w-3 h-3 stroke-[2.5px]" />
                Ubah Divisi
              </button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="daftar">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="daftar" className="rounded-lg">Tabel Log Meeting</TabsTrigger>
          <TabsTrigger value="kalender" className="rounded-lg">Kalender Rapat</TabsTrigger>
        </TabsList>
        <TabsContent value="daftar" className="mt-4">
          <TaskListTab divisionId={activeDivId} />
        </TabsContent>
        <TabsContent value="kalender" className="mt-4">
          <CalendarTab />
        </TabsContent>
      </Tabs>

      <DivisionSelectDialog
        open={divDialogOpen}
        onOpenChange={setDivDialogOpen}
        divisions={userDivs ?? []}
        selectedId={activeDivId}
        onSelect={handleSelectDivision}
        isMandatory={true}
      />
    </div>
  );
}
