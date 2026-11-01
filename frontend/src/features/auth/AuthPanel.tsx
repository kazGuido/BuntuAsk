import { FormEvent, useState } from "react";

import { PrivacyModal, BuntuWordmark } from "../../components/BuntuBrand";
import { PhoneField } from "../../components/PhoneField";
import { API_PREFIX } from "../../lib/api";
import { isValidE164 } from "../../lib/phone";
import { User } from "../../types";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { LanguageToggle, useI18n } from "../../i18n";

export function AuthPanel({
  onLogin,
  initialMode = "login",
  onBack,
}: {
  onLogin: (token: string, user: User) => void;
  initialMode?: "login" | "register";
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [whatsappE164, setWhatsappE164] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "register" && !isValidE164(whatsappE164)) {
      setError(t("phoneInvalid"));
      return;
    }
    if (mode === "register" && !privacyAccepted) {
      setError(t("privacyConsentRequired"));
      return;
    }
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            username_or_email: String(form.get("username_or_email")),
            password: String(form.get("password")),
          }
        : {
            username: String(form.get("username")),
            email: String(form.get("email")),
            whatsapp_number: String(form.get("whatsapp_number")),
            password: String(form.get("password")),
            privacy_consent: true,
          };

    try {
      const response = await fetch(`${API_PREFIX}/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || t("authFailed"));
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f5f5f0] p-4">
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <div
        className="absolute right-4 top-4 flex items-center gap-2"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        {onBack && (
          <button type="button" onClick={onBack} className="min-h-11 rounded-2xl px-3 text-sm font-black text-[#1cb0f6]">
            {t("back")}
          </button>
        )}
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BuntuWordmark className="scale-110" />
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={
                mode === item
                  ? "min-h-11 rounded-xl bg-white px-3 py-2 text-sm font-black text-[#1cb0f6] shadow"
                  : "min-h-11 rounded-xl px-3 py-2 text-sm font-black text-gray-400"
              }
            >
              {item === "login" ? t("loginTab") : t("registerTab")}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" ? (
            <>
              <div>
                <Input name="username" placeholder={t("username")} required className="min-h-12" />
                <p className="mt-1 text-xs font-semibold text-gray-500">{t("usernameHint")}</p>
              </div>
              <div>
                <Input name="email" placeholder={t("email")} type="email" required className="min-h-12" />
                <p className="mt-1 text-xs font-semibold text-gray-500">{t("emailHint")}</p>
              </div>
              <PhoneField required onE164Change={setWhatsappE164} />
            </>
          ) : (
            <Input name="username_or_email" placeholder={t("usernameOrEmail")} required className="min-h-12" />
          )}
          <div>
            <Input name="password" placeholder={t("password")} type="password" minLength={8} required className="min-h-12" />
            <p className="mt-1 text-xs font-semibold text-gray-500">{t("passwordHint")}</p>
          </div>
          {mode === "register" && (
            <label className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                className="mt-1"
                required
              />
              <span>
                {t("privacyConsentLabel")}{" "}
                <button type="button" onClick={() => setPrivacyOpen(true)} className="font-black text-[#1cb0f6] underline-offset-2 hover:underline">
                  {t("privacyTitle")}
                </button>
              </span>
            </label>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
          <Button disabled={loading} className="min-h-12 w-full border-[#1899d6] bg-[#1cb0f6] text-white">
            {loading ? t("working") : mode === "login" ? t("enter") : t("createAccountShort")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
