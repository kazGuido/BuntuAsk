import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ApiClient } from "../../lib/api";
import { taskPrompt } from "../../lib/utils";
import { Task } from "../../types";
import { mimeExtension } from "./audio";

type Props = {
  api: ApiClient;
  task: Task;
  submit: (payload: Record<string, unknown>) => Promise<void>;
  error: string;
  setError: (error: string) => void;
};

export function VoiceRecordingCard({ api, task, submit, error, setError }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  async function startRecording() {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/wav";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const recordedBlob = new Blob(chunksRef.current, { type: mimeType });
      stream.getTracks().forEach((track) => track.stop());
      setBlob(recordedBlob);
      setPreviewUrl(URL.createObjectURL(recordedBlob));
      setDurationMs(Date.now() - startedAtRef.current);
      setIsRecording(false);
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function uploadAndSubmit() {
    if (!blob) return;
    setUploading(true);
    try {
      const extension = mimeExtension(blob.type);
      const key = `users/${task.claimed_by_id}/recordings/task-${task.id}-${Date.now()}.${extension}`;
      const upload = await api<{ url: string; key: string }>(
        `/storage/upload-url?key=${encodeURIComponent(key)}&content_type=${encodeURIComponent(blob.type)}`
      );
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!response.ok) throw new Error("Recording upload failed");
      await submit({
        recording_key: upload.key,
        mime_type: blob.type,
        duration_ms: durationMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording submit failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ff9600]">Voice Recording</p>
        <h2 className="text-xl font-black text-[#3c3c3c] sm:text-3xl">Read this prompt clearly</h2>
      </div>
      <div className="rounded-3xl bg-orange-50 p-4 text-lg font-black leading-relaxed text-[#3c3c3c] sm:text-2xl">
        {taskPrompt(task)}
      </div>
      <button
        type="button"
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerCancel={stopRecording}
        className={isRecording ? "flex min-h-28 w-full items-center justify-center gap-3 rounded-[32px] border-b-8 border-red-700 bg-red-500 text-xl font-black uppercase text-white" : "flex min-h-28 w-full items-center justify-center gap-3 rounded-[32px] border-b-8 border-[#46a302] bg-[#58cc02] text-xl font-black uppercase text-white"}
      >
        {isRecording ? <Square /> : <Mic />}
        {isRecording ? "Release to stop" : "Hold to record"}
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" onClick={isRecording ? stopRecording : startRecording} className="border-gray-300 bg-white text-gray-500">
          {isRecording ? "Stop" : "Tap start"}
        </Button>
        <Button type="button" onClick={stopRecording} disabled={!isRecording} className="border-gray-300 bg-white text-gray-500">
          Tap stop
        </Button>
      </div>
      {previewUrl && <audio controls src={previewUrl} className="w-full" />}
      {durationMs > 0 && <p className="text-sm font-bold text-gray-500">Recorded {Math.round(durationMs / 1000)} seconds. You can hold again to re-record.</p>}
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
      <Button disabled={!blob || uploading} onClick={uploadAndSubmit} className="sticky bottom-20 w-full border-[#1899d6] bg-[#1cb0f6] text-white sm:static">
        {uploading ? "Uploading..." : "Submit recording"}
      </Button>
    </Card>
  );
}
