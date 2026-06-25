"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EXPORT_TYPES = [
  { value: "all", label: "Everything" },
  { value: "events", label: "Calendar Events" },
  { value: "tasks", label: "Tasks" },
  { value: "goals", label: "Goals" },
  { value: "reflections", label: "Reflections" },
  { value: "checkins", label: "Check-ins" },
];

export default function SettingsPage() {
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your data and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">What to export</label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="w-full h-10 border rounded-md px-3 text-sm bg-background"
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
            Download your data for backup or to use in other tools. JSON preserves all
            structure; CSV is better for spreadsheets.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
