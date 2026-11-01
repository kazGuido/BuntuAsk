import { useMemo, useState } from "react";

import { useI18n } from "../i18n";
import { defaultDialCode, isValidE164, toE164 } from "../lib/phone";
import { cn } from "../lib/utils";
import { CountryDialSelect } from "./CountryDialSelect";

type Props = {
  name?: string;
  required?: boolean;
  onE164Change?: (value: string) => void;
};

export function PhoneField({ name = "whatsapp_number", required, onE164Change }: Props) {
  const { t } = useI18n();
  const [dial, setDial] = useState(defaultDialCode);
  const [national, setNational] = useState("");
  const e164 = useMemo(() => toE164(dial, national), [dial, national]);
  const valid = !national || isValidE164(e164);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="country-dial">
          {t("countryCode")}
        </label>
        <CountryDialSelect
          id="country-dial"
          value={dial}
          onChange={(nextDial) => {
            setDial(nextDial);
            onE164Change?.(toE164(nextDial, national));
          }}
        />
        <input
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t("phoneNationalPlaceholder")}
          value={national}
          onChange={(event) => {
            setNational(event.target.value);
            onE164Change?.(toE164(dial, event.target.value));
          }}
          className={cn(
            "min-h-12 flex-1 rounded-2xl border-2 border-gray-200 px-4 font-bold outline-none focus:border-[#1cb0f6]",
            !valid && "border-red-300",
          )}
          aria-invalid={!valid}
          required={required}
        />
      </div>
      <input type="hidden" name={name} value={e164} required={required} />
      <p className="text-xs font-semibold text-gray-500">{t("whatsappHint")}</p>
      {!valid && national && <p className="text-xs font-bold text-red-600">{t("phoneInvalid")}</p>}
    </div>
  );
}
