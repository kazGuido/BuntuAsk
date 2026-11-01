import { BookOpen, Briefcase, Coins } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";

const stepIcons = [BookOpen, Briefcase, Coins];
const stepAccents = ["#1cb0f6", "#58cc02", "#ff9600"];

export function FirstRunTour({
  api,
  onComplete,
  onStartTask,
  replayOnly = false,
}: {
  api: ApiClient;
  onComplete: () => void;
  onStartTask: () => void;
  replayOnly?: boolean;
}) {
  const { t } = useI18n();
  const steps = [
    { title: t("tourStep1Title"), body: t("tourStep1Body") },
    { title: t("tourStep2Title"), body: t("tourStep2Body") },
    { title: t("tourStep3Title"), body: t("tourStep3Body") },
  ];
  const [step, setStep] = useState(0);
  const current = steps[step];
  const StepIcon = stepIcons[step];
  const accent = stepAccents[step];

  async function finish(startTask: boolean) {
    if (!replayOnly) {
      await api("/auth/onboarding/complete", { method: "POST" });
    }
    onComplete();
    if (startTask) onStartTask();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <Card className="w-full max-w-lg overflow-hidden">
        <div
          className="-mx-4 -mt-4 mb-4 flex items-center justify-center bg-gradient-to-br from-[#f5f5f0] to-white px-4 py-8 sm:-mx-6 sm:-mt-6"
          aria-hidden
        >
          <div className="relative">
            <svg viewBox="0 0 120 80" className="h-24 w-36 text-[#1cb0f6]/20" fill="currentColor">
              <circle cx="24" cy="40" r="8" />
              <circle cx="60" cy="40" r="8" />
              <circle cx="96" cy="40" r="8" />
              <path d="M32 40h24M64 40h24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
            <div
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              <StepIcon size={28} strokeWidth={2.5} />
            </div>
          </div>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">
          {replayOnly ? t("tourReplayLabel") : `${step + 1}/${steps.length}`}
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#3c3c3c]">{current.title}</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">{current.body}</p>
        <div className="mt-4 flex justify-center gap-2">
          {steps.map((_, index) => (
            <span key={index} className={`h-2 w-8 rounded-full ${index === step ? "bg-[#1cb0f6]" : "bg-gray-200"}`} />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => finish(false)} className="min-h-12 border-gray-300 bg-white text-gray-600">
            {replayOnly ? t("close") : t("tourSkip")}
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((value) => value + 1)} className="min-h-12 flex-1 border-[#1899d6] bg-[#1cb0f6] text-white">
              {t("tourNext")}
            </Button>
          ) : (
            <Button type="button" onClick={() => finish(true)} className="min-h-12 flex-1 border-[#46a302] bg-[#58cc02] text-white">
              {t("tourStart")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
