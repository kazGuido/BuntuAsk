import { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "pressable rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-base",
        className,
      )}
    />
  );
}
