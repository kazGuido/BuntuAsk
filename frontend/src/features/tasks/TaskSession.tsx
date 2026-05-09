import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Sparkles } from "lucide-react";
import { KeyboardEvent, SyntheticEvent, useEffect, useRef, useState } from "react";

import { EmptyState, Loading } from "../../components/Loading";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/input";
import { ApiClient } from "../../lib/api";
import { taskPrompt } from "../../lib/utils";
import { Task } from "../../types";
import { AudioTranscriptionCard } from "./AudioTranscriptionCard";
import { taskWorkflow } from "./audio";
import { VoiceRecordingCard } from "./VoiceRecordingCard";

export function TaskSession({ api, onDone }: { api: ApiClient; onDone: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<Task[]>("/tasks/claim", { method: "POST", body: JSON.stringify({ count: 10 }) })
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    const visibilityHandler = () => {
      if (document.hidden) setTabSwitches((value) => value + 1);
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => document.removeEventListener("visibilitychange", visibilityHandler);
  }, []);

  const current = tasks[index];
  const progress = tasks.length ? ((index + 1) / tasks.length) * 100 : 0;

  function resetForNext() {
    setAnswer("");
    setKeystrokes(0);
    setTabSwitches(0);
    setStartedAt(Date.now());
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function ding() {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.18);
  }

  async function submit(extraPayload: Record<string, unknown> = {}) {
    if (!current || !answer.trim()) return;
    try {
      await api("/tasks/submit", {
        method: "POST",
        body: JSON.stringify({
          task_id: current.id,
          result_payload: { text: answer.trim(), ...extraPayload },
          keystroke_count: keystrokes,
          time_spent_ms: Date.now() - startedAt,
          tab_switches: tabSwitches,
          total_audio_played_ms: Number(extraPayload.total_audio_played_ms || 0),
          unique_audio_coverage_ms: Number(extraPayload.unique_audio_coverage_ms || 0),
        }),
      });
      ding();
      if (index + 1 >= tasks.length) onDone();
      else {
        setIndex((value) => value + 1);
        resetForNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  function blockInput(event: SyntheticEvent) {
    event.preventDefault();
    setError("Manual typing only: paste, drop, and context menu are disabled.");
  }

  if (loading) return <Loading label="Claiming a fresh task batch..." />;
  if (error && !current) return <EmptyState title="No tasks available" message={error} onDone={onDone} />;
  if (!current) return <EmptyState title="All caught up" message="There are no available tasks right now." onDone={onDone} />;
  const workflow = taskWorkflow(current);

  async function submitAudioPayload(payload: Record<string, unknown>) {
    if (!current) return;
    try {
      await api("/tasks/submit", {
        method: "POST",
        body: JSON.stringify({
          task_id: current.id,
          result_payload: payload,
          keystroke_count: keystrokes,
          time_spent_ms: Date.now() - startedAt,
          tab_switches: tabSwitches,
          total_audio_played_ms: Number(payload.total_audio_played_ms || 0),
          unique_audio_coverage_ms: Number(payload.unique_audio_coverage_ms || 0),
        }),
      });
      ding();
      if (index + 1 >= tasks.length) onDone();
      else {
        setIndex((value) => value + 1);
        resetForNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button className="rounded-full p-2 text-gray-400 hover:bg-white" onClick={onDone}>
          x
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
          <motion.div className="h-full rounded-full bg-[#58cc02]" animate={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-black text-gray-400 sm:text-sm">{index + 1}/{tasks.length}</span>
      </div>
      {tabSwitches > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-600">
          <AlertTriangle size={18} /> Tab switching detected.
        </div>
      )}
      {workflow === "AUDIO_TRANSCRIPTION" && (
        <AudioTranscriptionCard key={current.id} api={api} task={current} keystrokes={keystrokes} setKeystrokes={setKeystrokes} submit={submitAudioPayload} error={error} setError={setError} />
      )}
      {workflow === "VOICE_RECORDING" && (
        <VoiceRecordingCard key={current.id} api={api} task={current} submit={submitAudioPayload} error={error} setError={setError} />
      )}
      {workflow !== "AUDIO_TRANSCRIPTION" && workflow !== "VOICE_RECORDING" && (
      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ x: 80, opacity: 0, rotate: 1 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: -80, opacity: 0, rotate: -1 }}>
          <Card className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ce82ff]">Translate or label</p>
              <h2 className="mt-2 text-xl font-black leading-tight text-[#3c3c3c] sm:text-3xl">{taskPrompt(current)}</h2>
            </div>
            <Textarea
              ref={inputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key.length === 1 || event.key === "Backspace") setKeystrokes((value) => value + 1);
              }}
              onPaste={blockInput}
              onDrop={blockInput}
              onContextMenu={blockInput}
              className="min-h-36 bg-gray-50 p-4 text-base font-semibold sm:min-h-48 sm:text-lg"
              placeholder="Type your answer manually..."
            />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3 text-xs font-black uppercase text-gray-400">
                <span>{keystrokes} keys</span>
                <span>{tabSwitches} switches</span>
              </div>
              <Button onClick={() => submit()} className="border-[#1899d6] bg-[#1cb0f6] text-white">
                Submit <Sparkles className="ml-1 inline" size={16} />
              </Button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
      )}
    </div>
  );
}
