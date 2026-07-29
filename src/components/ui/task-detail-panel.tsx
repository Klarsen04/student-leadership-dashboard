"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, MapPin, Tag, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TaskDetailEvent {
  id: string;
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string;
  category?: string;
  role?: string;
  description?: string;
}

interface TaskDetailPanelProps {
  event: TaskDetailEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  accentColor?: string;
}

export function TaskDetailPanel({
  event,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  accentColor = "#7c3aed",
}: TaskDetailPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && event && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed top-0 right-0 z-50 h-full w-[400px] max-w-[90vw] bg-white rounded-l-2xl shadow-[-8px_0_30px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            {/* Colored accent bar */}
            <div
              className="h-2 w-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-900/95 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white truncate pr-4">
                {event.title}
              </h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Time section */}
              <div className="flex items-start gap-3 pb-5 border-b border-gray-100">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Time
                  </p>
                  <p className="text-base text-gray-900">
                    {format(new Date(event.startTime), "h:mm a")} &ndash;{" "}
                    {format(new Date(event.endTime), "h:mm a")}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* Location section */}
              {event.location && (
                <div className="flex items-start gap-3 pb-5 border-b border-gray-100">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Location
                    </p>
                    <p className="text-base text-gray-900">{event.location}</p>
                  </div>
                </div>
              )}

              {/* Category/Tag section */}
              {(event.category || event.role) && (
                <div className="flex items-start gap-3 pb-5 border-b border-gray-100">
                  <Tag className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Category
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {event.category && (
                        <span
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white"
                          )}
                          style={{ backgroundColor: accentColor }}
                        >
                          {event.category}
                        </span>
                      )}
                      {event.role && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {event.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Description section */}
              {event.description && (
                <div className="pb-5 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Description
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* Actions footer */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/80">
              <Button
                variant="outline"
                className="flex-1 gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => onDelete(event.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
