export type CountryDial = {
  code: string;
  dial: string;
  name: string;
};

export const COUNTRY_DIALS: CountryDial[] = [
  { code: "BI", dial: "+257", name: "Burundi" },
  { code: "RW", dial: "+250", name: "Rwanda" },
  { code: "TZ", dial: "+255", name: "Tanzania" },
  { code: "CD", dial: "+243", name: "DR Congo" },
  { code: "UG", dial: "+256", name: "Uganda" },
  { code: "KE", dial: "+254", name: "Kenya" },
  { code: "CN", dial: "+86", name: "China" },
  { code: "US", dial: "+1", name: "United States" },
  { code: "FR", dial: "+33", name: "France" },
  { code: "GB", dial: "+44", name: "United Kingdom" },
];

const LOCALE_DEFAULT: Record<string, string> = {
  bi: "+257",
  rn: "+257",
  fr: "+257",
  en: "+257",
  rw: "+250",
  sw: "+255",
};

export function defaultDialCode(): string {
  const locale = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  const region = locale.split("-")[1]?.toUpperCase();
  if (region) {
    const match = COUNTRY_DIALS.find((item) => item.code === region);
    if (match) return match.dial;
  }
  const lang = locale.split("-")[0];
  return LOCALE_DEFAULT[lang] || "+257";
}

export function toE164(dial: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D/g, "");
  const prefix = dial.replace(/\D/g, "");
  if (!digits) return "";
  return `+${prefix}${digits}`;
}

export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
