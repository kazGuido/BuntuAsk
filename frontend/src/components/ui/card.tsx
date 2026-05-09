import { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("chunky rounded-[28px] bg-white p-4 sm:p-6", className)} />;
}
