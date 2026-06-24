"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Heart,
  AlertTriangle,
} from "lucide-react";
import { CATEGORIES } from "@/lib/utils";

interface AnalyticsData {
  totalHours: number;
  hoursByCategory: Record<string, number>;
  eventsAttended: number;
  eventsLed: number;
  interactions: number;
  newPeopleMet: number;
  burnout: {
    score: number;
    factors: string[];
    recommendation: string;
  };
  balance: {
    academics: number;
    leadership: number;
    ministry: number;
    personal: number;
  };
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Analytics</h1>
        <div className="text-center text-gray-500 py-12">Loading...</div>
      </div>
    );
  }

  const burnoutColor =
    data.burnout.score >= 75
      ? "text-red-600"
      : data.burnout.score >= 50
      ? "text-orange-500"
      : "text-green-600";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Your leadership impact at a glance</p>
        </div>
        <div className="flex bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setPeriod("week")}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              period === "week"
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              period === "month"
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<Clock className="w-5 h-5 text-primary-600" />}
          label="Total Hours"
          value={`${data.totalHours}h`}
        />
        <MetricCard
          icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
          label="Events Attended"
          value={data.eventsAttended.toString()}
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          label="Events Led"
          value={data.eventsLed.toString()}
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-purple-600" />}
          label="Interactions"
          value={data.interactions.toString()}
        />
      </div>

      {/* Time Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Hours by Category
          </h2>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => {
              const hours = data.hoursByCategory[cat.value] || 0;
              const maxHours = Math.max(...Object.values(data.hoursByCategory), 1);
              const pct = (hours / maxHours) * 100;
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {cat.label}
                    </span>
                    <span className="text-sm text-gray-500">{hours}h</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Balance Wheel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Life Balance
          </h2>
          <div className="space-y-4">
            {[
              { label: "Academics", value: data.balance.academics, color: "bg-blue-500" },
              { label: "Leadership", value: data.balance.leadership, color: "bg-green-500" },
              { label: "Ministry", value: data.balance.ministry, color: "bg-yellow-500" },
              { label: "Personal", value: data.balance.personal, color: "bg-gray-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {item.label}
                  </span>
                  <span className="text-sm text-gray-500">{item.value}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Burnout Indicator */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl ${
              data.burnout.score >= 75
                ? "bg-red-50"
                : data.burnout.score >= 50
                ? "bg-orange-50"
                : "bg-green-50"
            }`}
          >
            {data.burnout.score >= 50 ? (
              <AlertTriangle className={`w-6 h-6 ${burnoutColor}`} />
            ) : (
              <Heart className={`w-6 h-6 ${burnoutColor}`} />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Burnout Risk:{" "}
              <span className={burnoutColor}>{data.burnout.score}%</span>
            </h2>
            <p className="text-gray-600 mb-3">{data.burnout.recommendation}</p>
            {data.burnout.factors.length > 0 && (
              <ul className="space-y-1">
                {data.burnout.factors.map((factor) => (
                  <li
                    key={factor}
                    className="text-sm text-gray-500 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    {factor}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
