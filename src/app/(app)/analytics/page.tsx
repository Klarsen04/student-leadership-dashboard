"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BarChart3, Calendar, CheckSquare, Target, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface AnalyticsData {
  totalHours: number;
  hoursByCalendar: Record<string, number>;
  totalEvents: number;
  tasksCompleted: number;
  tasksPending: number;
  goalsActive: number;
  goalsProgress: number;
  reflectionCount: number;
  wellness: { date: string; type: string; energy: number | null; mood: number | null }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);

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

  const maxCalHours = Math.max(...Object.values(data.hoursByCalendar), 1);
  const calColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Your {period === "week" ? "weekly" : "monthly"} overview
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
        <MetricCard icon={<Calendar className="w-5 h-5" />} label="Events" value={`${data.totalEvents}`} />
        <MetricCard icon={<CheckSquare className="w-5 h-5" />} label="Tasks Done" value={`${data.tasksCompleted}`} />
        <MetricCard icon={<Target className="w-5 h-5" />} label="Goals Active" value={`${data.goalsActive}`} />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} label="Reflections" value={`${data.reflectionCount}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time by Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Time by Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.hoursByCalendar).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No events this {period}</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.hoursByCalendar)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cal, hours], idx) => (
                    <div key={cal}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cal}</span>
                        <span className="text-sm text-muted-foreground">{hours}h</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${calColors[idx % calColors.length]}`}
                          style={{ width: `${(hours / maxCalHours) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                <div className="pt-2 border-t mt-3">
                  <p className="text-sm font-medium">Total: {data.totalHours}h</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals & Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Goals Progress</span>
                <span className="text-sm text-muted-foreground">{data.goalsProgress}%</span>
              </div>
              <Progress value={data.goalsProgress} />
              <p className="text-xs text-muted-foreground mt-1">{data.goalsActive} active goal{data.goalsActive !== 1 ? "s" : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold text-green-600">{data.tasksCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold text-amber-600">{data.tasksPending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wellness from Reflections */}
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
              {data.wellness.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground w-20 shrink-0">
                    {format(new Date(entry.date), "MMM d")}
                  </span>
                  <div className="flex-1 flex items-center gap-6">
                    {entry.energy && (
                      <WellnessBar label="Energy" value={entry.energy} color="bg-green-500" />
                    )}
                    {entry.mood && (
                      <WellnessBar label="Mood" value={entry.mood} color="bg-blue-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{entry.type}</span>
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
