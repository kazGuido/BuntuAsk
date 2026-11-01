import { Clock, DollarSign, Languages, Mic, Shield, Tag } from "lucide-react";
import { useState } from "react";

import { BuntuWordmark, PrivacyModal } from "../../components/BuntuBrand";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { LanguageToggle, useI18n } from "../../i18n";

type LandingPageProps = {
  onSignUp: () => void;
  onLogIn: () => void;
  onHowItWorks: () => void;
};

export function LandingPage({ onSignUp, onLogIn, onHowItWorks }: LandingPageProps) {
  const { t } = useI18n();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans">
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <header
        className="sticky top-0 z-40 border-b border-black/10 bg-white/80 px-4 py-3 backdrop-blur sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <BuntuWordmark />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={onLogIn}
              className="hidden min-h-11 rounded-2xl px-4 text-sm font-black text-gray-600 hover:bg-gray-100 sm:inline-flex"
            >
              {t("login")}
            </button>
            <Button type="button" onClick={onSignUp} className="min-h-11 border-[#46a302] bg-[#58cc02] font-black text-white">
              {t("register")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">{t("landingEyebrow")}</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-[#3c3c3c] sm:text-5xl">{t("landingHeroTitle")}</h1>
            <p className="mt-4 text-lg font-bold text-gray-600">{t("landingHeroSubtitle")}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={onSignUp} className="min-h-12 border-[#46a302] bg-[#58cc02] px-8 text-base font-black text-white">
                {t("landingCtaSignUp")}
              </Button>
              <button
                type="button"
                onClick={onLogIn}
                className="min-h-12 rounded-2xl border-2 border-black/10 bg-white px-8 text-base font-black text-[#3c3c3c]"
              >
                {t("login")}
              </button>
            </div>
            <button type="button" onClick={onHowItWorks} className="mt-4 text-sm font-black text-[#1cb0f6] underline-offset-2 hover:underline">
              {t("landingHowItWorksLink")}
            </button>
          </div>

          <Card className="border-[#1cb0f6]/20 bg-white shadow-lg">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">{t("landingPreviewLabel")}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-[#58cc02]/15 px-3 py-1 text-xs font-black text-[#46a302]">{t("translation")}</span>
              <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                <Clock size={14} /> ~1 min
              </span>
            </div>
            <p className="mt-4 text-base font-bold text-[#3c3c3c]">{t("taskJobTranslate")}</p>
            <p className="mt-1 text-sm font-semibold text-gray-500">{t("languagePair")}: EN → RN</p>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f5f5f0] px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-black text-[#46a302]">
                <DollarSign size={16} /> {t("payPerTask")}
              </span>
              <span className="text-lg font-black text-[#46a302]">$0.05</span>
            </div>
            <Button type="button" onClick={onSignUp} className="mt-4 min-h-11 w-full border-[#1899d6] bg-[#1cb0f6] font-black text-white">
              {t("landingTaskStart")}
            </Button>
          </Card>
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-center gap-4 border-y border-black/5 py-6 text-center text-sm font-bold text-gray-500">
          <span>{t("landingProof1")}</span>
          <span className="hidden text-gray-300 sm:inline">·</span>
          <span>{t("landingProof2")}</span>
          <span className="hidden text-gray-300 sm:inline">·</span>
          <span>{t("landingProof3")}</span>
        </section>

        <section id="how-it-works" className="mt-12 scroll-mt-24">
          <h2 className="text-center text-2xl font-black text-[#3c3c3c]">{t("landingHowItWorksTitle")}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { step: "1", title: t("landingStepLearnTitle"), body: t("landingStepLearnBody") },
              { step: "2", title: t("landingStepWorkTitle"), body: t("landingStepWorkBody") },
              { step: "3", title: t("landingStepEarnTitle"), body: t("landingStepEarnBody") },
            ].map((item) => (
              <Card key={item.step} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#1cb0f6] text-sm font-black text-white">
                  {item.step}
                </div>
                <h3 className="mt-3 text-lg font-black text-[#3c3c3c]">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold text-gray-500">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-2xl font-black text-[#3c3c3c]">{t("landingTaskTypesTitle")}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <Languages className="text-[#58cc02]" size={32} />
              <h3 className="mt-3 text-xl font-black">{t("translation")}</h3>
              <p className="mt-2 text-sm font-semibold text-gray-500">{t("translateTasksDescription")}</p>
            </Card>
            <Card>
              <Mic className="text-[#1cb0f6]" size={32} />
              <h3 className="mt-3 text-xl font-black">{t("voiceRecording")}</h3>
              <p className="mt-2 text-sm font-semibold text-gray-500">{t("recordTasksDescription")}</p>
            </Card>
            <Card>
              <Tag className="text-[#5a5a40]" size={32} />
              <h3 className="mt-3 text-xl font-black">{t("imageLabeling")}</h3>
              <p className="mt-2 text-sm font-semibold text-gray-500">{t("landingLabelingBlurb")}</p>
            </Card>
          </div>
        </section>

        <section className="mt-12">
          <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Shield className="shrink-0 text-[#5a5a40]" size={40} />
            <div>
              <h2 className="text-xl font-black text-[#3c3c3c]">{t("landingTrustTitle")}</h2>
              <p className="mt-2 text-sm font-semibold text-gray-500">{t("landingTrustBody")}</p>
            </div>
          </Card>
        </section>

        <section className="mt-12 rounded-3xl bg-[#5a5a40] px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl font-black sm:text-3xl">{t("landingHeroTitle")}</h2>
          <p className="mt-3 font-bold text-white/80">{t("landingHeroSubtitle")}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" onClick={onSignUp} className="min-h-12 border-white/20 bg-[#58cc02] px-8 font-black text-white">
              {t("landingCtaSignUp")}
            </Button>
            <button
              type="button"
              onClick={onLogIn}
              className="min-h-12 rounded-2xl border-2 border-white/40 bg-transparent px-8 font-black text-white"
            >
              {t("login")}
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 px-4 py-8 text-center text-xs font-bold text-gray-400">
        <button type="button" onClick={() => setPrivacyOpen(true)} className="mb-2 block w-full font-black text-[#1cb0f6] hover:underline">
          {t("privacyTitle")}
        </button>
        BuntuAsk · {t("translateReviewEarn")}
      </footer>
    </div>
  );
}
