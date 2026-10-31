import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { KeyboardEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState, Loading } from "../../components/Loading";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/input";
import { useKeyboardInset } from "../../hooks/useKeyboardInset";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";
import { formatReward, humanTaskPrompt, taskLanguagePair } from "../../lib/taskDisplay";
import { SessionWorkflow, Task } from "../../types";
import { AudioTranscriptionCard } from "./AudioTranscriptionCard";
import { taskWorkflow } from "./audio";
import { VoiceRecordingCard } from "./VoiceRecordingCard";

function formatCountdown(iso?: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function TaskSession({
  api,
  workflow,
  onDone,
}: {
  api: ApiClient;
  workflow?: SessionWorkflow;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const keyboardInset = useKeyboardInset();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [lockLabel, setLockLabel] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const active = await api<Task[]>("/tasks/active-batch");
        if (active.length) {
          setTasks(active);
          return;
        }
        const body: { count: number; workflow?: SessionWorkflow } = { count: 10 };
        if (workflow) body.workflow = workflow;
        const claimed = await api<Task[]>("/tasks/claim", { method: "POST", body: JSON.stringify(body) });
        setTasks(claimed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load tasks");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [api, workflow]);

  useEffect(() => {
    const visibilityHandler = () => {
      if (document.hidden) setTabSwitches((value) => value + 1);
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => document.removeEventListener("visibilitychange", visibilityHandler);
  }, []);

  useEffect(() => {
    const lockedUntil = tasks[0]?.locked_until;
    if (!lockedUntil) return;
    const tick = () => setLockLabel(formatCountdown(lockedUntil));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  const current = tasks[index];
  const progress = tasks.length ? ((index + 1) / tasks.length) * 100 : 0;
  const pair = useMemo(() => taskLanguagePair(current), [current]);

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

  async function leaveSession() {
    await api("/tasks/release-batch", { method: "POST" });
    setLeaveOpen(false);
    onDone();
  }

  async function submit(extraPayload: Record<string, unknown> = {}) {
    if (!current) return;
    if (!answer.trim() && !extraPayload.recording_key) {
      setError(t("answerRequired"));
      return;
    }
    setError("");
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
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 900);
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
    setError(t("manualTypingOnly"));
  }

  if (loading) return <Loading label={t("claimingBatch")} />;
  if (error && !current) return <EmptyState title={t("noTasksAvailable")} message={error} onDone={onDone} />;
  if (!current) return <EmptyState title={t("allCaughtUp")} message={t("noTasksNow")} onDone={onDone} />;
  const flow = taskWorkflow(current);

  async function submitAudioPayload(payload: Record<string, unknown>) {
    if (!current) return;
    setError("");
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
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 900);
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
    <div className="mx-auto max-w-2xl pb-28">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-11 min-w-11 rounded-full text-sm font-black text-gray-500" onClick={() => setLeaveOpen(true)} aria-label={t("leaveSession")}>
          {t("leaveSession")}
        </button>
        <div className="h-3 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-gray-200">
          <motion.div className="h-full rounded-full bg-[#58cc02]" animate={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-black text-gray-500">
          {t("batchProgress")} {index + 1}/{tasks.length}
        </span>
        {lockLabel && (
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">
            {t("sessionTimeLeft")} {lockLabel}
          </span>
        )}
      </div>

      {savedFlash && (
        <p className="mb-3 rounded-2xl bg-green-50 px-4 py-2 text-sm font-black text-green-700">{t("answerSaved")}</p>
      )}

      {tabSwitches > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-600">
          <AlertTriangle size={18} /> {t("tabSwitchingDetected")}
        </div>
      )}

      {flow === "AUDIO_TRANSCRIPTION" && (
        <AudioTranscriptionCard
          key={current.id}
          api={api}
          task={current}
          keystrokes={keystrokes}
          setKeystrokes={setKeystrokes}
          submit={submitAudioPayload}
          error={error}
          setError={setError}
        />
      )}
      {flow === "VOICE_RECORDING" && (
        <VoiceRecordingCard key={current.id} api={api} task={current} submit={submitAudioPayload} error={error} setError={setError} />
      )}
      {flow !== "AUDIO_TRANSCRIPTION" && flow !== "VOICE_RECORDING" && (
        <AnimatePresence mode="wait">
          <motion.div key={current.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}>
            <Card className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1cb0f6]">{t("taskJobTranslate")}</p>
                <p className="text-sm font-bold text-gray-500">
                  {t("languagePair")}: {pair.source} → {pair.target} · {t("payPerTask")} {formatReward(current)}
                </p>
                <h2 className="text-xl font-black leading-snug text-[#3c3c3c] sm:text-2xl">{humanTaskPrompt(current)}</h2>
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
                spellCheck={false}
                lang="rn"
                className="min-h-40 bg-gray-50 p-4 text-base font-semibold sm:min-h-48 sm:text-lg"
                placeholder={t("typeAnswer")}
              />
              {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {flow !== "AUDIO_TRANSCRIPTION" && flow !== "VOICE_RECORDING" && (
        <div
          className="fixed inset-x-0 z-30 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0"
          style={{ bottom: keyboardInset, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button onClick={() => submit()} className="min-h-12 w-full border-[#1899d6] bg-[#1cb0f6] text-white">
            {t("submit")}
          </Button>
        </div>
      )}

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen} title={t("leaveSession")}>
        <p className="text-sm font-semibold text-gray-600">{t("leaveSessionConfirm")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" onClick={() => setLeaveOpen(false)} className="min-h-12 border-gray-300 bg-white text-gray-600">
            {t("stayInSession")}
          </Button>
          <Button type="button" onClick={leaveSession} className="min-h-12 border-[#cc3f3f] bg-[#ff4b4b] text-white">
            {t("confirmLeave")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
