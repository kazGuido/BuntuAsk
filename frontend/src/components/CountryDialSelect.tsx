import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { COUNTRY_DIALS, type CountryDial } from "../lib/phone";
import { cn } from "../lib/utils";
import { CountryFlag } from "./CountryFlag";

type Props = {
  value: string;
  onChange: (dial: string) => void;
  id?: string;
};

function countryForDial(dial: string): CountryDial | undefined {
  return COUNTRY_DIALS.find((item) => item.dial === dial);
}

export function CountryDialSelect({ value, onChange, id }: Props) {
  const { t } = useI18n();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = countryForDial(value) ?? COUNTRY_DIALS[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-12 min-w-[9.5rem] items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-2 text-sm font-bold outline-none focus:border-[#1cb0f6]"
      >
        <CountryFlag countryCode={selected.code} className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" title={selected.name} />
        <span className="flex-1 text-left">{selected.dial}</span>
        <ChevronDown size={16} className="shrink-0 text-gray-400" aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("countryCode")}
          className="absolute left-0 top-[calc(100%+0.25rem)] z-50 max-h-64 w-[min(100vw-2rem,16rem)] overflow-auto rounded-2xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {COUNTRY_DIALS.map((country) => {
            const active = country.dial === value;
            return (
              <li key={country.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold",
                    active ? "bg-sky-50 text-[#1cb0f6]" : "text-gray-700 hover:bg-gray-50",
                  )}
                  onClick={() => {
                    onChange(country.dial);
                    setOpen(false);
                  }}
                >
                  <CountryFlag countryCode={country.code} className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" title={country.name} />
                  <span className="truncate">{country.name}</span>
                  <span className="ml-auto shrink-0 text-gray-500">{country.dial}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
