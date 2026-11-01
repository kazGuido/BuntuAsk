import type { ComponentType } from "react";

import BI from "country-flag-icons/react/3x2/BI";
import CD from "country-flag-icons/react/3x2/CD";
import CN from "country-flag-icons/react/3x2/CN";
import FR from "country-flag-icons/react/3x2/FR";
import GB from "country-flag-icons/react/3x2/GB";
import KE from "country-flag-icons/react/3x2/KE";
import RW from "country-flag-icons/react/3x2/RW";
import TZ from "country-flag-icons/react/3x2/TZ";
import UG from "country-flag-icons/react/3x2/UG";
import US from "country-flag-icons/react/3x2/US";

type FlagProps = { className?: string; title?: string };

const FLAGS: Record<string, ComponentType<FlagProps>> = {
  BI,
  CD,
  CN,
  FR,
  GB,
  KE,
  RW,
  TZ,
  UG,
  US,
};

type Props = {
  countryCode: string;
  className?: string;
  title?: string;
};

/** Bundled 3×2 SVG flags — does not rely on system emoji fonts. */
export function CountryFlag({ countryCode, className, title }: Props) {
  const Flag = FLAGS[countryCode.toUpperCase()];
  if (!Flag) {
    return (
      <span
        className={className}
        title={title}
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1.5rem",
          height: "1rem",
          borderRadius: 2,
          background: "#e5e7eb",
          fontSize: "0.55rem",
          fontWeight: 800,
          color: "#6b7280",
        }}
      >
        {countryCode.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <Flag className={className} title={title} />;
}
