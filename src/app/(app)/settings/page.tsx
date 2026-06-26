"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Plus, X, Tag, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRoles, getRoleColor } from "@/lib/useRoles";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const EXPORT_TYPES = [
  { value: "all", label: "Everything" },
  { value: "events", label: "Calendar Events" },
  { value: "tasks", label: "Tasks" },
  { value: "goals", label: "Goals" },
  { value: "reflections", label: "Reflections" },
];

export default function SettingsPage() {
  const [exportType, setExportType] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [roleUsageCount, setRoleUsageCount] = useState(0);
  const { roles, addRole, deleteRole } = useRoles();

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

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    const success = addRole(newRole.trim());
    if (success) {
      toast.success(`Added "${newRole.trim()}" role`);
      setNewRole("");
    } else {
      toast.error("Role already exists");
    }
  };

  const handleDeleteRole = async (role: string) => {
    try {
      const [tasksRes, eventsRes] = await Promise.all([
        fetch(`/api/tasks?role=${encodeURIComponent(role)}&limit=1`),
        fetch(`/api/calendar?role=${encodeURIComponent(role)}`),
      ]);
      let count = 0;
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        count += data.total || (data.tasks || data).length || 0;
      }
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        count += Array.isArray(events) ? events.length : 0;
      }
      setRoleUsageCount(count);
      setRoleToDelete(role);
    } catch {
      setRoleUsageCount(0);
      setRoleToDelete(role);
    }
  };

  const confirmDeleteRole = () => {
    if (roleToDelete) {
      deleteRole(roleToDelete);
      toast.success(`Removed "${roleToDelete}" role`);
      setRoleToDelete(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your data and preferences</p>
      </div>

      {/* Roles Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Manage Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Roles are used to categorize your calendar events and tasks. Add new ones or remove roles you no longer need.
          </p>

          {/* Current Roles */}
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <div
                key={role}
                className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border bg-background text-sm"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${getRoleColor(role)}`} />
                <span className="font-medium">{role}</span>
                <button
                  onClick={() => handleDeleteRole(role)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add New Role */}
          <form onSubmit={handleAddRole} className="flex gap-2">
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="New role name..."
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!newRole.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Export Data */}
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

      <ConfirmDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title={`Delete "${roleToDelete}" role?`}
        description={
          roleUsageCount > 0
            ? `This role is used by ${roleUsageCount} task${roleUsageCount > 1 ? "s" : ""}/event${roleUsageCount > 1 ? "s" : ""}. They will keep their current role label but it won't appear in filters anymore.`
            : "This role is not used by any tasks or events. Safe to delete."
        }
        onConfirm={confirmDeleteRole}
      />
    </div>
  );
}
