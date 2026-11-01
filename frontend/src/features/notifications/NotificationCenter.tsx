import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";
import { Notification } from "../../types";

function friendlyCategory(category: string) {
  if (category === "TASK") return "Task update";
  if (category === "ACCOUNT") return "Account";
  if (category === "FRAUD") return "Quality";
  if (category === "REVIEW") return "Review";
  return category.replaceAll("_", " ").toLowerCase();
}

export function NotificationCenter({ api }: { api: ApiClient }) {
  const { t } = useI18n();
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

  const unread = notifications.filter((item) => !item.is_read);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          load();
        }}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        title={t("notifications")}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#ff4b4b] px-1.5 py-0.5 text-[10px] font-black text-white">{count}</span>
        )}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("notifications")}
        headerAction={
          <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-400" onClick={() => setOpen(false)} aria-label={t("close")}>
            <X size={18} />
          </button>
        }
      >
        <div className="max-h-96 space-y-3 overflow-auto pr-1">
          {notifications.map((notification) => (
            <div key={notification.id} className={notification.is_read ? "rounded-2xl bg-gray-50 p-3" : "rounded-2xl bg-sky-50 p-3"}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">{friendlyCategory(notification.category)}</p>
                  <h3 className="font-black text-[#3c3c3c]">{notification.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-gray-600">{notification.body}</p>
                  {notification.category === "TASK" && notification.body.toLowerCase().includes("lock") && (
                    <p className="mt-2 text-xs font-bold text-orange-600">{t("notificationLockHint")}</p>
                  )}
                </div>
                {!notification.is_read && (
                  <button type="button" className="shrink-0 text-xs font-black uppercase text-[#1cb0f6]" onClick={() => markRead(notification.id)}>
                    {t("markRead")}
                  </button>
                )}
              </div>
            </div>
          ))}
          {!notifications.length && <p className="rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-400">{t("noNotifications")}</p>}
        </div>
        {unread.length > 0 && (
          <Button
            className="mt-4 min-h-12 w-full border-[#1899d6] bg-[#1cb0f6] text-white"
            onClick={async () => {
              for (const notification of unread) {
                await api(`/notifications/${notification.id}/read`, { method: "POST" });
              }
              await load();
            }}
          >
            {t("markAllRead")}
          </Button>
        )}
      </Dialog>
    </>
  );
}
