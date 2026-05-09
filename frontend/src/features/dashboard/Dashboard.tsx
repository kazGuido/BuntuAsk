import { Flame, Wallet } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useI18n } from "../../i18n";
import { ApiClient } from "../../lib/api";
import { Project, User, View } from "../../types";

export function Dashboard({ user, setView, api }: { user: User; setView: (view: View) => void; api: ApiClient }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5 sm:space-y-8">
      <Card className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">{t("welcomeBack")}</p>
          <h2 className="text-2xl font-black text-[#3c3c3c] sm:text-4xl">
            {user.username} <span className="text-[#58cc02]">{t("level")} {Math.max(1, Math.round(user.trust_score / 20))}</span>
          </h2>
          <p className="mt-2 text-sm font-bold text-gray-500 sm:text-base">{t("trustScore")} {user.trust_score.toFixed(1)} - {user.role}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
            <Flame className="mx-auto text-orange-500" />
            <p className="text-xl font-black text-orange-500">7</p>
            <p className="text-[10px] font-black uppercase text-orange-400">{t("streak")}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center">
            <Wallet className="mx-auto text-sky-500" />
            <p className="text-xl font-black text-sky-500">${user.wallet_balance.toFixed(3)}</p>
            <p className="text-[10px] font-black uppercase text-sky-400">{t("wallet")}</p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {user.role !== "REVIEWER" && (
          <Card>
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#58cc02] text-3xl">✍️</div>
            <h3 className="text-2xl font-black text-[#3c3c3c]">{t("annotate")}</h3>
            <p className="my-3 text-sm font-semibold text-gray-500">{t("annotateDescription")}</p>
            <Button onClick={() => setView("annotate")} className="w-full border-[#46a302] bg-[#58cc02] text-white">
              {t("startSession")}
            </Button>
          </Card>
        )}
        {user.role !== "ANNOTATOR" && (
          <Card>
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#ce82ff] text-3xl">⚖️</div>
            <h3 className="text-2xl font-black text-[#3c3c3c]">{t("review")}</h3>
            <p className="my-3 text-sm font-semibold text-gray-500">{t("reviewDescription")}</p>
            <Button onClick={() => setView("review")} className="w-full border-[#9b5dcc] bg-[#ce82ff] text-white">
              {t("openQueue")}
            </Button>
          </Card>
        )}
      </div>
      {user.role === "ADMIN" && (
        <Button onClick={() => setView("admin")} className="w-full border-[#cc7800] bg-[#ff9600] text-white">
          {t("openAdminDashboard")}
        </Button>
      )}
      <ProjectProposalPanel api={api} />
    </div>
  );
}

function ProjectProposalPanel({ api }: { api: ApiClient }) {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    setProjects(await api<Project[]>("/projects/mine"));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name")),
        description: String(form.get("description")),
        language: String(form.get("language")),
        guidelines: String(form.get("guidelines")),
        sample_payload: parseSamplePayload(String(form.get("sample_payload") || "{}")),
        task_type: String(form.get("task_type")),
        workflow: String(form.get("workflow")),
        base_reward_annotator: Number(form.get("base_reward_annotator")),
        base_reward_reviewer: Number(form.get("base_reward_reviewer")),
        required_reviews: Number(form.get("required_reviews")),
        min_accuracy_threshold: Number(form.get("min_accuracy_threshold")),
      }),
    });
    event.currentTarget.reset();
    setMessage(t("projectSubmitted"));
    await load();
  }

  return (
    <Card>
      <h3 className="text-2xl font-black text-[#3c3c3c]">{t("submitDataProject")}</h3>
      <p className="my-2 text-sm font-semibold text-gray-500">{t("dataProjectDescription")}</p>
      {message && <p className="mb-3 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-600">{message}</p>}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Input name="name" required placeholder={t("projectName")} />
        <Input name="language" required placeholder={t("languagePlaceholder")} />
        <Input name="description" required placeholder={t("projectDescription")} className="sm:col-span-2" />
        <select name="workflow" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold">
          <option value="TRANSLATION">{t("translation")}</option>
          <option value="AUDIO_TRANSCRIPTION">{t("audioTranscription")}</option>
          <option value="VOICE_RECORDING">{t("voiceRecording")}</option>
          <option value="IMAGE_LABELING">{t("imageLabeling")}</option>
        </select>
        <select name="task_type" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold">
          <option value="TEXT">{t("text")}</option>
          <option value="AUDIO">{t("audio")}</option>
          <option value="IMAGE">{t("image")}</option>
        </select>
        <Input name="base_reward_annotator" required type="number" step="0.001" placeholder={t("annotatorReward")} />
        <Input name="base_reward_reviewer" required type="number" step="0.001" placeholder={t("reviewerReward")} />
        <Input name="required_reviews" defaultValue={2} type="number" />
        <Input name="min_accuracy_threshold" defaultValue={0.8} type="number" step="0.01" />
        <textarea name="guidelines" required placeholder={t("guidelines")} className="min-h-24 rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold outline-none focus:border-[#1cb0f6] sm:col-span-2" />
        <textarea name="sample_payload" defaultValue={'{"prompt":"Sample task payload"}'} className="min-h-24 rounded-2xl border-2 border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-[#1cb0f6] sm:col-span-2" />
        <Button className="border-[#1899d6] bg-[#1cb0f6] text-white sm:col-span-2">{t("submitForApproval")}</Button>
      </form>
      {projects.length > 0 && (
        <div className="mt-4 space-y-2">
          {projects.slice(0, 4).map((project) => (
            <div key={project.id} className="rounded-2xl bg-gray-50 p-3 text-sm font-bold text-gray-500">
              {project.name} - {project.workflow} - {project.status}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function parseSamplePayload(value: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return { sample: value };
  }
}
