"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Download, FileJson, FileSpreadsheet, User, Palette, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useSemester } from "@/lib/useSemester";
import { toast } from "sonner";

const EXPORT_TYPES = [
  { value: "all", label: "Everything" },
  { value: "events", label: "Calendar Events" },
  { value: "tasks", label: "Tasks" },
  { value: "goals", label: "Goals" },
  { value: "reflections", label: "Reflections" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { config: semesterConfig, updateSemester } = useSemester();
  const [semForm, setSemForm] = useState(semesterConfig);
  const [exportType, setExportType] = useState("all");
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?type=${exportType}&format=${format}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadership-os-${exportType}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-bold">
              {session?.user?.name?.[0] || "?"}
            </div>
            <div>
              <p className="font-semibold">{session?.user?.name || "User"}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email || ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-500" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                  theme === opt.value
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-500"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Semester */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-500" />
            Academic Semester
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Set your semester dates to see &quot;Week X of Y&quot; on your dashboard.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Semester name</label>
            <Input
              value={semForm.name}
              onChange={(e) => setSemForm({ ...semForm, name: e.target.value })}
              placeholder="e.g. Fall 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Start date</label>
              <Input
                type="date"
                value={semForm.startDate}
                onChange={(e) => setSemForm({ ...semForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End date</label>
              <Input
                type="date"
                value={semForm.endDate}
                onChange={(e) => setSemForm({ ...semForm, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Exam period starts</label>
            <Input
              type="date"
              value={semForm.examStart}
              onChange={(e) => setSemForm({ ...semForm, examStart: e.target.value })}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              updateSemester(semForm);
              toast.success("Semester settings saved");
            }}
            className="w-full"
          >
            Save Semester
          </Button>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-500" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">What to export</label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="w-full h-10 border border-input rounded-lg px-3 text-sm bg-background/50"
            >
              {EXPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="flex-1"
            >
              <FileJson className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="flex-1"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Download your data for backup or to use in other tools.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
