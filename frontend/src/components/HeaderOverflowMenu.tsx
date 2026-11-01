import { LogOut, Menu, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NotificationCenter } from "../features/notifications/NotificationCenter";
import { LanguageToggle, useI18n } from "../i18n";
import { ApiClient } from "../lib/api";
import { View } from "../types";

export function HeaderOverflowMenu({
  api,
  onLogout,
  showAdmin,
  onOpenAdmin,
}: {
  api: ApiClient;
  onLogout: () => void;
  showAdmin: boolean;
  onOpenAdmin: (view: View) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="relative sm:hidden" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        aria-expanded={open}
        aria-label={t("landingMenuLabel")}
      >
        <Menu size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-3 shadow-lg">
          <div className="mb-2">
            <LanguageToggle />
          </div>
          <div className="mb-2 flex justify-center">
            <NotificationCenter api={api} />
          </div>
          {showAdmin && (
            <button
              type="button"
              onClick={() => {
                onOpenAdmin("admin");
                setOpen(false);
              }}
              className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-black text-[#5a5a40] hover:bg-gray-50"
            >
              <Shield size={16} /> {t("navAdmin")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-black text-gray-500 hover:bg-gray-50"
          >
            <LogOut size={16} /> {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
