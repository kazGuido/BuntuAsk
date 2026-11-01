import { ClipboardList, Home, Languages, Mic } from "lucide-react";

import { useI18n } from "../i18n";
import { View } from "../types";

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
  if (role === "REVIEWER") return null;

  const items =
    role === "ANNOTATOR"
      ? [
          { id: "dashboard" as View, label: t("navHome"), icon: Home },
          { id: "annotate-translate" as View, label: t("navTranslate"), icon: Languages },
          { id: "annotate-record" as View, label: t("navRecord"), icon: Mic },
          { id: "your-work" as View, label: t("navWork"), icon: ClipboardList },
        ]
      : [
          { id: "dashboard" as View, label: t("navHome"), icon: Home },
          { id: "review" as View, label: t("review"), icon: ClipboardList },
        ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className={`mx-auto grid max-w-lg gap-1 px-2 py-1 ${items.length === 2 ? "grid-cols-2" : "grid-cols-4"}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = view === item.id || (view === "annotate" && item.id.startsWith("annotate"));
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
              <span className="mt-0.5 text-[10px] font-black">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
