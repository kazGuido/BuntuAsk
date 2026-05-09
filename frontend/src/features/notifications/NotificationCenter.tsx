import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ApiClient } from "../../lib/api";
import { Notification } from "../../types";

export function NotificationCenter({ api }: { api: ApiClient }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  async function load() {
    const [countData, notificationData] = await Promise.all([
      api<{ count: number }>("/notifications/unread-count"),
      api<Notification[]>("/notifications"),
    ]);
    setCount(countData.count);
    setNotifications(notificationData);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function markRead(notificationId: number) {
    await api(`/notifications/${notificationId}/read`, { method: "POST" });
    await load();
  }

  return (
    <>
      <button onClick={() => { setOpen(true); load(); }} className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100" title="Notifications">
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#ff4b4b] px-1.5 py-0.5 text-[10px] font-black text-white">
            {count}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Notifications">
        <div className="max-h-96 space-y-3 overflow-auto pr-1">
          {notifications.map((notification) => (
            <div key={notification.id} className={notification.is_read ? "rounded-2xl bg-gray-50 p-3" : "rounded-2xl bg-sky-50 p-3"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">{notification.category}</p>
                  <h3 className="font-black text-[#3c3c3c]">{notification.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-gray-600">{notification.body}</p>
                  <p className="mt-2 text-[11px] font-bold text-gray-400">
                    {notification.deliveries.map((delivery) => `${delivery.channel}:${delivery.status}`).join(" | ")}
                  </p>
                </div>
                {!notification.is_read && (
                  <button className="text-xs font-black uppercase text-[#1cb0f6]" onClick={() => markRead(notification.id)}>
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
          {!notifications.length && <p className="rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-400">No notifications yet.</p>}
        </div>
        {notifications.some((item) => !item.is_read) && (
          <Button
            className="mt-4 w-full border-[#1899d6] bg-[#1cb0f6] text-white"
            onClick={async () => {
              for (const notification of notifications.filter((item) => !item.is_read)) {
                await api(`/notifications/${notification.id}/read`, { method: "POST" });
              }
              await load();
            }}
          >
            Mark all read
          </Button>
        )}
      </Dialog>
    </>
  );
}
