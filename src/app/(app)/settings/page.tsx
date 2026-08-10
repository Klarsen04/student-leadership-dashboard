"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Download, FileJson, FileSpreadsheet, User, GraduationCap, Smartphone, ArrowRight } from "lucide-react";
import { useSemester } from "@/lib/useSemester";
import { toast } from "sonner";
import { SeedMascot } from "@/components/reflections/PeaceDecor";
import { Stagger, StaggerItem, Bounce } from "@/components/home/motion-kit";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const CREAM = "#FFFAF5";
const MARIGOLD = "#FFB400";
const GRASS = "#7FB800";

const EXPORT_TYPES = [
  { value: "all", label: "Everything" },
  { value: "events", label: "Calendar Events" },
  { value: "tasks", label: "Tasks" },
  { value: "goals", label: "Goals" },
  { value: "reflections", label: "Reflections" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
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
    <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 relative z-20" style={{ background: CREAM, color: "#1a1a1a" }}>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <SeedMascot className="w-11 h-11 shrink-0 animate-soft-bob" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={MARKER}>Settings</h1>
            <p className="text-black/55 text-sm">Manage your account and preferences</p>
          </div>
        </div>

        <Stagger className="space-y-6" gap={0.09}>
        {/* Profile */}
        <StaggerItem>
        <PodCard>
          <CardTitle icon={<User className="w-5 h-5 text-[#8B5CF6]" />}>Profile</CardTitle>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFB400] to-[#7FB800] flex items-center justify-center text-white text-xl font-bold shadow-sm" style={MARKER}>
              {session?.user?.name?.[0] || "?"}
            </div>
            <div>
              <p className="font-semibold text-black/80" style={MARKER}>{session?.user?.name || "User"}</p>
              <p className="text-sm text-black/50">{session?.user?.email || ""}</p>
            </div>
          </div>
        </PodCard>
        </StaggerItem>


        {/* Get the app */}
        <StaggerItem>
        <PodCard>
          <CardTitle icon={<Smartphone className="w-5 h-5 text-[#2792c0]" />}>Get the app</CardTitle>
          <div className="space-y-4">
            <p className="text-sm text-black/55">
              Add Leadership OS to your phone&apos;s home screen for a full-screen
              app — free, no app store, works on iPhone &amp; Android.
            </p>
            <Bounce lift={-2}>
              <Link
                href="/download"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-[filter] bg-[#5BC0EB]"
                style={MARKER}
              >
                <Download className="w-4 h-4" /> How to install
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Bounce>
          </div>
        </PodCard>
        </StaggerItem>

        {/* Semester */}
        <StaggerItem>
        <PodCard>
          <CardTitle icon={<GraduationCap className="w-5 h-5 text-[#FFB400]" />}>Academic Semester</CardTitle>
          <div className="space-y-4">
            <p className="text-xs text-black/50">
              Set your semester dates to see &quot;Week X of Y&quot; on your dashboard.
            </p>
            <div>
              <label className="text-sm font-semibold text-black/70 mb-1 block">Semester name</label>
              <TextInput
                value={semForm.name}
                onChange={(e) => setSemForm({ ...semForm, name: e.target.value })}
                placeholder="e.g. Fall 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-black/70 mb-1 block">Start date</label>
                <TextInput
                  type="date"
                  value={semForm.startDate}
                  onChange={(e) => setSemForm({ ...semForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-black/70 mb-1 block">End date</label>
                <TextInput
                  type="date"
                  value={semForm.endDate}
                  onChange={(e) => setSemForm({ ...semForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-black/70 mb-1 block">Exam period starts</label>
              <TextInput
                type="date"
                value={semForm.examStart}
                onChange={(e) => setSemForm({ ...semForm, examStart: e.target.value })}
              />
            </div>
            <Bounce lift={-2}>
              <button
                onClick={() => {
                  updateSemester(semForm);
                  toast.success("Semester settings saved");
                }}
                className="w-full min-h-[44px] py-3 rounded-full font-semibold text-black/70 bg-[#FFFAF5] border border-black/10 hover:bg-black/[0.03] transition-colors"
                style={MARKER}
              >
                Save Semester
              </button>
            </Bounce>
          </div>
        </PodCard>
        </StaggerItem>

        {/* Export Data */}
        <StaggerItem>
        <PodCard>
          <CardTitle icon={<Download className="w-5 h-5 text-[#4CA80B]" />}>Export Data</CardTitle>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-black/70 mb-2 block">What to export</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full h-11 border border-black/10 rounded-2xl px-3 text-sm bg-[#FFFAF5] text-black focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60"
              >
                {EXPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <Bounce className="flex-1" lift={-2}>
                <button
                  onClick={() => handleExport("json")}
                  disabled={exporting}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-3 rounded-full text-black font-semibold shadow-md hover:brightness-105 transition-[filter] disabled:opacity-50"
                  style={{ background: GRASS, ...MARKER }}
                >
                  <FileJson className="w-4 h-4" />
                  Export JSON
                </button>
              </Bounce>
              <Bounce className="flex-1" lift={-2}>
                <button
                  onClick={() => handleExport("csv")}
                  disabled={exporting}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-black/70 bg-[#FFFAF5] border border-black/10 hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                  style={MARKER}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export CSV
                </button>
              </Bounce>
            </div>
            <p className="text-xs text-black/50">
              Download your data for backup or to use in other tools.
            </p>
          </div>
        </PodCard>
        </StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}

function PodCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white border border-black/5 p-6 shadow-sm">
      {children}
    </div>
  );
}

function CardTitle({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={MARKER}>
      {icon}
      {children}
    </h2>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-11 px-4 rounded-2xl border border-black/10 bg-[#FFFAF5] text-sm text-black placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#FFB400]/60 focus:border-[#FFB400]/60 transition-all"
    />
  );
}
