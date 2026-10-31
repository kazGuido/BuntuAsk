import { Task } from "../types";

const MACHINE_KEY_PATTERN = /^(normalize|tokenize|lemmatize|align|parse)$/i;

function unwrapString(value: string): string {
  const trimmed = value.trim();
  const normalizeMatch = trimmed.match(/^normalize:\s*['"](.+?)['"]\s*$/i);
  if (normalizeMatch) return normalizeMatch[1];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string") return parsed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function humanTaskPrompt(task?: Task): string {
  if (!task) return "";
  const payload = task.source_payload;
  for (const key of ["prompt_text", "prompt", "english", "source", "text", "instruction", "french"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return unwrapString(value);
    }
  }
  for (const [key, value] of Object.entries(payload)) {
    if (MACHINE_KEY_PATTERN.test(key)) continue;
    if (typeof value === "string" && value.trim() && !value.includes("{")) {
      return unwrapString(value);
    }
  }
  return "Complete this task using the guidelines.";
}

export function taskLanguagePair(task?: Task): { source: string; target: string } {
  if (!task) return { source: "English", target: "Kirundi" };
  return {
    source: task.source_language || "English",
    target: task.project_language || "Kirundi",
  };
}

export function formatReward(task?: Task): string {
  if (!task) return "$0.000";
  return `$${(task.reward_usd || 0).toFixed(3)}`;
}

export function workerLevel(tasksCompleted: number): number {
  if (tasksCompleted <= 0) return 1;
  return Math.min(99, 1 + Math.floor(tasksCompleted / 5));
}
