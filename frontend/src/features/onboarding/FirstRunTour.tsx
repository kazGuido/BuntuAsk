import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";

export function FirstRunTour({
  api,
  onComplete,
  onStartTask,
}: {
  api: ApiClient;
  onComplete: () => void;
  onStartTask: () => void;
}) {
  const { t } = useI18n();
  const steps = [
    { title: t("tourStep1Title"), body: t("tourStep1Body") },
    { title: t("tourStep2Title"), body: t("tourStep2Body") },
    { title: t("tourStep3Title"), body: t("tourStep3Body") },
  ];
  const [step, setStep] = useState(0);
  const current = steps[step];

  async function finish(startTask: boolean) {
    await api("/auth/onboarding/complete", { method: "POST" });
    onComplete();
    if (startTask) onStartTask();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <Card className="w-full max-w-lg">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">
          {step + 1}/{steps.length}
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#3c3c3c]">{current.title}</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">{current.body}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => finish(false)} className="min-h-12 border-gray-300 bg-white text-gray-600">
            {t("tourSkip")}
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
