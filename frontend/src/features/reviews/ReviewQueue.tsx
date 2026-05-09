import { useEffect, useState } from "react";

import { EmptyState, Loading } from "../../components/Loading";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";
import { taskPrompt } from "../../lib/utils";
import { Submission } from "../../types";
import { resolveAudioUrl, taskWorkflow } from "../tasks/audio";

export function ReviewQueue({ api, onDone }: { api: ApiClient; onDone: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api<Submission[]>("/reviews/queue")
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(submissionId: number, decision: "APPROVE" | "REJECT") {
    await api("/reviews", {
      method: "POST",
      body: JSON.stringify({ submission_id: submissionId, decision, reason_code: decision }),
    });
    setItems((value) => value.filter((item) => item.id !== submissionId));
  }

  if (loading) return <Loading label={t("loadingReviewQueue")} />;
  if (error) return <EmptyState title={t("queueUnavailable")} message={error} onDone={onDone} />;
  if (!items.length) return <EmptyState title={t("reviewQueueEmpty")} message={t("noPendingReviews")} onDone={onDone} />;

  return (
    <div className="space-y-4">
      <button onClick={onDone} className="text-sm font-black uppercase text-gray-400">{t("back")}</button>
      {items.map((item) => <ReviewCard key={item.id} item={item} api={api} decide={decide} />)}
    </div>
  );
}

function ReviewCard({ item, api, decide }: { item: Submission; api: ApiClient; decide: (submissionId: number, decision: "APPROVE" | "REJECT") => Promise<void> }) {
  const { t } = useI18n();
  const [sourceAudioUrl, setSourceAudioUrl] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const workflow = taskWorkflow(item.task);

  useEffect(() => {
    if (workflow === "AUDIO_TRANSCRIPTION") {
      resolveAudioUrl(api, item.task).then(setSourceAudioUrl).catch(() => undefined);
    }
    if (workflow === "VOICE_RECORDING") {
      const key = item.result_payload.recording_key;
      if (typeof key === "string" && key) {
        api<{ url: string }>(`/storage/download-url?key=${encodeURIComponent(key)}`).then((result) => setRecordingUrl(result.url)).catch(() => undefined);
      }
    }
  }, [api, item.id, workflow]);

  return (
    <Card>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9600]">{t("submission")} #{item.id} / {workflow || "TEXT"}</p>
      <h3 className="mt-2 text-lg font-black text-[#3c3c3c] sm:text-2xl">{taskPrompt(item.task)}</h3>
      {sourceAudioUrl && (
        <div className="my-4 rounded-2xl bg-sky-50 p-3">
          <p className="mb-2 text-xs font-black uppercase text-sky-600">{t("sourceAudio")}</p>
          <audio controls src={sourceAudioUrl} className="w-full" />
        </div>
      )}
      {recordingUrl && (
        <div className="my-4 rounded-2xl bg-orange-50 p-3">
          <p className="mb-2 text-xs font-black uppercase text-orange-600">{t("workerRecording")}</p>
          <audio controls src={recordingUrl} className="w-full" />
        </div>
      )}
      <div className="my-4 rounded-2xl bg-gray-50 p-4 font-semibold text-gray-700">
        {String(item.result_payload.transcript || item.result_payload.text || item.result_payload.recording_key || JSON.stringify(item.result_payload))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => decide(item.id, "APPROVE")} className="flex-1 border-[#46a302] bg-[#58cc02] text-white">{t("approve")}</Button>
        <Button onClick={() => decide(item.id, "REJECT")} className="flex-1 border-[#cc3f3f] bg-[#ff4b4b] text-white">{t("reject")}</Button>
      </div>
    </Card>
  );
}
