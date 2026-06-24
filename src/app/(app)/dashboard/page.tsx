"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Clock, AlertCircle } from "lucide-react";
import { PersonCard } from "@/components/relationships/PersonCard";
import { AddPersonModal } from "@/components/relationships/AddPersonModal";
import { CONTEXTS } from "@/lib/utils";

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

export default function DashboardPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterContext, setFilterContext] = useState<string>("");

  const fetchPeople = async () => {
    const params = new URLSearchParams();
    if (filterContext) params.set("context", filterContext);
    const res = await fetch(`/api/people?${params}`);
    if (res.ok) setPeople(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchPeople();
  }, [filterContext]);

  const needsFollowUp = people.filter(
    (p) => p.followUpDate && new Date(p.followUpDate) <= new Date()
  );

  const noRecentContact = people.filter((p) => {
    if (!p.lastContactDate) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(p.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince > 14;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Your relationships across campus roles
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Person
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5 text-primary-600" />}
          label="Total People"
          value={people.length}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-orange-500" />}
          label="Follow-ups Due"
          value={needsFollowUp.length}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          label="No Contact (14d+)"
          value={noRecentContact.length}
        />
        <StatCard
          icon={<UserPlus className="w-5 h-5 text-green-600" />}
          label="This Week"
          value={
            people.filter(
              (p) =>
                new Date(p.interactions[0]?.date || 0) >
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length
          }
        />
      </div>

      {/* Follow-ups Section */}
      {needsFollowUp.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Follow-ups Due
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsFollowUp.map((person) => (
              <PersonCard key={person.id} person={person} onUpdate={fetchPeople} />
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterContext("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !filterContext
              ? "bg-primary-100 text-primary-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {CONTEXTS.map((ctx) => (
          <button
            key={ctx}
            onClick={() => setFilterContext(ctx)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterContext === ctx
                ? "bg-primary-100 text-primary-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {ctx}
          </button>
        ))}
      </div>

      {/* People Grid */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : people.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No people yet. Add someone to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} onUpdate={fetchPeople} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddPersonModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchPeople}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
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
