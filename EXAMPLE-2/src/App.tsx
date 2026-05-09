/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Wallet, 
  Trophy, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  BookOpen, 
  Eye, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  User as UserIcon,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { User, UserRole, Task, TaskStatus, SubmissionMetadata } from './types';

// Components
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import TaskSession from './components/TaskSession';
import ReviewQueue from './components/ReviewQueue';
import Leaderboard from './components/Leaderboard';

export type View = 'DASHBOARD' | 'SESSION' | 'REVIEW' | 'LEADERBOARD';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleLogout = async () => {
    // In a real app we'd clear cookies/localstorage
    setUser(null);
    setCurrentView('DASHBOARD');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(u) => { setUser(u); setCurrentView('DASHBOARD'); }} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1a1a1a] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#1a1a1a]/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('DASHBOARD')}>
            <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white font-bold italic">B</div>
            <span className="font-bold tracking-tight text-lg hidden sm:inline">BUNTU-TASKS</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative group">
              <motion.div 
                animate={user.current_streak > 0 ? {
                  scale: [1, 1.2, 1],
                  filter: ["drop-shadow(0 0 0px #ea580c)", "drop-shadow(0 0 8px #ea580c)", "drop-shadow(0 0 0px #ea580c)"]
                } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1 text-orange-600 font-bold cursor-help"
              >
                <Flame size={18} fill="currentColor" />
                <span>{user.current_streak}</span>
              </motion.div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1a1a1a] text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] text-center shadow-xl border border-white/10">
                <p className="font-bold uppercase tracking-widest mb-1">Daily Streak</p>
                <p className="opacity-70">Complete a session every day to keep your streak! Every 3 days you get <span className="text-orange-400 font-bold">+50 XP Bonus</span>.</p>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full border-8 border-transparent border-b-[#1a1a1a]" />
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#5A5A40]/10 px-2.5 py-1 rounded-full text-[#5A5A40] font-medium text-sm">
              <Wallet size={16} />
              <span>${user.wallet_balance.toFixed(3)}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]/60">Level {user.level}</p>
                <div className="w-20 h-1.5 bg-[#5A5A40]/10 rounded-full mt-0.5 overflow-hidden">
                   <div 
                    className="h-full bg-[#5A5A40]" 
                    style={{ width: `${(user.xp_points % 100)}%` }} 
                  />
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {currentView === 'DASHBOARD' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Dashboard 
                user={user} 
                onStartSession={() => setCurrentView('SESSION')} 
                onOpenReview={() => setCurrentView('REVIEW')}
                onOpenLeaderboard={() => setCurrentView('LEADERBOARD')}
              />
            </motion.div>
          )}

          {currentView === 'SESSION' && (
            <motion.div
              key="session"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <TaskSession onComplete={() => { fetchUser(); setCurrentView('DASHBOARD'); }} />
            </motion.div>
          )}

          {currentView === 'REVIEW' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <ReviewQueue onBack={() => setCurrentView('DASHBOARD')} />
            </motion.div>
          )}

          {currentView === 'LEADERBOARD' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Leaderboard onBack={() => setCurrentView('DASHBOARD')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile nav indicator */}
      {currentView === 'DASHBOARD' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-[#1a1a1a]/10 shadow-xl rounded-full px-6 py-3 flex items-center gap-8 sm:hidden">
          <LayoutDashboard className="text-[#5A5A40]" size={24} />
          <Trophy className="text-gray-400" size={24} onClick={() => setCurrentView('LEADERBOARD')} />
          {user.role !== UserRole.ANNOTATOR && (
            <Eye className="text-gray-400" size={24} onClick={() => setCurrentView('REVIEW')} />
          )}
        </div>
      )}
    </div>
  );
}
