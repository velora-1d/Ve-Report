import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Clock, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScheduleFormDialog, type ScheduleRow } from "./schedule-form-dialog";

type ViewMode = "day" | "week" | "month" | "year";

export function CalendarTab() {
  const { data: user } = useCurrentUser();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  const range = useMemo(() => {
    if (view === "day")
      return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 7) };
    }
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = addDays(
        endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
        1,
      );
      return { start, end };
    }
    const start = startOfYear(cursor);
    return { start, end: addYears(start, 1) };
  }, [view, cursor]);

  const { data: schedules } = useQuery({
    queryKey: ["schedules", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("start_time", range.start.toISOString())
        .lt("start_time", range.end.toISOString())
        .order("start_time");
      if (error) throw error;
      return data as ScheduleRow[];
    },
    enabled: !!user,
  });

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    (schedules ?? []).forEach((s) => {
      const key = format(new Date(s.start_time), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [schedules]);

  const step = (dir: 1 | -1) => {
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addWeeks(cursor, dir));
    else if (view === "month") setCursor(addMonths(cursor, dir));
    else setCursor(addYears(cursor, dir));
  };

  const openNew = (date?: Date) => {
    setEditing(null);
    setDefaultDate(date);
    setFormOpen(true);
  };
  const openEdit = (s: ScheduleRow) => {
    setEditing(s);
    setDefaultDate(undefined);
    setFormOpen(true);
  };

  const label = useMemo(() => {
    if (view === "day")
      return format(cursor, "EEEE, d MMMM yyyy", { locale: idLocale });
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = addDays(s, 6);
      return `${format(s, "d MMM", { locale: idLocale })} – ${format(e, "d MMM yyyy", { locale: idLocale })}`;
    }
    if (view === "month")
      return format(cursor, "MMMM yyyy", { locale: idLocale });
    return format(cursor, "yyyy");
  }, [view, cursor]);

  return (
    <div className="space-y-4">
      <Card className="p-3 surface-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => step(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[180px] text-center font-medium capitalize">
              {label}
            </div>
            <Button size="icon" variant="ghost" onClick={() => step(1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(new Date())}
            >
              Hari ini
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="day">Harian</TabsTrigger>
                <TabsTrigger value="week">Mingguan</TabsTrigger>
                <TabsTrigger value="month">Bulanan</TabsTrigger>
                <TabsTrigger value="year">Tahunan</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => openNew()}>
              <Plus className="size-4" /> Jadwal
            </Button>
          </div>
        </div>
      </Card>

      {view === "day" && (
        <DayView date={cursor} schedules={schedules ?? []} onEdit={openEdit} />
      )}
      {view === "week" && (
        <WeekView
          cursor={cursor}
          byDate={byDate}
          onEdit={openEdit}
          onNew={openNew}
        />
      )}
      {view === "month" && (
        <MonthView
          cursor={cursor}
          byDate={byDate}
          onEdit={openEdit}
          onNew={openNew}
        />
      )}
      {view === "year" && (
        <YearView
          cursor={cursor}
          schedules={schedules ?? []}
          onPickMonth={(d) => {
            setCursor(d);
            setView("month");
          }}
        />
      )}

      {user && (
        <ScheduleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          schedule={editing}
          defaultDate={defaultDate}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}

function ScheduleItem({
  s,
  onEdit,
  compact,
}: {
  s: ScheduleRow;
  onEdit: (s: ScheduleRow) => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={() => onEdit(s)}
      className={cn(
        "w-full text-left rounded-md px-2 py-1 text-xs transition hover:bg-primary/20",
        "bg-primary/10 text-primary",
        compact && "truncate",
      )}
    >
      <span className="font-medium">
        {format(new Date(s.start_time), "HH:mm")}
      </span>{" "}
      <span>{s.title}</span>
    </button>
  );
}

function DayView({
  date,
  schedules,
  onEdit,
}: {
  date: Date;
  schedules: ScheduleRow[];
  onEdit: (s: ScheduleRow) => void;
}) {
  const items = schedules.filter((s) =>
    isSameDay(new Date(s.start_time), date),
  );
  return (
    <Card className="p-4 surface-card">
      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada jadwal untuk hari ini.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => onEdit(s)}
              className="w-full text-left rounded-lg border border-border/60 p-3 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{s.title}</div>
                  {s.description && (
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {s.description}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground shrink-0">
                  <div className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {format(new Date(s.start_time), "HH:mm")} –{" "}
                    {format(new Date(s.end_time), "HH:mm")}
                  </div>
                  {s.reminder_minutes_before ? (
                    <div className="inline-flex items-center gap-1 text-xs mt-1">
                      <Bell className="size-3" />
                      {s.reminder_minutes_before} mnt
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function WeekView({
  cursor,
  byDate,
  onEdit,
  onNew,
}: {
  cursor: Date;
  byDate: Map<string, ScheduleRow[]>;
  onEdit: (s: ScheduleRow) => void;
  onNew: (d: Date) => void;
}) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Card className="surface-card overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-border/60">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDate.get(key) ?? [];
          return (
            <div key={key} className="min-h-[220px] p-2 space-y-1.5">
              <button
                onClick={() => onNew(d)}
                className={cn(
                  "w-full text-left text-xs font-medium px-1 py-0.5 rounded transition hover:bg-muted",
                  isToday(d) && "text-primary",
                )}
              >
                <div className="capitalize text-muted-foreground text-[10px]">
                  {format(d, "EEE", { locale: idLocale })}
                </div>
                <div className="text-sm">{format(d, "d")}</div>
              </button>
              {items.map((s) => (
                <ScheduleItem key={s.id} s={s} onEdit={onEdit} compact />
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MonthView({
  cursor,
  byDate,
  onEdit,
  onNew,
}: {
  cursor: Date;
  byDate: Map<string, ScheduleRow[]>;
  onEdit: (s: ScheduleRow) => void;
  onNew: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <Card className="surface-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-2 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDate.get(key) ?? [];
          const outside = !isSameMonth(d, cursor);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[110px] border-b border-r border-border/40 p-1.5 space-y-1",
                (i + 1) % 7 === 0 && "border-r-0",
                outside && "bg-muted/20",
              )}
            >
              <button
                onClick={() => onNew(d)}
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded transition hover:bg-muted",
                  isToday(d) &&
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  outside && !isToday(d) && "text-muted-foreground",
                )}
              >
                {format(d, "d")}
              </button>
              <div className="space-y-1">
                {items.slice(0, 3).map((s) => (
                  <ScheduleItem key={s.id} s={s} onEdit={onEdit} compact />
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{items.length - 3} lainnya
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function YearView({
  cursor,
  schedules,
  onPickMonth,
}: {
  cursor: Date;
  schedules: ScheduleRow[];
  onPickMonth: (d: Date) => void;
}) {
  const year = cursor.getFullYear();
  const monthly = Array.from({ length: 12 }, (_, m) => {
    const count = schedules.filter(
      (s) => new Date(s.start_time).getMonth() === m,
    ).length;
    return { month: m, count };
  });
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {monthly.map(({ month, count }) => {
        const d = new Date(year, month, 1);
        return (
          <button
            key={month}
            onClick={() => onPickMonth(d)}
            className="text-left"
          >
            <Card className="p-4 surface-panel transition hover:shadow-soft hover:border-primary/40">
              <div className="text-sm text-muted-foreground capitalize">
                {format(d, "MMMM", { locale: idLocale })}
              </div>
              <div className="mt-2 text-2xl font-semibold">{count}</div>
              <div className="text-xs text-muted-foreground">jadwal</div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
