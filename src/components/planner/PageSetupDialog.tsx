"use client";

// Paper picker: Template → Page size → Colour → Orientation → Create.
//
// The same dialog does two jobs, which is why it takes a `mode`: "insert" makes
// new pages, "apply" re-papers pages that already exist. Both end in a patch to
// page metadata — a template id, a colour, a size — and never touch a page's
// content, so re-papering a page you've written on keeps every stroke.
//
// Every thumbnail here is the real renderer at a small size, not a screenshot, so
// what you preview is exactly what you get.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { PlannerInfo } from "@/lib/planners";
import {
  DEFAULT_PAGE_COLOR,
  PAGE_COLORS,
  PAGE_SIZES,
  aspectOf,
  isDarkPaper,
  pageDimensions,
  templateDataUrl,
  templateFor,
  templatesByCategory,
  type Orientation,
  type PageGeometry,
  type TemplateCategory,
  type TemplateDefinition,
} from "@/lib/planner-paper";
import {
  pageGeometry,
  turnPaper,
  type NewPageSpec,
  type PageMeta,
  type PatternOverrides,
} from "@/lib/planner-pages";
import { ColorPickerButton } from "@/components/planner/ColorPicker";
import {
  deleteUserTemplate,
  importTemplateFile,
  renameUserTemplate,
  templateImageUrl,
  templateImageUrlNow,
} from "@/lib/planner-user-templates";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

export interface PageSetupDialogProps {
  mode: "insert" | "apply";
  /** 1-based pages this applies to. In insert mode, where the first page lands. */
  positions: number[];
  /** The page to start the picker from — usually the one you're looking at. */
  initial?: PageMeta;
  planner: PlannerInfo;
  customTemplates: TemplateDefinition[];
  onClose: () => void;
  onCreate: (spec: NewPageSpec, count: number) => void;
  onApply: (patch: Partial<Omit<PageMeta, "slot">>) => void;
  /** Re-read the user's templates after one is added, renamed or deleted. */
  onTemplatesChanged: () => void;
  /** Flatten the page you're on into a template. Absent when there's nothing to save. */
  onSaveCurrentAsTemplate?: (name: string) => void;
}

export function PageSetupDialog({
  mode,
  positions,
  initial,
  planner,
  customTemplates,
  onClose,
  onCreate,
  onApply,
  onTemplatesChanged,
  onSaveCurrentAsTemplate,
}: PageSetupDialogProps) {
  const startBg = initial?.background;
  const startTemplate = startBg?.kind === "template" ? startBg.templateId : undefined;

  const [templateId, setTemplateId] = useState(startTemplate ?? "lined");
  const [size, setSize] = useState(initial?.size ?? "");
  const [orientation, setOrientation] = useState<Orientation>(initial?.orientation ?? "portrait");
  const [color, setColor] = useState(initial?.color ?? "");
  const [overrides, setOverrides] = useState<PatternOverrides>(startBg?.overrides ?? {});
  const [custom, setCustom] = useState<PageGeometry>(initial?.custom ?? { w: 595, h: 842 });
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState<TemplateCategory | "All">("All");
  const [tweaking, setTweaking] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const groups = useMemo(() => templatesByCategory(customTemplates), [customTemplates]);
  const shown = useMemo(
    () => (category === "All" ? groups : groups.filter((g) => g.category === category)),
    [groups, category],
  );
  const template = useMemo(() => templateFor(templateId, customTemplates), [templateId, customTemplates]);

  // The page shape: the picker's own choice if it has one, otherwise whatever the
  // starting page (or the notebook) uses, so "apply" doesn't silently resize.
  const geometry = useMemo(() => {
    if (size) return pageDimensions(size, orientation, custom);
    // Turned by the same helper the viewer uses, so the preview can't disagree with the
    // page it's previewing.
    return turnPaper(pageGeometry(initial, planner), orientation);
  }, [size, orientation, custom, initial, planner]);

  const paper = color || template.background || initial?.color || DEFAULT_PAGE_COLOR;

  // A picture template needs its blob resolved before it can be previewed.
  useEffect(() => {
    if (!template.imageKey) { setImageUrl(null); return; }
    setImageUrl(templateImageUrlNow(template.id));
    let alive = true;
    templateImageUrl(template).then((url) => { if (alive) setImageUrl(url); });
    return () => { alive = false; };
  }, [template]);

  // Picking a template adopts its own page shape once, so "Weekly planner" opens
  // landscape without the user having to know that.
  const pick = (t: TemplateDefinition) => {
    setTemplateId(t.id);
    setOverrides({});
    if (t.orientation) setOrientation(t.orientation);
    if (t.size) setSize(t.size);
    if (t.background && !color) setColor(t.background);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const background = {
      kind: "template" as const,
      templateId: template.id,
      overrides: Object.keys(overrides).length ? overrides : undefined,
      imageKey: template.imageKey,
    };
    const shape = {
      color: paper,
      size: size || initial?.size,
      orientation,
      custom: size === "custom" ? custom : initial?.custom,
    };
    if (mode === "insert") onCreate({ background, ...shape }, count);
    else onApply({ background, ...shape });
    onClose();
  };

  const many = positions.length;
  const title =
    mode === "insert"
      ? count > 1
        ? `New pages after page ${Math.max(1, positions[0] - 1)}`
        : "New page"
      : many > 1
        ? `Change the paper on ${many} pages`
        : `Change the paper on page ${positions[0]}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/35 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/5">
          <h2 className="text-[17px] font-bold text-black leading-tight" style={MARKER}>{title}</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded-xl text-black/40 hover:bg-black/5" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Categories */}
          <div className="md:w-40 shrink-0 border-b md:border-b-0 md:border-r border-black/5 p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto">
            {(["All", ...groups.map((g) => g.category)] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as TemplateCategory | "All")}
                className={`px-3 py-1.5 rounded-xl text-left text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                  category === c ? "bg-[#8A6DE9] text-white" : "text-black/55 hover:bg-black/[0.04]"
                }`}
                style={MARKER}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Template gallery */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-[#FAF7F2]">
            {shown.map((group) => (
              <section key={group.category} className="mb-5 last:mb-0">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/35 mb-2">{group.category}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.templates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      def={t}
                      selected={t.id === template.id}
                      color={color || t.background || DEFAULT_PAGE_COLOR}
                      onPick={() => pick(t)}
                      onChanged={onTemplatesChanged}
                    />
                  ))}
                  {group.category === "Custom" && (
                    <CustomTemplateAdders onChanged={onTemplatesChanged} onSaveCurrent={onSaveCurrentAsTemplate} />
                  )}
                </div>
              </section>
            ))}
            {!shown.some((g) => g.category === "Custom") && category === "All" && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/35 mb-2">Custom</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <CustomTemplateAdders onChanged={onTemplatesChanged} onSaveCurrent={onSaveCurrentAsTemplate} />
                </div>
              </section>
            )}
            {category === "Custom" && !shown.length && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <CustomTemplateAdders onChanged={onTemplatesChanged} onSaveCurrent={onSaveCurrentAsTemplate} />
              </div>
            )}
          </div>

          {/* Choices + preview */}
          <div className="md:w-[19rem] shrink-0 border-t md:border-t-0 md:border-l border-black/5 p-4 overflow-y-auto">
            <div className="flex justify-center mb-3">
              <div
                className="rounded-lg overflow-hidden shadow-md ring-1 ring-black/10 bg-white"
                style={{ width: 132, aspectRatio: `${aspectOf(geometry)}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={templateDataUrl(template, {
                    page: geometry,
                    color: paper,
                    overrides,
                    imageUrl: imageUrl ?? undefined,
                    // Drawn 132px wide, so the ruling needs the same help as a thumbnail.
                    shrink: geometry.w / 132,
                  })}
                  alt={template.name}
                  className="w-full h-full"
                  draggable={false}
                />
              </div>
            </div>
            <p className="text-center text-[12px] font-semibold text-black mb-0.5" style={MARKER}>{template.name}</p>
            <p className="text-center text-[11px] text-black/40 mb-4">
              {Math.round(geometry.w / 72 * 10) / 10}″ × {Math.round(geometry.h / 72 * 10) / 10}″
              {template.hint ? ` · ${template.hint}` : ""}
            </p>

            <Field label="Page size">
              <select
                value={size || "keep"}
                onChange={(e) => setSize(e.target.value === "keep" ? "" : e.target.value)}
                className="w-full text-[12.5px] rounded-xl border border-black/10 bg-white px-2.5 py-2"
              >
                <option value="keep">Same as this page</option>
                {PAGE_SIZES.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                <option value="custom">Custom…</option>
              </select>
            </Field>

            {size === "custom" && (
              <div className="flex items-center gap-2 mb-3">
                {(["w", "h"] as const).map((axis) => (
                  <label key={axis} className="flex-1 text-[11px] text-black/45">
                    {axis === "w" ? "Width" : "Height"} (in)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={0.25}
                      value={Math.round((custom[axis] / 72) * 100) / 100}
                      onChange={(e) => {
                        const inches = Number(e.target.value) || 1;
                        setCustom((c) => ({ ...c, [axis]: Math.max(72, Math.min(4320, inches * 72)) }));
                      }}
                      className="w-full mt-0.5 text-[12.5px] rounded-xl border border-black/10 bg-white px-2.5 py-1.5"
                    />
                  </label>
                ))}
              </div>
            )}

            <Field label="Orientation">
              <div className="flex gap-1.5">
                {(["portrait", "landscape"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[12px] font-semibold capitalize transition-colors ${
                      orientation === o ? "bg-black text-white" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"
                    }`}
                    style={MARKER}
                  >
                    <span
                      className={`inline-block rounded-[2px] border-[1.5px] ${orientation === o ? "border-white/80" : "border-black/40"}`}
                      style={o === "portrait" ? { width: 8, height: 11 } : { width: 11, height: 8 }}
                    />
                    {o}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Page colour">
              <div className="flex flex-wrap gap-1.5">
                {PAGE_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={`w-6 h-6 rounded-full ring-1 ring-black/10 flex items-center justify-center transition-transform ${
                      paper.toLowerCase() === c.value.toLowerCase() ? "ring-2 ring-[#8A6DE9] scale-110" : "hover:scale-110"
                    }`}
                    style={{ background: c.value }}
                  >
                    {paper.toLowerCase() === c.value.toLowerCase() && (
                      <Check className={`w-3 h-3 ${isDarkPaper(c.value) ? "text-white" : "text-black/50"}`} />
                    )}
                  </button>
                ))}
                {/* Any colour at all. Only the paper changes — the template, the ruling
                    and everything written on the page are untouched. */}
                <ColorPickerButton
                  name="page"
                  title="Any colour"
                  label="Page colour"
                  color={paper}
                  onChange={setColor}
                  presets={PAGE_COLORS.map((c) => c.value)}
                  className="w-6 h-6 rounded-full ring-1 ring-black/10 flex items-center justify-center hover:scale-110 transition-transform"
                />
              </div>
            </Field>

            {/* Pattern tweaks: spacing, weight, colour, margin. Only meaningful for
                a generated pattern, so hidden for picture templates. */}
            {!template.imageKey && template.pattern !== "blank" && (
              <div className="mb-3">
                <button
                  onClick={() => setTweaking((v) => !v)}
                  className="flex items-center gap-1.5 text-[11.5px] font-semibold text-black/45 hover:text-black/70"
                >
                  <Sliders className="w-3.5 h-3.5" /> Adjust the ruling
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tweaking ? "rotate-180" : ""}`} />
                </button>
                {tweaking && (
                  <div className="mt-2 space-y-2.5">
                    <Slider
                      label="Spacing"
                      min={8}
                      max={48}
                      step={1}
                      value={overrides.spacing ?? template.spacing ?? 24}
                      onChange={(v) => setOverrides((o) => ({ ...o, spacing: v }))}
                      format={(v) => `${Math.round((v / 72) * 25.4)} mm`}
                    />
                    <Slider
                      label="Thickness"
                      min={0.3}
                      max={2}
                      step={0.1}
                      value={overrides.lineWidth ?? template.lineWidth ?? 0.7}
                      onChange={(v) => setOverrides((o) => ({ ...o, lineWidth: v }))}
                      format={(v) => `${v.toFixed(1)} pt`}
                    />
                    <Slider
                      label="Strength"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={overrides.patternOpacity ?? template.patternOpacity ?? 1}
                      onChange={(v) => setOverrides((o) => ({ ...o, patternOpacity: v }))}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                    <Slider
                      label="Margin"
                      min={0}
                      max={90}
                      step={2}
                      value={overrides.margin ?? template.margin ?? 36}
                      onChange={(v) => setOverrides((o) => ({ ...o, margin: v }))}
                      format={(v) => `${Math.round((v / 72) * 25.4)} mm`}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-black/45">Ruling colour</span>
                      <div className="flex items-center gap-1.5">
                        <ColorPickerButton
                          name="ruling"
                          title="Ruling colour"
                          label="Ruling colour"
                          color={overrides.patternColor ?? template.patternColor ?? "#C7D5E2"}
                          onChange={(c) => setOverrides((o) => ({ ...o, patternColor: c }))}
                          presets={["#C7D5E2", "#D9D9D9", "#E7D6C3", "#C9E2D0", "#E2C9DC", "#9AA6B2", "#5A6472"]}
                          className="w-6 h-6 rounded-full ring-1 ring-black/10 flex items-center justify-center hover:scale-110 transition-transform"
                        />
                        <button
                          onClick={() => setOverrides({})}
                          className="p-1 rounded-lg text-black/35 hover:bg-black/5"
                          title="Back to the template's own ruling"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "insert" && (
              <Field label="How many">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`flex-1 py-1.5 rounded-xl text-[12px] font-semibold ${
                        count === n ? "bg-black text-white" : "bg-black/[0.04] text-black/55 hover:bg-black/[0.07]"
                      }`}
                      style={MARKER}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="w-14 text-[12.5px] rounded-xl border border-black/10 bg-white px-2 py-1.5"
                    title="Pages to add"
                  />
                </div>
              </Field>
            )}

            <button
              onClick={submit}
              className="w-full mt-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold bg-[#FFB400] text-black hover:brightness-105 transition-all"
              style={MARKER}
            >
              {mode === "insert"
                ? <><Plus className="w-4 h-4" /> {count > 1 ? `Add ${count} pages` : "Add page"}</>
                : <><Check className="w-4 h-4" /> {many > 1 ? `Apply to ${many} pages` : "Apply"}</>}
            </button>
            {mode === "apply" && (
              <p className="mt-2 text-center text-[11px] text-black/35">Your handwriting stays exactly where it is.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- small parts --------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/35 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-black/45">
        {label}<span className="tabular-nums text-black/35">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#8A6DE9]"
      />
    </label>
  );
}

/** One template thumbnail. Custom ones can be renamed and deleted from here. */
function TemplateCard({ def, selected, color, onPick, onChanged }: {
  def: TemplateDefinition;
  selected: boolean;
  color: string;
  onPick: () => void;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(() => (def.imageKey ? templateImageUrlNow(def.id) : null));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(def.name);

  useEffect(() => {
    if (!def.imageKey) return;
    let alive = true;
    templateImageUrl(def).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [def]);

  const thumbSize = useMemo(() => {
    const g = pageDimensions(def.size, def.orientation ?? "portrait");
    return g;
  }, [def.size, def.orientation]);

  // A template with a paper colour of its own is shown in it — the Basic family is
  // *only* its colour, so previewing those in whatever colour is currently picked
  // would make Blank, Cream, Grey and Dark four identical white cards. Everything
  // else previews in the colour you've chosen. The ruling is thickened for the size
  // it's drawn at, or the finer papers would all look blank.
  const src = templateDataUrl(def, {
    page: thumbSize,
    color: def.background ?? color,
    imageUrl: url ?? undefined,
    shrink: thumbSize.h / 120,
  });

  const commitRename = async () => {
    setRenaming(false);
    const next = name.trim();
    if (!next || next === def.name) { setName(def.name); return; }
    await renameUserTemplate(def.id, next);
    onChanged();
  };

  const remove = async () => {
    await deleteUserTemplate(def.id);
    toast.success(`“${def.name}” deleted`);
    onChanged();
  };

  return (
    <div className="group">
      <button
        onClick={onPick}
        className={`block w-full rounded-xl overflow-hidden bg-white transition-all ${
          selected ? "ring-2 ring-[#8A6DE9] shadow-md" : "ring-1 ring-black/10 hover:ring-black/25 hover:shadow"
        }`}
        style={{ aspectRatio: `${aspectOf(thumbSize)}` }}
        title={def.hint ?? def.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={def.name} className="w-full h-full" draggable={false} />
      </button>
      <div className="flex items-center gap-1 mt-1 px-0.5">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setName(def.name); setRenaming(false); } }}
            className="flex-1 min-w-0 text-[11.5px] rounded-lg border border-black/15 px-1.5 py-0.5"
          />
        ) : (
          <span className={`flex-1 min-w-0 truncate text-[11.5px] ${selected ? "text-black font-semibold" : "text-black/55"}`}>
            {def.name}
          </span>
        )}
        {def.custom && !renaming && (
          <span className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setRenaming(true)} className="p-1 rounded-lg text-black/35 hover:bg-black/5" title="Rename">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={remove} className="p-1 rounded-lg text-red-500 hover:bg-red-50" title="Delete this template">
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/** The two ways to make a template: import a picture, or keep the page you're on. */
function CustomTemplateAdders({ onChanged, onSaveCurrent }: {
  onChanged: () => void;
  onSaveCurrent?: (name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("My paper");

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const t = toast.loading("Making a template from that…");
    try {
      const def = await importTemplateFile(file);
      toast.success(`“${def.name}” added`, { id: t, description: "It's under Custom." });
      onChanged();
    } catch (e: any) {
      toast.error("Couldn't use that file", { id: t, description: e?.message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [onChanged]);

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="rounded-xl border-2 border-dashed border-black/15 hover:border-[#8A6DE9]/60 hover:bg-[#8A6DE9]/[0.04] flex flex-col items-center justify-center gap-1 text-black/45 disabled:opacity-60"
        style={{ aspectRatio: `${595 / 842}` }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        <span className="text-[11px] font-semibold px-2 text-center leading-tight" style={MARKER}>
          Import an image<br />or PDF page
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {onSaveCurrent && (
        <div
          className="rounded-xl border-2 border-dashed border-black/15 flex flex-col items-center justify-center gap-1 p-2"
          style={{ aspectRatio: `${595 / 842}` }}
        >
          {naming ? (
            <>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onSaveCurrent(name.trim() || "My paper"); setNaming(false); }
                  if (e.key === "Escape") setNaming(false);
                }}
                className="w-full text-[11.5px] rounded-lg border border-black/15 px-1.5 py-1"
                placeholder="Template name"
              />
              <button
                onClick={() => { onSaveCurrent(name.trim() || "My paper"); setNaming(false); }}
                className="text-[11px] font-bold text-[#8A6DE9]"
                style={MARKER}
              >
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setNaming(true)}
              className="w-full h-full flex flex-col items-center justify-center gap-1 text-black/45 hover:text-[#8A6DE9]"
            >
              <Save className="w-4 h-4" />
              <span className="text-[11px] font-semibold px-1 text-center leading-tight" style={MARKER}>
                Save this page<br />as a template
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
