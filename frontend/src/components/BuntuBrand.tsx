import { ReactNode } from "react";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useI18n } from "../i18n";

export function BuntuWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5a5a40] text-lg font-black text-white shadow-sm">
        B
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#58cc02] ring-2 ring-white" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-black tracking-tight text-[#3c3c3c]">
          Buntu<span className="text-[#58cc02]">Ask</span>
        </span>
        <span className="hidden text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 sm:inline">Learn · Work · Earn</span>
      </span>
    </span>
  );
}

export function PrivacyNoticeBody() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 text-sm font-semibold leading-relaxed text-gray-600">
      <p>{t("privacyIntro")}</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>{t("privacyPhone")}</li>
        <li>{t("privacyIp")}</li>
        <li>{t("privacyRetention")}</li>
      </ul>
      <p className="text-xs font-bold text-gray-400">{t("privacyContact")}</p>
    </div>
  );
}

export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-labelledby="privacy-title">
      <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <h2 id="privacy-title" className="text-xl font-black text-[#3c3c3c]">
          {t("privacyTitle")}
        </h2>
        <div className="mt-4">
          <PrivacyNoticeBody />
        </div>
        <Button type="button" onClick={onClose} className="mt-6 min-h-11 w-full border-gray-300 bg-white text-gray-600">
          {t("close")}
        </Button>
      </Card>
    </div>
  );
}

export function BrandedEmptyState({
  title,
  message,
  guidance,
  onDone,
  doneLabel,
  icon,
}: {
  title: string;
  message: string;
  guidance?: string;
  onDone: () => void;
  doneLabel?: string;
  icon?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Card className="mx-auto max-w-lg border-[#1cb0f6]/15 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#58cc02]/20 to-[#1cb0f6]/20 text-[#46a302]">
        {icon ?? (
          <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
            <rect x="8" y="12" width="32" height="24" rx="6" fill="currentColor" opacity="0.25" />
            <path d="M16 24h16M16 30h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1cb0f6]">{t("landingHeroTitle")}</p>
      <h2 className="mt-2 text-2xl font-black text-[#3c3c3c]">{title}</h2>
      <p className="my-3 text-sm font-bold text-gray-500">{message}</p>
      {guidance && <p className="mb-4 text-xs font-semibold text-gray-400">{guidance}</p>}
      <Button onClick={onDone} className="border-[#1899d6] bg-[#1cb0f6] text-white">
        {doneLabel ?? t("emptyStateReturn")}
      </Button>
    </Card>
  );
}
