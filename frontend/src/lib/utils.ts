import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Task } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function taskPrompt(task?: Task) {
  if (!task) return "";
  const payload = task.source_payload;
  for (const key of ["prompt", "french", "source", "text", "instruction"]) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return JSON.stringify(payload, null, 2);
}
