import { Database, Eye, QrCode, ShieldAlert, Wallet } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { ApiClient } from "../../lib/api";
import { taskPrompt } from "../../lib/utils";
import { AuditLog, FraudAlert, ImportJob, Project, Task } from "../../types";

export function AdminDashboard({ api, onDone }: { api: ApiClient; onDone: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [conflicts, setConflicts] = useState<Task[]>([]);
  const [importReviewTasks, setImportReviewTasks] = useState<Task[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [withdrawals, setWithdrawals] = useState<Array<Record<string, unknown>>>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState("unknown");
  const [importProject, setImportProject] = useState<Project | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [projectData, alertData, conflictData, withdrawalData, reviewData, jobData, auditData] = await Promise.all([
      api<Project[]>("/admin/projects"),
      api<FraudAlert[]>("/admin/fraud-alerts"),
      api<Task[]>("/admin/conflicts"),
      api<Array<Record<string, unknown>>>("/admin/withdrawals"),
      api<Task[]>("/admin/import-review-tasks"),
      api<ImportJob[]>("/admin/import-jobs"),
      api<AuditLog[]>("/admin/audit-logs"),
    ]);
    setProjects(projectData);
    setAlerts(alertData);
    setConflicts(conflictData);
    setWithdrawals(withdrawalData);
    setImportReviewTasks(reviewData);
    setImportJobs(jobData);
    setAuditLogs(auditData);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    api<{ status: string }>("/whatsapp/status").then((data) => setWaStatus(data.status)).catch(() => setWaStatus("offline"));
    api<{ qr: string | null }>("/whatsapp/qr").then((data) => setQr(data.qr)).catch(() => setQr(null));
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/admin/projects", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name")),
        task_type: String(form.get("task_type")),
        base_reward_annotator: Number(form.get("base_reward_annotator")),
        base_reward_reviewer: Number(form.get("base_reward_reviewer")),
        required_reviews: Number(form.get("required_reviews")),
        min_accuracy_threshold: Number(form.get("min_accuracy_threshold")),
      }),
    });
    event.currentTarget.reset();
    refresh();
  }

  return (
    <div className="space-y-5">
      <button onClick={onDone} className="text-sm font-black uppercase text-gray-400">Dashboard</button>
      {message && <p className="rounded-2xl bg-sky-50 p-3 text-sm font-bold text-sky-600">{message}</p>}
      <ProjectPanel projects={projects} createProject={createProject} openImport={setImportProject} />
      <div className="grid gap-5 lg:grid-cols-2">
        <FraudDesk api={api} alerts={alerts} refresh={refresh} />
        <WhatsAppPanel status={waStatus} qr={qr} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <TaskDecisionPanel title="Import review" tasks={importReviewTasks} actionPath="/admin/import-review/resolve" api={api} refresh={refresh} />
        <TaskDecisionPanel title="Conflict queue" tasks={conflicts} actionPath="/admin/conflicts/resolve" api={api} refresh={refresh} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <PayoutPanel api={api} withdrawals={withdrawals} refresh={refresh} />
        <ImportJobs jobs={importJobs} />
      </div>
      <AuditPanel logs={auditLogs} />
      {importProject && <HfImportModal api={api} project={importProject} onClose={() => setImportProject(null)} setMessage={setMessage} />}
    </div>
  );
}

function ProjectPanel({ projects, createProject, openImport }: { projects: Project[]; createProject: (event: FormEvent<HTMLFormElement>) => void; openImport: (project: Project) => void }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><Database /> Project config</h2>
      <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-2">
        <Input name="name" required placeholder="Project name" />
        <select name="task_type" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold">
          <option value="TEXT">Text</option>
          <option value="AUDIO">Audio</option>
          <option value="IMAGE">Image</option>
        </select>
        <Input name="base_reward_annotator" required type="number" step="0.001" placeholder="Annotator reward" />
        <Input name="base_reward_reviewer" required type="number" step="0.001" placeholder="Reviewer reward" />
        <Input name="required_reviews" defaultValue={2} type="number" />
        <Input name="min_accuracy_threshold" defaultValue={0.8} type="number" step="0.01" />
        <Button className="border-[#1899d6] bg-[#1cb0f6] text-white sm:col-span-2">Create project</Button>
      </form>
      <div className="mt-5 grid gap-3">
        {projects.map((project) => (
          <div key={project.id} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-[#3c3c3c]">{project.name}</p>
              <p className="text-xs font-bold text-gray-400">{project.task_type} - {project.required_reviews} reviews</p>
            </div>
            <Button onClick={() => openImport(project)} className="border-[#46a302] bg-[#58cc02] text-white">Import from HuggingFace</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FraudDesk({ api, alerts, refresh }: { api: ApiClient; alerts: FraudAlert[]; refresh: () => void }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><ShieldAlert /> Fraud desk</h2>
      <div className="space-y-3">
        {alerts.slice(0, 8).map((alert) => (
          <div key={alert.id} className="rounded-2xl bg-red-50 p-3 text-sm">
            <p className="font-black text-red-600">{alert.alert_type} - user {alert.user_id}</p>
            <p className="font-semibold text-red-500">{alert.description}</p>
            {!alert.resolved && <button className="mt-2 font-black text-red-700" onClick={() => api(`/admin/fraud-alerts/${alert.id}/resolve`, { method: "POST" }).then(refresh)}>Resolve</button>}
          </div>
        ))}
        {!alerts.length && <p className="text-sm font-bold text-gray-400">No alerts yet.</p>}
      </div>
    </Card>
  );
}

function WhatsAppPanel({ status, qr }: { status: string; qr: string | null }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><QrCode /> WhatsApp panel</h2>
      <p className="mb-3 text-sm font-bold text-gray-500">Sidecar status: {status}</p>
      {qr ? <img src={qr} alt="WhatsApp QR" className="mx-auto w-56 rounded-2xl bg-white" /> : <p className="rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-400">QR not ready.</p>}
    </Card>
  );
}

function TaskDecisionPanel({ title, tasks, actionPath, api, refresh }: { title: string; tasks: Task[]; actionPath: string; api: ApiClient; refresh: () => void }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Eye /> {title}</h2>
      {tasks.map((task) => (
        <div key={task.id} className="mb-3 rounded-2xl bg-gray-50 p-3">
          <p className="font-bold">{taskPrompt(task)}</p>
          <div className="mt-2 flex gap-2">
            <button className="font-black text-green-600" onClick={() => api(actionPath, { method: "POST", body: JSON.stringify({ task_id: task.id, approved: true }) }).then(refresh)}>Approve</button>
            <button className="font-black text-red-600" onClick={() => api(actionPath, { method: "POST", body: JSON.stringify({ task_id: task.id, approved: false }) }).then(refresh)}>Reject</button>
          </div>
        </div>
      ))}
      {!tasks.length && <p className="text-sm font-bold text-gray-400">Nothing waiting.</p>}
    </Card>
  );
}

function PayoutPanel({ api, withdrawals, refresh }: { api: ApiClient; withdrawals: Array<Record<string, unknown>>; refresh: () => void }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Wallet /> Payouts</h2>
      {withdrawals.map((withdrawal) => (
        <div key={String(withdrawal.id)} className="mb-3 flex items-center justify-between rounded-2xl bg-gray-50 p-3">
          <span className="font-bold">#{String(withdrawal.id)} ${String(withdrawal.amount)}</span>
          <button className="font-black text-[#1cb0f6]" onClick={() => api("/admin/withdrawals/approve", { method: "POST", body: JSON.stringify({ transaction_id: withdrawal.id }) }).then(refresh)}>Approve</button>
        </div>
      ))}
      {!withdrawals.length && <p className="text-sm font-bold text-gray-400">No pending withdrawals.</p>}
    </Card>
  );
}

function ImportJobs({ jobs }: { jobs: ImportJob[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-xl font-black">Import jobs</h2>
      {jobs.slice(0, 8).map((job) => (
        <div key={job.id} className="mb-3 rounded-2xl bg-gray-50 p-3 text-sm">
          <p className="font-black">{job.hf_repo} - {job.status}</p>
          <p className="font-semibold text-gray-500">{job.imported_count} imported / {job.skipped_count} skipped</p>
          {job.error_message && <p className="font-bold text-red-500">{job.error_message}</p>}
        </div>
      ))}
      {!jobs.length && <p className="text-sm font-bold text-gray-400">No import jobs.</p>}
    </Card>
  );
}

function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-xl font-black">Audit trail</h2>
      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {logs.slice(0, 25).map((log) => (
          <div key={log.id} className="rounded-2xl bg-gray-50 p-3 text-xs">
            <p className="font-black text-[#3c3c3c]">{log.action} - {log.entity_type} #{log.entity_id ?? "n/a"}</p>
            <p className="font-semibold text-gray-500">{log.description}</p>
          </div>
        ))}
      </div>
      {!logs.length && <p className="text-sm font-bold text-gray-400">No audit logs.</p>}
    </Card>
  );
}

function HfImportModal({ api, project, onClose, setMessage }: { api: ApiClient; project: Project; onClose: () => void; setMessage: (message: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await api<{ status: string; job_id: number }>("/admin/import-hf", {
      method: "POST",
      body: JSON.stringify({
        hf_repo: String(form.get("hf_repo")),
        subset: String(form.get("subset") || ""),
        split: String(form.get("split") || "train"),
        project_id: project.id,
        row_limit: Number(form.get("row_limit")),
      }),
    });
    setMessage(`Hugging Face import ${response.status} as job #${response.job_id}. Imported tasks must be approved before annotators can claim them.`);
    onClose();
  }

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()} title="Import from HuggingFace">
      <p className="mb-4 text-sm font-bold text-gray-500">Project: {project.name}</p>
      <form onSubmit={submit} className="space-y-3">
        <Input name="hf_repo" defaultValue="kurakurai/luth-sft" placeholder="Repo ID" required />
        <Input name="subset" defaultValue="scholar" placeholder="Subset" />
        <Input name="split" defaultValue="train" placeholder="Split" />
        <Input name="row_limit" defaultValue={5000} type="number" min={1} max={30000} placeholder="Max rows" />
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" onClick={onClose} className="border-gray-300 bg-white text-gray-500">Cancel</Button>
          <Button className="border-[#46a302] bg-[#58cc02] text-white">Queue import</Button>
        </div>
      </form>
    </Dialog>
  );
}
