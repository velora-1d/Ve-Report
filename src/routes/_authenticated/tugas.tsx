import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskListTab } from "@/components/tasks/task-list-tab";
import { CalendarTab } from "@/components/schedules/calendar-tab";

export const Route = createFileRoute("/_authenticated/tugas")({
  head: () => ({
    meta: [
      { title: "Tugas & Jadwal — VeReport" },
      { name: "description", content: "Kelola daftar tugas dan jadwal kalender tim Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TugasPage,
});

function TugasPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tugas & Jadwal</h2>
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
