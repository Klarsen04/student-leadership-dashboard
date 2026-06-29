"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format, isToday, isPast, endOfWeek } from "date-fns";
import {
  Calendar,
  CheckSquare,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_BADGE_VARIANTS } from "@/lib/utils";
import { PriorityDot } from "@/components/PriorityDot";
import Link from "next/link";

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  role: string;
  location: string | null;
}


interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
  role: string;
  status: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [evRes, taskRes] = await Promise.all([
      fetch(`/api/calendar?start=${today.toISOString()}&end=${endOfDay.toISOString()}`),
      fetch("/api/tasks?status=todo"),
    ]);

    if (evRes.ok) setEvents(await evRes.json());
    if (taskRes.ok) {
      const data = await taskRes.json();
      setTasks(data.tasks || data);
    }
    setLoading(false);
  };

  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate))
  );
  const upcomingTasks = tasks
    .filter((t) => {
      if (!t.dueDate) return true;
      const d = new Date(t.dueDate);
      return !isPast(d) && d <= weekEnd;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Good {getTimeOfDay()}, {session?.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Today&apos;s Schedule
              </CardTitle>
              <Link href="/calendar">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No events today. Add events from the calendar page.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                  >
                    <div className="text-sm text-muted-foreground w-20 shrink-0">
                      {format(new Date(event.startTime), "h:mm a")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground truncate">
                          {event.location}
                        </p>
                      )}
                    </div>
                    {event.role && (
                      <Badge variant={(ROLE_BADGE_VARIANTS[event.role] || "secondary") as any}>
                        {event.role}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                Priority Tasks
              </CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overdueTasks.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-destructive uppercase mb-2">
                  Overdue
                </p>
                {overdueTasks.slice(0, 3).map((task) => (
                  <TaskRow key={task.id} task={task} overdue />
                ))}
              </div>
            )}
            {upcomingTasks.length > 0 ? (
              <div>
                {overdueTasks.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Upcoming
                  </p>
                )}
                {upcomingTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : overdueTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No pending tasks. Add some from the Tasks page.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Weekly Commitments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Today's Events" value={events.length} />
              <StatBox label="Pending Tasks" value={tasks.length} />
              <StatBox label="Overdue" value={overdueTasks.length} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({ task, overdue }: { task: any; overdue?: boolean }) {
  let dayIndex: number | undefined;
  if (task.dueDate) {
    const dateStr = task.dueDate.slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    const localDate = new Date(y, m - 1, d);
    dayIndex = localDate.getDay();
  }
  const href = dayIndex !== undefined ? `/tasks?day=${dayIndex}` : "/tasks";

  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <PriorityDot priority={task.priority} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${overdue ? "text-destructive" : ""}`}>
          {task.title}
        </p>
      </div>
      {task.dueDate && (
        <span className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}
    </Link>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg border bg-background">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
