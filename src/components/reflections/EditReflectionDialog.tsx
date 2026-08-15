"use client";

import { useState } from "react";
import { toast } from "sonner";
import { parseQA, type QA, type Reflection } from "@/lib/reflections";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;
const GRASS = "#7FB800";

/**
 * Edit a saved reflection: per-question answers (when Q&A pairs exist),
 * free-form content otherwise, plus the gratitude line.
 */
export function EditReflectionDialog({
  reflection,
  onClose,
  onSaved,
}: {
  reflection: Reflection;
  onClose: () => void;
  onSaved: (updated: Reflection) => void;
}) {
  const qa = parseQA(reflection.questions);
  const [answers, setAnswers] = useState<string[]>(
    qa.length > 0 ? qa.map((x) => x.answer) : [reflection.content]
  );
  const [gratitude, setGratitude] = useState(reflection.gratitude || "");
  const [saving, setSaving] = useState(false);

  const hasEmpty = answers.some((a) => !a.trim());

  const save = async () => {
    if (hasEmpty) {
      toast.error("Please fill in every answer before saving.");
      return;
    }
    setSaving(true);
    let content: string;
    let questions: string | undefined;
    if (qa.length > 0) {
      const merged: QA[] = qa.map((x, i) => ({ question: x.question, answer: answers[i]?.trim() ?? "" }));
      content = merged.map((x) => `${x.question}\n${x.answer}`).join("\n\n");
      questions = JSON.stringify(merged);
    } else {
      content = answers[0]?.trim() ?? "";
    }
    try {
      const res = await fetch("/api/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reflection.id, content, gratitude, questions }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      toast.success("Reflection updated");
      onSaved(updated);
    } catch {
      toast.error("Failed to update reflection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"
        style={{ color: "#1a1a1a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold" style={MARKER}>
          Edit reflection
        </h2>
        <div className="mt-4 space-y-4">
          {qa.length > 0 ? (
            qa.map((item, i) => (
              <div key={i}>
                <label className="text-xs font-semibold text-black/60">{item.question}</label>
                <textarea
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                  className="mt-1 w-full min-h-[80px] rounded-2xl bg-[#FFFAF5] border border-black/10 p-3 text-sm focus:outline-none focus:ring-2 resize-none"
                />
              </div>
            ))
          ) : (
            <textarea
              value={answers[0] ?? ""}
              onChange={(e) => setAnswers([e.target.value])}
              className="w-full min-h-[140px] rounded-2xl bg-[#FFFAF5] border border-black/10 p-3 text-sm focus:outline-none focus:ring-2 resize-none"
            />
          )}
          <div>
            <label className="text-xs font-semibold text-black/60">Grateful for</label>
            <input
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-[#FFFAF5] border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-medium text-black/60 hover:bg-black/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || hasEmpty}
            className="px-5 py-2 rounded-full text-sm font-semibold text-black shadow-md hover:brightness-105 transition-all disabled:opacity-50"
            style={{ background: GRASS }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
