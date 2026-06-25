"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "event" | "task";
  title: string;
  message: string;
  time: string;
  url: string;
  taskId?: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionGranted(Notification.permission === "granted");
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markTaskDone = async (notification: Notification) => {
    if (!notification.taskId) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.taskId, status: "done" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task completed!");
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch {
      toast.error("Failed to update task");
    }
  };

  const dismissNotification = async (notification: Notification) => {
    if (notification.taskId) {
      try {
        await fetch(`/api/tasks?id=${notification.taskId}`, { method: "DELETE" });
        toast.success("Task deleted");
      } catch {
        toast.error("Failed to delete task");
      }
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
  };

  const enablePush = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setPermissionGranted(permission === "granted");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Notifications
            {!permissionGranted && (
              <Button variant="outline" size="sm" onClick={enablePush}>
                Enable push
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {notifications.length > 0
              ? `${notifications.length} item${notifications.length > 1 ? "s" : ""} need attention`
              : "You're all caught up"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              All caught up!
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <Badge variant={n.type === "event" ? "default" : "secondary"}>
                  {n.type === "event" ? "Event" : "Task"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
                {n.type === "task" && n.taskId && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => markTaskDone(n)}
                      className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-muted-foreground hover:text-green-600 transition-colors"
                      title="Mark done"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => dismissNotification(n)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
