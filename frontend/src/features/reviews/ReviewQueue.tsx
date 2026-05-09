import { useEffect, useState } from "react";

import { EmptyState, Loading } from "../../components/Loading";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ApiClient } from "../../lib/api";
import { taskPrompt } from "../../lib/utils";
import { Submission } from "../../types";

export function ReviewQueue({ api, onDone }: { api: ApiClient; onDone: () => void }) {
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

  if (loading) return <Loading label="Loading review queue..." />;
  if (error) return <EmptyState title="Queue unavailable" message={error} onDone={onDone} />;
  if (!items.length) return <EmptyState title="Review queue empty" message="No pending submissions need review." onDone={onDone} />;

  return (
    <div className="space-y-4">
      <button onClick={onDone} className="text-sm font-black uppercase text-gray-400">Back</button>
      {items.map((item) => (
        <Card key={item.id}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9600]">Submission #{item.id}</p>
          <h3 className="mt-2 text-lg font-black text-[#3c3c3c] sm:text-2xl">{taskPrompt(item.task)}</h3>
          <div className="my-4 rounded-2xl bg-gray-50 p-4 font-semibold text-gray-700">{String(item.result_payload.text || JSON.stringify(item.result_payload))}</div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => decide(item.id, "APPROVE")} className="flex-1 border-[#46a302] bg-[#58cc02] text-white">Approve</Button>
            <Button onClick={() => decide(item.id, "REJECT")} className="flex-1 border-[#cc3f3f] bg-[#ff4b4b] text-white">Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
