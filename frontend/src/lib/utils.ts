import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Task } from "../types";
import { humanTaskPrompt } from "./taskDisplay";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated Prefer humanTaskPrompt from taskDisplay */
export function taskPrompt(task?: Task) {
  return humanTaskPrompt(task);
}
