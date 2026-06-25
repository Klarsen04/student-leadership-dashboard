"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format, isToday, isPast } from "date-fns";
import {
  Calendar,
  Users,
  AlertCircle,
  CheckSquare,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_BADGE_VARIANTS } from "@/lib/utils";
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

interface Person {
  id: string;
  name: string;
  category: string;
  followUpDate: string | null;
  lastContactDate: string | null;
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
  const [followUps, setFollowUps] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [evRes, pplRes, taskRes] = await Promise.all([
      fetch(`/api/calendar?start=${today.toISOString()}&end=${endOfDay.toISOString()}`),
      fetch("/api/people?needsFollowUp=true"),
      fetch("/api/tasks?status=todo"),
    ]);

    if (evRes.ok) setEvents(await evRes.json());
    if (pplRes.ok) setFollowUps(await pplRes.json());
    if (taskRes.ok) setTasks(await taskRes.json());
    setLoading(false);
  };

  const syncOutlook = async () => {
    setSyncing(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync",
        start: today.toISOString(),
        end: endOfWeek.toISOString(),
      }),
    });
    await fetchData();
    setSyncing(false);
  };

  const overdueTasks = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate))
  );
  const upcomingTasks = tasks
    .filter((t) => !t.dueDate || !isPast(new Date(t.dueDate)))
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
        <Button
          variant="outline"
          size="sm"
          onClick={syncOutlook}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          Sync Calendars
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule - takes 2 columns */}
        <Card className="lg:col-span-2">
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
                No events today. Sync your calendars or add events manually.
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
                    <Badge variant={(ROLE_BADGE_VARIANTS[event.role] || "secondary") as any}>
                      {event.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups Due */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Follow-ups
              </CardTitle>
              <Link href="/people">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No follow-ups due. Nice work!
              </p>
            ) : (
              <div className="space-y-2">
                {followUps.slice(0, 6).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {person.category}
                      </p>
                    </div>
                    {person.followUpDate && (
                      <span className="text-xs text-orange-600">
                        {format(new Date(person.followUpDate), "MMM d")}
                      </span>
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
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Today's Events" value={events.length} />
              <StatBox label="Follow-ups Due" value={followUps.length} />
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
  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
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
    </div>
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
