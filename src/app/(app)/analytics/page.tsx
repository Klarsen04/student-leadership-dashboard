"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BarChart3, Clock, CheckSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoles, getRoleColor } from "@/lib/useRoles";

interface AnalyticsData {
  totalHours: number;
  hoursByRole: Record<string, number>;
  eventsAttended: number;
  eventsLed: number;
  tasksCompleted: number;
  wellness: { date: string; energy: number; stress: number; mood: number; sleep: number | null }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const { roles } = useRoles();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [period]);

  if (loading || !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Analytics</h1>
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      </div>
    );
  }

  const maxHours = Math.max(...Object.values(data.hoursByRole), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Track your leadership impact
          </p>
        </div>
        <div className="flex border rounded-lg p-1">
          <Button
            variant={period === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("week")}
          >
            Week
          </Button>
          <Button
            variant={period === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("month")}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Clock className="w-5 h-5" />} label="Total Hours" value={`${data.totalHours}h`} />
        <MetricCard icon={<BarChart3 className="w-5 h-5" />} label="Events" value={`${data.eventsAttended}`} />
        <MetricCard icon={<CheckSquare className="w-5 h-5" />} label="Tasks Done" value={`${data.tasksCompleted}`} />
        <MetricCard icon={<TrendingUp className="w-5 h-5" />} label="Events Led" value={`${data.eventsLed}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time by Role */}
        <Card>
          <CardHeader>
            <CardTitle>Time Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roles.map((role) => {
                const hours = data.hoursByRole[role] || 0;
                const pct = (hours / maxHours) * 100;
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{role}</span>
                      <span className="text-sm text-muted-foreground">{hours}h</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getRoleColor(role)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Leadership Impact */}
        <Card>
          <CardHeader>
            <CardTitle>Leadership Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{data.eventsAttended}</p>
                <p className="text-xs text-muted-foreground">Events Attended</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{data.eventsLed}</p>
                <p className="text-xs text-muted-foreground">Events Led</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{data.tasksCompleted}</p>
                <p className="text-xs text-muted-foreground">Tasks Completed</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{data.totalHours}h</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wellness Trends */}
      {data.wellness.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Wellness Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.wellness.map((day) => (
                <div key={day.date} className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground w-16">
                    {format(new Date(day.date), "MMM d")}
                  </span>
                  <div className="flex-1 flex items-center gap-6">
                    <WellnessBar label="Energy" value={day.energy} color="bg-green-500" />
                    <WellnessBar label="Stress" value={day.stress} color="bg-red-500" />
                    <WellnessBar label="Mood" value={day.mood} color="bg-blue-500" />
                    {day.sleep && (
                      <span className="text-xs text-muted-foreground">{day.sleep}h sleep</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WellnessBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground w-12">{label}</span>
      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs font-medium w-4">{value}</span>
    </div>
  );
}
