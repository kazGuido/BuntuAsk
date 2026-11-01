import { AlertTriangle, CheckCircle2, Loader2, QrCode, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";

type WizardStep = 1 | 2 | 3;

function statusToWizardStep(status: string): WizardStep {
  if (status === "open") return 3;
  if (status === "qr_ready" || status === "starting" || status === "connecting") return 2;
  return 1;
}

export function WhatsAppPairingWizard({
  api,
  initialStatus,
  initialQr,
}: {
  api: ApiClient;
  initialStatus: string;
  initialQr: string | null;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState(initialStatus);
  const [qr, setQr] = useState<string | null>(initialQr);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualStep, setManualStep] = useState<WizardStep | null>(null);

  const derivedStep = statusToWizardStep(status);
  const step = manualStep && manualStep > derivedStep ? manualStep : derivedStep;

  useEffect(() => {
    let timer: number | undefined;
    async function refresh() {
      try {
        const statusData = await api<{ status: string }>("/whatsapp/status");
        setStatus(statusData.status);
        setError("");
        if (statusData.status === "qr_ready" || statusData.status === "starting" || statusData.status === "connecting") {
          const qrData = await api<{ qr: string | null }>("/whatsapp/qr");
          setQr(qrData.qr);
          setManualStep(2);
        } else if (statusData.status === "open") {
          setQr(null);
          setManualStep(3);
        }
      } catch {
        setStatus("offline");
        setError(t("waWizardSidecarError"));
      }
    }
    refresh();
    timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [api, t]);

  const steps = useMemo(
    () => [
      { n: 1, label: t("waWizardStep1Title") },
      { n: 2, label: t("waWizardStep2Title") },
      { n: 3, label: t("waWizardStep3Title") },
    ],
    [t],
  );

  async function startPairing() {
    setBusy(true);
    setError("");
    try {
      await api("/whatsapp/reset", { method: "POST" });
      setStatus("starting");
      setQr(null);
      setManualStep(2);
    } catch {
      setError(t("waWizardResetFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function refreshQr() {
    setBusy(true);
    try {
      const qrData = await api<{ qr: string | null }>("/whatsapp/qr");
      setQr(qrData.qr);
    } catch {
      setError(t("waWizardSidecarError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-xl font-black">
        <QrCode /> {t("whatsappPanel")}
      </h2>
      <p className="mb-4 text-sm font-semibold text-gray-500">{t("waWizardIntro")}</p>

      <ol className="mb-5 grid gap-2 sm:grid-cols-3">
        {steps.map((item) => (
          <li
            key={item.n}
            className={`rounded-2xl px-3 py-2 text-center text-xs font-black ${
              step === item.n ? "bg-[#1cb0f6]/15 text-[#1899d6]" : step > item.n ? "bg-[#58cc02]/10 text-[#46a302]" : "bg-gray-50 text-gray-400"
            }`}
          >
            {item.n}. {item.label}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} /> {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-600">{t("waWizardStep1Body")}</p>
          <p className="text-xs font-bold text-gray-400">
            {t("sidecarStatus")}: {status}
          </p>
          <Button type="button" disabled={busy} onClick={startPairing} className="min-h-11 w-full border-[#1899d6] bg-[#1cb0f6] text-white">
            {busy ? t("working") : t("waWizardStart")}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-600">
            <Smartphone size={18} className="text-[#25D366]" /> {t("waWizardStep2Body")}
          </p>
          <p className="text-xs font-bold text-gray-400">
            {t("sidecarStatus")}: {status}
          </p>
          {qr ? (
            <img src={qr} alt="WhatsApp QR" className="mx-auto w-56 rounded-2xl border-4 border-white bg-white shadow-md" />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-gray-50 p-6">
              <Loader2 className="animate-spin text-[#1cb0f6]" size={32} />
              <p className="text-sm font-bold text-gray-500">{t("qrNotReady")}</p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" disabled={busy} onClick={refreshQr} className="min-h-11 border-gray-300 bg-white text-gray-600">
              {t("whatsappRefreshQr")}
            </Button>
            <Button type="button" disabled={busy} onClick={startPairing} className="min-h-11 border-[#cc3f3f] bg-[#ff4b4b] text-white">
              {t("waWizardRetry")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl bg-[#58cc02]/10 p-5 text-center">
          <CheckCircle2 className="mx-auto text-[#46a302]" size={48} />
          <p className="mt-3 text-lg font-black text-[#3c3c3c]">{t("waWizardSuccessTitle")}</p>
          <p className="mt-2 text-sm font-semibold text-gray-600">{t("waWizardSuccessBody")}</p>
          <Button type="button" disabled={busy} onClick={startPairing} className="mt-4 min-h-11 border-gray-300 bg-white text-gray-600">
            {t("whatsappLogout")}
          </Button>
        </div>
      )}
    </Card>
  );
}
