import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  Flame,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  ShieldAlert,
  Sparkles,
  Wallet
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Role = "ADMIN" | "ANNOTATOR" | "REVIEWER";
type View = "dashboard" | "annotate" | "review" | "admin";

type User = {
  id: number;
  username: string;
  email: string;
  whatsapp_number: string;
  role: Role;
  wallet_balance: number;
  is_active: boolean;
  trust_score: number;
};

type Project = {
  id: number;
  name: string;
  task_type: "TEXT" | "AUDIO" | "IMAGE";
  base_reward_annotator: number;
  base_reward_reviewer: number;
  required_reviews: number;
  min_accuracy_threshold: number;
};

type Task = {
  id: number;
  project_id: number;
  source_payload: Record<string, unknown>;
  status: string;
  locked_until?: string | null;
  storage_key?: string | null;
};

type Submission = {
  id: number;
  task: Task;
  annotator_id: number;
  result_payload: Record<string, unknown>;
  keystroke_count: number;
  time_spent_ms: number;
};

type FraudAlert = {
  id: number;
  user_id: number;
  alert_type: string;
  description: string;
  resolved: boolean;
};

const API_PREFIX = "/api/v1";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function taskPrompt(task?: Task) {
  if (!task) return "";
  const payload = task.source_payload;
  for (const key of ["prompt", "french", "source", "text", "instruction"]) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return JSON.stringify(payload, null, 2);
}

function useApi(token: string | null) {
  return useMemo(
    () => async <T,>(path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (!(init.body instanceof FormData)) headers.set("Content-Type", headers.get("Content-Type") || "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${API_PREFIX}${path}`, { ...init, headers });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
      return data as T;
    },
    [token]
  );
}

function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={classNames(
        "pressable rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-base",
        className
      )}
    />
  );
}

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={classNames("chunky rounded-[28px] bg-white p-4 sm:p-6", className)} />;
}

function AuthPanel({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("ANNOTATOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            username_or_email: String(form.get("username_or_email")),
            password: String(form.get("password"))
          }
        : {
            username: String(form.get("username")),
            email: String(form.get("email")),
            whatsapp_number: String(form.get("whatsapp_number")),
            password: String(form.get("password")),
            role
          };

    try {
      const response = await fetch(`${API_PREFIX}/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58cc02] text-2xl font-black text-white">B</div>
          <div>
            <h1 className="text-2xl font-black text-[#3c3c3c] sm:text-3xl">BuntuAsk</h1>
            <p className="text-sm font-bold uppercase tracking-wider text-gray-400">Translate. Review. Earn.</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={classNames(
                "rounded-xl px-3 py-2 text-sm font-black uppercase",
                mode === item ? "bg-white text-[#1cb0f6] shadow" : "text-gray-400"
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "register" ? (
            <>
              <input className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" name="username" placeholder="Username" required />
              <input className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" name="email" placeholder="Email" type="email" required />
              <input className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" name="whatsapp_number" placeholder="WhatsApp number" required />
              <select className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="ANNOTATOR">Annotator</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </>
          ) : (
            <input className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" name="username_or_email" placeholder="Username or email" required />
          )}
          <input className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" name="password" placeholder="Password" type="password" minLength={8} required />
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
          <Button disabled={loading} className="w-full border-[#1899d6] bg-[#1cb0f6] text-white">
            {loading ? "Working..." : mode === "login" ? "Enter" : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Dashboard({ user, setView }: { user: User; setView: (view: View) => void }) {
  return (
    <div className="space-y-5 sm:space-y-8">
      <Card className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#1cb0f6]">Welcome back</p>
          <h2 className="text-2xl font-black text-[#3c3c3c] sm:text-4xl">
            {user.username} <span className="text-[#58cc02]">Level {Math.max(1, Math.round(user.trust_score / 20))}</span>
          </h2>
          <p className="mt-2 text-sm font-bold text-gray-500 sm:text-base">Trust score {user.trust_score.toFixed(1)} - {user.role}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
            <Flame className="mx-auto text-orange-500" />
            <p className="text-xl font-black text-orange-500">7</p>
            <p className="text-[10px] font-black uppercase text-orange-400">Streak</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center">
            <Wallet className="mx-auto text-sky-500" />
            <p className="text-xl font-black text-sky-500">${user.wallet_balance.toFixed(3)}</p>
            <p className="text-[10px] font-black uppercase text-sky-400">Wallet</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {user.role !== "REVIEWER" && (
          <Card>
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#58cc02] text-3xl">✍️</div>
            <h3 className="text-2xl font-black text-[#3c3c3c]">Annotate</h3>
            <p className="my-3 text-sm font-semibold text-gray-500">Claim bite-sized translation and labeling tasks in focused sessions.</p>
            <Button onClick={() => setView("annotate")} className="w-full border-[#46a302] bg-[#58cc02] text-white">Start session</Button>
          </Card>
        )}
        {user.role !== "ANNOTATOR" && (
          <Card>
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#ce82ff] text-3xl">⚖️</div>
            <h3 className="text-2xl font-black text-[#3c3c3c]">Review</h3>
            <p className="my-3 text-sm font-semibold text-gray-500">Approve or reject submissions to reach high-fidelity consensus.</p>
            <Button onClick={() => setView("review")} className="w-full border-[#9b5dcc] bg-[#ce82ff] text-white">Open queue</Button>
          </Card>
        )}
      </div>

      {user.role === "ADMIN" && (
        <Button onClick={() => setView("admin")} className="w-full border-[#cc7800] bg-[#ff9600] text-white">
          Open admin dashboard
        </Button>
      )}
    </div>
  );
}

function TaskSession({ api, onDone }: { api: ReturnType<typeof useApi>; onDone: () => void }) {
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

  async function submit() {
    if (!current || !answer.trim()) return;
    try {
      await api("/tasks/submit", {
        method: "POST",
        body: JSON.stringify({
          task_id: current.id,
          result_payload: { text: answer.trim() },
          keystroke_count: keystrokes,
          time_spent_ms: Date.now() - startedAt,
          tab_switches: tabSwitches
        })
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

  function blockInput(event: React.SyntheticEvent) {
    event.preventDefault();
    setError("Manual typing only: paste, drop, and context menu are disabled.");
  }

  if (loading) return <Loading label="Claiming a fresh task batch..." />;
  if (error && !current) return <EmptyState title="No tasks available" message={error} onDone={onDone} />;
  if (!current) return <EmptyState title="All caught up" message="There are no available tasks right now." onDone={onDone} />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button className="rounded-full p-2 text-gray-400 hover:bg-white" onClick={onDone}>✕</button>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ x: 80, opacity: 0, rotate: 1 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={{ x: -80, opacity: 0, rotate: -1 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <Card className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ce82ff]">Translate or label</p>
              <h2 className="mt-2 text-xl font-black leading-tight text-[#3c3c3c] sm:text-3xl">{taskPrompt(current)}</h2>
            </div>
            <textarea
              ref={inputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key.length === 1 || event.key === "Backspace") setKeystrokes((value) => value + 1);
              }}
              onPaste={blockInput}
              onDrop={blockInput}
              onContextMenu={blockInput}
              className="min-h-36 w-full resize-none rounded-3xl border-2 border-gray-200 bg-gray-50 p-4 text-base font-semibold outline-none focus:border-[#1cb0f6] sm:min-h-48 sm:text-lg"
              placeholder="Type your answer manually..."
            />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3 text-xs font-black uppercase text-gray-400">
                <span>{keystrokes} keys</span>
                <span>{tabSwitches} switches</span>
              </div>
              <Button onClick={submit} className="border-[#1899d6] bg-[#1cb0f6] text-white">
                Submit <Sparkles className="ml-1 inline" size={16} />
              </Button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ReviewQueue({ api, onDone }: { api: ReturnType<typeof useApi>; onDone: () => void }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
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
      body: JSON.stringify({ submission_id: submissionId, decision, reason_code: decision })
    });
    setItems((value) => value.filter((item) => item.id !== submissionId));
  }

  if (loading) return <Loading label="Loading review queue..." />;
  if (error) return <EmptyState title="Queue unavailable" message={error} onDone={onDone} />;
  if (!items.length) return <EmptyState title="Review queue empty" message="No pending submissions need review." onDone={onDone} />;

  return (
    <div className="space-y-4">
      <button onClick={onDone} className="text-sm font-black uppercase text-gray-400">← Back</button>
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

function AdminDashboard({ api, onDone }: { api: ReturnType<typeof useApi>; onDone: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [conflicts, setConflicts] = useState<Task[]>([]);
  const [withdrawals, setWithdrawals] = useState<Array<Record<string, unknown>>>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState("unknown");
  const [importProject, setImportProject] = useState<Project | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [projectData, alertData, conflictData, withdrawalData] = await Promise.all([
      api<Project[]>("/admin/projects"),
      api<FraudAlert[]>("/admin/fraud-alerts"),
      api<Task[]>("/admin/conflicts"),
      api<Array<Record<string, unknown>>>("/admin/withdrawals")
    ]);
    setProjects(projectData);
    setAlerts(alertData);
    setConflicts(conflictData);
    setWithdrawals(withdrawalData);
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
        min_accuracy_threshold: Number(form.get("min_accuracy_threshold"))
      })
    });
    event.currentTarget.reset();
    refresh();
  }

  return (
    <div className="space-y-5">
      <button onClick={onDone} className="text-sm font-black uppercase text-gray-400">← Dashboard</button>
      {message && <p className="rounded-2xl bg-sky-50 p-3 text-sm font-bold text-sky-600">{message}</p>}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><Database /> Project config</h2>
        <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Project name" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" />
          <select name="task_type" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold">
            <option value="TEXT">Text</option>
            <option value="AUDIO">Audio</option>
            <option value="IMAGE">Image</option>
          </select>
          <input name="base_reward_annotator" required type="number" step="0.001" placeholder="Annotator reward" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" />
          <input name="base_reward_reviewer" required type="number" step="0.001" placeholder="Reviewer reward" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" />
          <input name="required_reviews" defaultValue={2} type="number" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" />
          <input name="min_accuracy_threshold" defaultValue={0.8} type="number" step="0.01" className="rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" />
          <Button className="border-[#1899d6] bg-[#1cb0f6] text-white sm:col-span-2">Create project</Button>
        </form>
        <div className="mt-5 grid gap-3">
          {projects.map((project) => (
            <div key={project.id} className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-[#3c3c3c]">{project.name}</p>
                <p className="text-xs font-bold text-gray-400">{project.task_type} - {project.required_reviews} reviews</p>
              </div>
              <Button onClick={() => setImportProject(project)} className="border-[#46a302] bg-[#58cc02] text-white">Import from HuggingFace</Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><ShieldAlert /> Fraud desk</h2>
          <div className="space-y-3">
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert.id} className="rounded-2xl bg-red-50 p-3 text-sm">
                <p className="font-black text-red-600">{alert.alert_type} - user {alert.user_id}</p>
                <p className="font-semibold text-red-500">{alert.description}</p>
                {!alert.resolved && <button className="mt-2 font-black text-red-700" onClick={() => api(`/admin/fraud-alerts/${alert.id}/resolve`, { method: "POST" }).then(refresh)}>Resolve</button>}
              </div>
            ))}
            {!alerts.length && <p className="text-sm font-bold text-gray-400">No alerts yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><QrCode /> WhatsApp panel</h2>
          <p className="mb-3 text-sm font-bold text-gray-500">Sidecar status: {waStatus}</p>
          {qr ? <img src={qr} alt="WhatsApp QR" className="mx-auto w-56 rounded-2xl bg-white" /> : <p className="rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-400">QR not ready.</p>}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Eye /> Conflict queue</h2>
          {conflicts.map((task) => (
            <div key={task.id} className="mb-3 rounded-2xl bg-gray-50 p-3">
              <p className="font-bold">{taskPrompt(task)}</p>
              <div className="mt-2 flex gap-2">
                <button className="font-black text-green-600" onClick={() => api("/admin/conflicts/resolve", { method: "POST", body: JSON.stringify({ task_id: task.id, approved: true }) }).then(refresh)}>Approve</button>
                <button className="font-black text-red-600" onClick={() => api("/admin/conflicts/resolve", { method: "POST", body: JSON.stringify({ task_id: task.id, approved: false }) }).then(refresh)}>Reject</button>
              </div>
            </div>
          ))}
          {!conflicts.length && <p className="text-sm font-bold text-gray-400">No conflicts.</p>}
        </Card>
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
      </div>
      {importProject && <HfImportModal api={api} project={importProject} onClose={() => setImportProject(null)} setMessage={setMessage} />}
    </div>
  );
}

function HfImportModal({
  api,
  project,
  onClose,
  setMessage
}: {
  api: ReturnType<typeof useApi>;
  project: Project;
  onClose: () => void;
  setMessage: (message: string) => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await api<{ status: string }>("/admin/import-hf", {
      method: "POST",
      body: JSON.stringify({
        hf_repo: String(form.get("hf_repo")),
        subset: String(form.get("subset") || ""),
        split: String(form.get("split") || "train"),
        project_id: project.id,
        row_limit: Number(form.get("row_limit"))
      })
    });
    setMessage(`Hugging Face import ${response.status} for ${project.name}.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <h3 className="text-2xl font-black">Import from HuggingFace</h3>
        <p className="mb-4 text-sm font-bold text-gray-500">Project: {project.name}</p>
        <form onSubmit={submit} className="space-y-3">
          <input name="hf_repo" defaultValue="kurakurai/luth-sft" className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" placeholder="Repo ID" required />
          <input name="subset" defaultValue="scholar" className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" placeholder="Subset" />
          <input name="split" defaultValue="train" className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" placeholder="Split" />
          <input name="row_limit" defaultValue={5000} type="number" min={1} max={30000} className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-bold" placeholder="Max rows" />
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" onClick={onClose} className="border-gray-300 bg-white text-gray-500">Cancel</Button>
            <Button className="border-[#46a302] bg-[#58cc02] text-white">Queue import</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-[#1cb0f6]" size={42} />
      <p className="text-sm font-black uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

function EmptyState({ title, message, onDone }: { title: string; message: string; onDone: () => void }) {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CheckCircle2 className="mx-auto mb-3 text-[#58cc02]" size={52} />
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="my-3 text-sm font-bold text-gray-500">{message}</p>
      <Button onClick={onDone} className="border-[#1899d6] bg-[#1cb0f6] text-white">Return</Button>
    </Card>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("buntu_token"));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(Boolean(token));
  const api = useApi(token);

  useEffect(() => {
    if (!token) return;
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("buntu_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token, api]);

  if (loading) return <Loading label="Restoring session..." />;
  if (!token || !user) {
    return (
      <AuthPanel
        onLogin={(accessToken, loggedInUser) => {
          localStorage.setItem("buntu_token", accessToken);
          setToken(accessToken);
          setUser(loggedInUser);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/80 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button onClick={() => setView("dashboard")} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5a5a40] text-lg font-black text-white">B</div>
            <span className="hidden text-lg font-black sm:inline">BuntuAsk</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-black sm:gap-4 sm:text-sm">
            <span className="hidden rounded-full bg-[#58cc02]/10 px-3 py-1 text-[#46a302] sm:inline">Trust {user.trust_score.toFixed(0)}</span>
            <span className="rounded-full bg-[#1cb0f6]/10 px-3 py-1 text-[#1cb0f6]">${user.wallet_balance.toFixed(3)}</span>
            <button
              onClick={() => {
                localStorage.removeItem("buntu_token");
                setToken(null);
                setUser(null);
              }}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {view === "dashboard" && <Dashboard user={user} setView={setView} />}
            {view === "annotate" && <TaskSession api={api} onDone={() => setView("dashboard")} />}
            {view === "review" && <ReviewQueue api={api} onDone={() => setView("dashboard")} />}
            {view === "admin" && <AdminDashboard api={api} onDone={() => setView("dashboard")} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-2 rounded-full border border-black/10 bg-white/95 p-2 shadow-xl sm:hidden">
        <button onClick={() => setView("dashboard")} className="rounded-full p-3 text-[#5a5a40]"><Sparkles size={20} /></button>
        {user.role !== "REVIEWER" && <button onClick={() => setView("annotate")} className="rounded-full p-3 text-[#58cc02]"><Clock size={20} /></button>}
        {user.role !== "ANNOTATOR" && <button onClick={() => setView("review")} className="rounded-full p-3 text-[#ce82ff]"><Eye size={20} /></button>}
        {user.role === "ADMIN" && <button onClick={() => setView("admin")} className="rounded-full p-3 text-[#ff9600]"><Lock size={20} /></button>}
      </footer>
    </div>
  );
}
