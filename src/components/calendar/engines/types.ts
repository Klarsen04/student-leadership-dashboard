// Shared contract every calendar engine implements. The page hands each engine the
// same already-filtered data and callbacks, so engines are swappable per sub-calendar.

export interface EngineEvent {
  id: string;
  title: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  category: string;
  role: string;
  location: string | null;
  isLed: boolean;
  description?: string;
}

export interface EngineClass {
  id: string;
  title: string;
  professor: string;
  location: string;
  creditHours: number;
  days: string[];
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  color: string;
}

export type EngineView = "day" | "5day" | "week" | "month";

export interface CalendarEngineProps {
  events: EngineEvent[];
  classes: EngineClass[];
  currentDate: Date;
  view: EngineView;
  /** bg-* tailwind class for a given event category (sub-calendar color) */
  getColor: (category: string) => string;
  onEventClick: (event: EngineEvent) => void;
  onClassClick?: (cls: EngineClass) => void;
  /** Click an empty slot to create — (date, hour) */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  /** Drag an event to a new slot */
  onEventDrop?: (eventId: string, newDate: Date, newHour: number) => void;
  /** Persist a new/updated/deleted event (engines with native editing use these) */
  onEventCreate?: (event: Partial<EngineEvent>) => void | Promise<void>;
  onEventUpdate?: (event: EngineEvent) => void | Promise<void>;
  onEventDelete?: (eventId: string) => void | Promise<void>;
}
