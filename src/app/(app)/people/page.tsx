"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { UserPlus, Search, MessageCircle, Clock, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PERSON_CATEGORIES } from "@/lib/utils";

interface Person {
  id: string;
  name: string;
  category: string;
  email: string | null;
  phone: string | null;
  dateMet: string | null;
  notes: string | null;
  prayerRequests: string | null;
  goals: string | null;
  tags: string | null;
  followUpDate: string | null;
  lastContactDate: string | null;
  interactions: { id: string; type: string; date: string; notes: string | null }[];
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const fetchPeople = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    const res = await fetch(`/api/people?${params}`);
    if (res.ok) setPeople(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchPeople();
  }, [filterCategory]);

  const filtered = search
    ? people.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : people;

  const needsFollowUp = filtered.filter(
    (p) => p.followUpDate && new Date(p.followUpDate) <= new Date()
  );
  const others = filtered.filter(
    (p) => !p.followUpDate || new Date(p.followUpDate) > new Date()
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-muted-foreground text-sm">
            {people.length} people tracked
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Person
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Person</DialogTitle>
            </DialogHeader>
            <AddPersonForm
              onSaved={() => {
                setShowAdd(false);
                fetchPeople();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterCategory === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("")}
          >
            All
          </Button>
          {PERSON_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : (
        <>
          {/* Follow-ups Due Section */}
          {needsFollowUp.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-orange-600 uppercase mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Follow-up Due ({needsFollowUp.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {needsFollowUp.map((person) => (
                  <PersonCard key={person.id} person={person} onUpdate={fetchPeople} />
                ))}
              </div>
            </div>
          )}

          {/* All Others */}
          <div>
            {needsFollowUp.length > 0 && (
              <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                All People ({others.length})
              </h2>
            )}
            {others.length === 0 && needsFollowUp.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No people yet. Add someone to start tracking relationships.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {others.map((person) => (
                  <PersonCard key={person.id} person={person} onUpdate={fetchPeople} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PersonCard({ person, onUpdate }: { person: Person; onUpdate: () => void }) {
  const [showInteraction, setShowInteraction] = useState(false);
  const [interactionType, setInteractionType] = useState("check-in");
  const [interactionNote, setInteractionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const logInteraction = async () => {
    setSaving(true);
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
    setSaving(false);
    onUpdate();
  };

  const isOverdue = person.followUpDate && new Date(person.followUpDate) <= new Date();

  return (
    <Card className={isOverdue ? "border-orange-200" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{person.name}</h3>
            <Badge variant="secondary" className="mt-1">
              {person.category}
            </Badge>
          </div>
        </div>

        {person.lastContactDate && (
          <p className="text-xs text-muted-foreground mt-2">
            Last contact:{" "}
            {formatDistanceToNow(new Date(person.lastContactDate), { addSuffix: true })}
          </p>
        )}

        {isOverdue && (
          <p className="text-xs text-orange-600 font-medium mt-1">
            Follow-up due {format(new Date(person.followUpDate!), "MMM d")}
          </p>
        )}

        {person.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {person.notes}
          </p>
        )}

        {person.prayerRequests && (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
            Prayer: {person.prayerRequests}
          </p>
        )}

        <div className="mt-3 pt-3 border-t">
          {!showInteraction ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInteraction(true)}
              className="w-full justify-start"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-2" />
              Log interaction
            </Button>
          ) : (
            <div className="space-y-2">
              <select
                value={interactionType}
                onChange={(e) => setInteractionType(e.target.value)}
                className="w-full text-sm border rounded-md px-2 py-1.5"
              >
                <option value="check-in">Check-in</option>
                <option value="mentoring">Mentoring</option>
                <option value="spiritual">Spiritual conversation</option>
                <option value="wellness">Wellness outreach</option>
                <option value="event">Event together</option>
                <option value="casual">Casual</option>
                <option value="meeting">Meeting</option>
              </select>
              <Input
                placeholder="Quick note..."
                value={interactionNote}
                onChange={(e) => setInteractionNote(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={logInteraction} disabled={saving} className="flex-1">
                  {saving ? "..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowInteraction(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddPersonForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    category: "Resident",
    email: "",
    phone: "",
    notes: "",
    prayerRequests: "",
    goals: "",
    tags: "",
    followUpDate: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) onSaved();
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Full name"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Category *</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full h-10 border rounded-md px-3 text-sm"
        >
          {PERSON_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Phone</label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Follow-up date</label>
        <Input
          type="date"
          value={form.followUpDate}
          onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Notes</label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="How did you meet? Context?"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Goals for this person</label>
        <Input
          value={form.goals}
          onChange={(e) => setForm({ ...form, goals: e.target.value })}
          placeholder="What do you want to help them with?"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Prayer requests</label>
        <Textarea
          value={form.prayerRequests}
          onChange={(e) => setForm({ ...form, prayerRequests: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Tags</label>
        <Input
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Comma-separated tags"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving || !form.name}>
        {saving ? "Saving..." : "Add Person"}
      </Button>
    </form>
  );
}
