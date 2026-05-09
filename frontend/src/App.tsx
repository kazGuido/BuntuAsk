import { AnimatePresence, motion } from "framer-motion";
import { Clock, Eye, Lock, LogOut, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Loading } from "./components/Loading";
import { useApi } from "./lib/api";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { AuthPanel } from "./features/auth/AuthPanel";
import { Dashboard } from "./features/dashboard/Dashboard";
import { NotificationCenter } from "./features/notifications/NotificationCenter";
import { ReviewQueue } from "./features/reviews/ReviewQueue";
import { TaskSession } from "./features/tasks/TaskSession";
import { User, View } from "./types";

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

  function logout() {
    localStorage.removeItem("buntu_token");
    setToken(null);
    setUser(null);
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
            <NotificationCenter api={api} />
            <button onClick={logout} className="rounded-full p-2 text-gray-400 hover:bg-gray-100" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {view === "dashboard" && <Dashboard user={user} setView={setView} api={api} />}
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
