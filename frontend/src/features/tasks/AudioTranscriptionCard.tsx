import WaveSurfer from "wavesurfer.js";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/input";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";
import { Task } from "../../types";
import { audioDurationMs, resolveAudioUrl } from "./audio";

type Props = {
  api: ApiClient;
  task: Task;
  keystrokes: number;
  setKeystrokes: (value: (previous: number) => number) => void;
  submit: (payload: Record<string, unknown>) => Promise<void>;
  error: string;
  setError: (error: string) => void;
};

export function AudioTranscriptionCard({ api, task, keystrokes, setKeystrokes, submit, error, setError }: Props) {
  const { t } = useI18n();
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const playedSegmentsRef = useRef<Array<[number, number]>>([]);
  const lastTimeRef = useRef(0);
  const autoLoopRef = useRef(true);
  const [transcript, setTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [totalPlayedMs, setTotalPlayedMs] = useState(0);
  const [coverageMs, setCoverageMs] = useState(0);
  const durationMs = audioDurationMs(task);

  useEffect(() => {
    autoLoopRef.current = autoLoop;
  }, [autoLoop]);

  useEffect(() => {
    setTranscript("");
    setIsPlaying(false);
    setAutoLoop(true);
    setTotalPlayedMs(0);
    setCoverageMs(0);
    playedSegmentsRef.current = [];
    lastTimeRef.current = 0;
    let cancelled = false;
    async function setup() {
      const url = await resolveAudioUrl(api, task);
      if (!waveformRef.current || !url || cancelled) return;
      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#bae6fd",
        progressColor: "#1cb0f6",
        cursorColor: "#ff9600",
        height: window.innerWidth < 640 ? 72 : 112,
        barWidth: 3,
        barGap: 2,
        normalize: true,
        url,
      });
      wavesurferRef.current = ws;
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => {
        setIsPlaying(false);
        if (autoLoopRef.current) {
          ws.seekTo(0);
          ws.play();
        }
      });
      ws.on("timeupdate", (currentSeconds) => {
        const previousSeconds = lastTimeRef.current;
        if (currentSeconds > previousSeconds) {
          const deltaMs = (currentSeconds - previousSeconds) * 1000;
          setTotalPlayedMs((value) => value + deltaMs);
          playedSegmentsRef.current.push([previousSeconds * 1000, currentSeconds * 1000]);
          setCoverageMs(uniqueCoverageMs(playedSegmentsRef.current));
        }
        lastTimeRef.current = currentSeconds;
      });
    }
    setup().catch((err) => setError(err.message));
    return () => {
      cancelled = true;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, [api, task.id, setError]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        wavesurferRef.current?.playPause();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        skip(-3);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        skip(3);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function skip(seconds: number) {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setTime(Math.max(0, Math.min(ws.getDuration(), ws.getCurrentTime() + seconds)));
    lastTimeRef.current = ws.getCurrentTime();
  }

  async function handleSubmit() {
    if (durationMs > 0 && Math.max(totalPlayedMs, coverageMs) < durationMs) {
      setError(t("mustListen"));
      return;
    }
    await submit({
      transcript: transcript.trim(),
      total_audio_played_ms: Math.round(totalPlayedMs),
      unique_audio_coverage_ms: Math.round(coverageMs),
      loop_enabled: autoLoop,
      hotkeys_enabled: true,
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">{t("transcriberDeck")}</p>
        <h2 className="text-xl font-black text-[#3c3c3c] sm:text-3xl">{t("listenAndTranscribe")}</h2>
      </div>
      <div className="rounded-3xl bg-sky-50 p-3">
        <div ref={waveformRef} className="overflow-hidden rounded-2xl bg-white p-2" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <Button type="button" onClick={() => wavesurferRef.current?.playPause()} className="border-[#1899d6] bg-[#1cb0f6] text-white">
          {isPlaying ? t("pause") : t("play")}
        </Button>
        <Button type="button" onClick={() => skip(-3)} className="border-gray-300 bg-white text-gray-500">-3s</Button>
        <Button type="button" onClick={() => skip(3)} className="border-gray-300 bg-white text-gray-500">+3s</Button>
        <button
          type="button"
          onClick={() => setAutoLoop((value) => !value)}
          className={autoLoop ? "col-span-3 rounded-2xl bg-[#58cc02]/10 px-4 py-3 text-sm font-black uppercase text-[#46a302]" : "col-span-3 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-black uppercase text-gray-500"}
        >
          {t("autoLoop")} {autoLoop ? t("on") : t("off")}
        </button>
      </div>
      <p className="text-xs font-bold text-gray-400">
        {t("desktopHotkeys")} {t("listened")} {Math.round(Math.max(totalPlayedMs, coverageMs) / 1000)}s / {Math.round(durationMs / 1000)}s.
      </p>
      <Textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        onKeyDown={(event) => {
          if (event.key.length === 1 || event.key === "Backspace") setKeystrokes((value) => value + 1);
        }}
        className="min-h-36 bg-gray-50 p-4 text-base font-semibold sm:min-h-48"
        placeholder={t("typeWhatYouHear")}
      />
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
      <Button disabled={!transcript.trim() || (durationMs > 0 && Math.max(totalPlayedMs, coverageMs) < durationMs)} onClick={handleSubmit} className="sticky bottom-20 w-full border-[#1899d6] bg-[#1cb0f6] text-white sm:static">
        {t("submitTranscript")} ({keystrokes} {t("keys")})
      </Button>
    </Card>
  );
}

function uniqueCoverageMs(segments: Array<[number, number]>) {
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [start, end] of sorted) {
    if (!current) {
      current = [start, end];
    } else if (start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      total += current[1] - current[0];
      current = [start, end];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}
