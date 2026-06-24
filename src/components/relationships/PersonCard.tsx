"use client";

import { useState } from "react";
import { MessageCircle, Clock, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Person {
  id: string;
  name: string;
  context: string;
  lastContactDate: string | null;
  followUpDate: string | null;
  notes: string | null;
  prayerRequests: string | null;
  interactions: { id: string; type: string; date: string; notes: string | null }[];
}

const contextColors: Record<string, string> = {
  Resident: "bg-green-100 text-green-700",
  "PSG Student": "bg-purple-100 text-purple-700",
  "PHE Contact": "bg-orange-100 text-orange-700",
  InterVarsity: "bg-yellow-100 text-yellow-700",
  Classmate: "bg-blue-100 text-blue-700",
  Staff: "bg-gray-100 text-gray-700",
  Other: "bg-gray-100 text-gray-600",
};

export function PersonCard({
  person,
  onUpdate,
}: {
  person: Person;
  onUpdate: () => void;
}) {
  const [showInteraction, setShowInteraction] = useState(false);
  const [interactionNote, setInteractionNote] = useState("");
  const [interactionType, setInteractionType] = useState("check-in");

  const logInteraction = async () => {
    await fetch("/api/people/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId: person.id,
        type: interactionType,
        notes: interactionNote || null,
      }),
    });
    setShowInteraction(false);
    setInteractionNote("");
    onUpdate();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{person.name}</h3>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              contextColors[person.context] || contextColors.Other
            }`}
          >
            {person.context}
          </span>
        </div>
      </div>

      {person.lastContactDate && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
          <Clock className="w-3 h-3" />
          Last contact{" "}
          {formatDistanceToNow(new Date(person.lastContactDate), {
            addSuffix: true,
          })}
        </p>
      )}

      {person.followUpDate && new Date(person.followUpDate) <= new Date() && (
        <p className="text-xs text-orange-600 font-medium mb-2">
          Follow-up overdue
        </p>
      )}

      {person.notes && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{person.notes}</p>
      )}

      {person.prayerRequests && (
        <p className="text-xs text-gray-500 italic mb-3 line-clamp-1">
          Prayer: {person.prayerRequests}
        </p>
      )}

      {!showInteraction ? (
        <button
          onClick={() => setShowInteraction(true)}
          className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          Log interaction
        </button>
      ) : (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <select
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <option value="check-in">Check-in</option>
            <option value="mentoring">Mentoring session</option>
            <option value="spiritual">Spiritual conversation</option>
            <option value="wellness">Wellness outreach</option>
            <option value="event">Attended event together</option>
            <option value="casual">Casual hangout</option>
          </select>
          <input
            type="text"
            placeholder="Quick note (optional)"
            value={interactionNote}
            onChange={(e) => setInteractionNote(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          />
          <div className="flex gap-2">
            <button
              onClick={logInteraction}
              className="flex-1 text-sm bg-primary-600 text-white py-1.5 rounded-lg hover:bg-primary-700"
            >
              Save
            </button>
            <button
              onClick={() => setShowInteraction(false)}
              className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
