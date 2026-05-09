import { ApiClient } from "../../lib/api";
import { Task } from "../../types";

export function taskWorkflow(task: Task) {
  return String(task.source_payload.workflow || task.source_payload.project_workflow || "");
}

export function audioDurationMs(task: Task) {
  return Number(task.source_payload.duration_ms || task.source_payload.expected_duration_ms || 0);
}

export async function resolveAudioUrl(api: ApiClient, task: Task) {
  const audioUrl = task.source_payload.audio_url;
  if (typeof audioUrl === "string" && audioUrl) return audioUrl;
  const audioKey = task.source_payload.audio_key || task.storage_key;
  if (typeof audioKey !== "string" || !audioKey) return "";
  const result = await api<{ url: string }>(`/storage/download-url?key=${encodeURIComponent(audioKey)}`);
  return result.url;
}

export function mimeExtension(mimeType: string) {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}
