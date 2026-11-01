import { ClipboardCheck, ClipboardList, Home, Languages, Mic, Shield } from "lucide-react";

import { useKeyboardInset } from "../hooks/useKeyboardInset";
import { useI18n } from "../i18n";
import { View } from "../types";

function isNavActive(view: View, itemId: View): boolean {
  if (view === itemId) return true;
  if (view === "annotate" && itemId === "annotate-translate") return true;
  if (view === "annotate-translate" && itemId === "annotate-translate") return true;
  if (view === "annotate-record" && itemId === "annotate-record") return true;
  return false;
}

export function MobileNav({
  view,
  setView,
  role,
}: {
  view: View;
  setView: (view: View) => void;
  role: string;
}) {
  const { t } = useI18n();
  const keyboardInset = useKeyboardInset();

  const items =
    role === "ANNOTATOR"
      ? [
          { id: "dashboard" as View, label: t("navHome"), icon: Home },
          { id: "annotate-translate" as View, label: t("navTranslate"), icon: Languages },
          { id: "annotate-record" as View, label: t("navRecord"), icon: Mic },
          { id: "your-work" as View, label: t("navWork"), icon: ClipboardList },
        ]
      : role === "REVIEWER"
        ? [
            { id: "dashboard" as View, label: t("navHome"), icon: Home },
            { id: "review" as View, label: t("review"), icon: ClipboardCheck },
          ]
        : role === "ADMIN"
          ? [
              { id: "dashboard" as View, label: t("navHome"), icon: Home },
              { id: "review" as View, label: t("review"), icon: ClipboardCheck },
              { id: "admin" as View, label: t("navAdmin"), icon: Shield },
            ]
          : [
              { id: "dashboard" as View, label: t("navHome"), icon: Home },
              { id: "review" as View, label: t("review"), icon: ClipboardCheck },
            ];

  const colClass =
    items.length <= 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur sm:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        transform: keyboardInset > 0 ? `translateY(-${keyboardInset}px)` : undefined,
      }}
    >
      <div className={`mx-auto grid max-w-lg gap-1 px-2 py-1 ${colClass}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(view, item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={
                active
                  ? "flex min-h-11 flex-col items-center justify-center rounded-xl bg-[#1cb0f6]/10 text-[#1cb0f6]"
                  : "flex min-h-11 flex-col items-center justify-center rounded-xl text-gray-500"
              }
            >
              <Icon size={18} />
              <span className="mt-0.5 text-xs font-black leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
