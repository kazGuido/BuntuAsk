import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, LogOut, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BuntuWordmark } from "./components/BuntuBrand";
import { HeaderOverflowMenu } from "./components/HeaderOverflowMenu";
import { MobileNav } from "./components/MobileNav";
import { Loading } from "./components/Loading";
import { useApi } from "./lib/api";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { AuthPanel } from "./features/auth/AuthPanel";
import { Dashboard, YourWorkPanel } from "./features/dashboard/Dashboard";
import { LandingPage } from "./features/landing/LandingPage";
import { NotificationCenter } from "./features/notifications/NotificationCenter";
import { ReviewQueue } from "./features/reviews/ReviewQueue";
import { TaskSession } from "./features/tasks/TaskSession";
import { FirstRunTour } from "./features/onboarding/FirstRunTour";
import { LanguageToggle, useI18n } from "./i18n";
import { SessionWorkflow, User, View } from "./types";

function workflowForView(view: View): SessionWorkflow | undefined {
  if (view === "annotate-translate") return "TRANSLATION";
  if (view === "annotate-record") return "VOICE_RECORDING";
  return undefined;
}

type AuthScreen = null | "login" | "register";

export default function App() {
  const { t } = useI18n();
  const [token, setToken] = useState(() => localStorage.getItem("buntu_token"));
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(Boolean(token));
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [tourReplay, setTourReplay] = useState(false);
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

  const sessionWorkflow = useMemo(() => workflowForView(view), [view]);
  const inSession = view === "annotate" || view === "annotate-translate" || view === "annotate-record";
  const showMobileNav = !inSession;

  if (loading) return <Loading label={t("restoringSession")} />;

  if (!token || !user) {
    if (authScreen) {
      return (
        <AuthPanel
          initialMode={authScreen}
          onBack={() => setAuthScreen(null)}
          onLogin={(accessToken, loggedInUser) => {
            localStorage.setItem("buntu_token", accessToken);
            setToken(accessToken);
            setUser(loggedInUser);
            setAuthScreen(null);
          }}
        />
      );
    }
    return (
      <LandingPage
        onSignUp={() => setAuthScreen("register")}
        onLogIn={() => setAuthScreen("login")}
        onHowItWorks={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
      />
    );
  }

  function logout() {
    localStorage.removeItem("buntu_token");
    setToken(null);
    setUser(null);
    setAuthScreen(null);
  }

  const showTrust = (user.tasks_completed_count || 0) > 0;
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans">
      {tourReplay && (
        <FirstRunTour
          api={api}
          replayOnly
          onComplete={() => setTourReplay(false)}
          onStartTask={() => {
            setTourReplay(false);
            setView("annotate-translate");
          }}
        />
      )}
      <header
        className="sticky top-0 z-40 border-b border-black/10 bg-white/80 px-4 py-3 backdrop-blur sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={() => setView("dashboard")} className="flex min-h-11 items-center gap-2">
            <BuntuWordmark />
          </button>
          <div className="flex items-center gap-2 text-xs font-black sm:gap-3 sm:text-sm">
            {showTrust && (
              <span className="hidden rounded-full bg-[#58cc02]/10 px-3 py-1 text-[#46a302] sm:inline">
                {t("trust")} {user.trust_score.toFixed(0)}
              </span>
            )}
            <span className="rounded-full bg-[#1cb0f6]/10 px-3 py-1 text-[#1cb0f6]">${user.wallet_balance.toFixed(3)}</span>
            <div className="hidden items-center gap-2 sm:flex">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setView("admin")}
                  className="flex min-h-11 items-center gap-1 rounded-full bg-[#5a5a40]/10 px-3 py-1 text-[#5a5a40]"
                >
                  <Shield size={16} /> {t("navAdmin")}
                </button>
              )}
              <LanguageToggle />
              <button
                type="button"
                onClick={() => setTourReplay(true)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                title={t("tourReplay")}
              >
                <HelpCircle size={18} />
              </button>
              <NotificationCenter api={api} />
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                title={t("logout")}
              >
                <LogOut size={18} />
              </button>
            </div>
            <HeaderOverflowMenu api={api} onLogout={logout} showAdmin={isAdmin} onOpenAdmin={setView} onReplayTour={() => setTourReplay(true)} />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 sm:pb-8 ${showMobileNav ? "pb-28" : "pb-5"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {view === "dashboard" && <Dashboard user={user} setView={setView} api={api} onUserUpdated={setUser} />}
            {view === "your-work" && <YourWorkPanel user={user} api={api} />}
            {inSession && <TaskSession api={api} workflow={sessionWorkflow} onDone={() => setView("dashboard")} />}
            {view === "review" && <ReviewQueue api={api} onDone={() => setView("dashboard")} />}
            {view === "admin" && <AdminDashboard api={api} onDone={() => setView("dashboard")} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {showMobileNav && <MobileNav view={view} setView={setView} role={user.role} />}
    </div>
  );
}
