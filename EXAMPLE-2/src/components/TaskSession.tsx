import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Zap,
  TrendingUp,
  Loader2 as Loader2Icon
} from 'lucide-react';
import { Task, SubmissionMetadata } from '../types';

interface TaskSessionProps {
  onComplete: () => void;
}

export default function TaskSession({ onComplete }: TaskSessionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Anti-cheat state
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [tabSwitches, setTabSwitches] = useState(0);
  const [pasteDetected, setPasteDetected] = useState(false);

  // Floating rewards state
  const [rewards, setRewards] = useState<{id: number, x: number, y: number}[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function claimTasks() {
      try {
        const res = await fetch('/api/tasks/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 10 })
        });
        const data = await res.json();
        if (res.ok) {
          setTasks(data);
          setStartTime(Date.now());
        } else {
          setError(data.error || "Failed to load tasks");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    claimTasks();

    // Track tab switches
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const currentTask = tasks[currentIndex];

  const handleKeystroke = (e: React.KeyboardEvent) => {
    // Only count printable characters and backspaces
    if (e.key.length === 1 || e.key === 'Backspace') {
      setKeystrokeCount(prev => prev + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteDetected(true);
    alert("Manual typing only! Copy-paste is disabled to ensure translation quality.");
  };

  const playDing = () => {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime); // A5
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  };

  const addRewardAnimation = () => {
    const id = Date.now();
    setRewards(prev => [...prev, { id, x: Math.random() * 40 - 20, y: 0 }]);
    setTimeout(() => {
      setRewards(prev => prev.filter(r => r.id !== id));
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;

    // Minimum thinking time check (2 seconds per 10 words, approx 0.2s/word)
    // Actually spec says: "e.g., 2 seconds per 10 words"
    const wordCount = currentTask.source_data.french.split(' ').length;
    const minTime = (wordCount / 10) * 2 * 1000;
    const timeSpent = Date.now() - startTime;

    if (timeSpent < Math.min(minTime, 5000)) {
       setError("Taking a bit more time ensures better quality!");
       setTimeout(() => setError(''), 3000);
       return;
    }

    setSubmitting(true);
    const metadata: SubmissionMetadata = {
      time_spent_ms: timeSpent,
      keystroke_count: keystrokeCount,
      paste_detected: pasteDetected,
      tab_switches: tabSwitches
    };

    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: currentTask.id,
          content: { kirundi: input },
          metadata
        })
      });

      if (res.ok) {
        addRewardAnimation();
        playDing();
        
        if (currentIndex < tasks.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setInput('');
          setKeystrokeCount(0);
          setStartTime(Date.now());
          setTabSwitches(0);
          setPasteDetected(false);
          textareaRef.current?.focus();
        } else {
          // Final task submitted, complete session
          try {
            const sessionRes = await fetch('/api/user/session-complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const sessionData = await sessionRes.json();
            if (sessionRes.ok && sessionData.bonusXp > 0) {
              alert(`Amazing! ${sessionData.message}`);
            }
          } catch (e) {
            console.error("Session completion update failed", e);
          }
          onComplete();
        }
      } else {
        const data = await res.json();
        setError(data.error || "Submission failed");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="animate-spin text-[#5A5A40]" />
      <p className="font-bold text-[#5A5A40]/60 animate-pulse">Assigning Scholar Tasks...</p>
    </div>
  );

  if (error && tasks.length === 0) return (
    <div className="bg-red-50 border border-red-200 p-8 rounded-3xl text-center">
      <AlertCircle className="mx-auto text-red-500 mb-4" size={40} />
      <h3 className="text-xl font-bold text-red-700 mb-2">Error Encountered</h3>
      <p className="text-red-600 font-medium mb-6">{error}</p>
      <button onClick={onComplete} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Return Home</button>
    </div>
  );

  const progress = ((currentIndex + 1) / tasks.length) * 100;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      {/* Header & Progress */}
      <div className="flex items-center gap-6">
        <button onClick={onComplete} className="p-2 hover:bg-black/5 rounded-full transition-colors text-[#5A5A40]">
          <X size={24} />
        </button>
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-bold text-[#5A5A40] whitespace-nowrap">{currentIndex + 1} / {tasks.length}</span>
      </div>

      {/* Card Area */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="bg-white border-2 border-[#1a1a1a]/5 rounded-[40px] p-8 sm:p-12 shadow-2xl relative"
          >
            <div className="mb-10 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5A5A40]/40 block mb-4">French Prompt</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a] leading-tight">
                {currentTask?.source_data.french}
              </h2>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]/60 ml-2">Kirundi Translation</label>
              <textarea
                ref={textareaRef}
                autoFocus
                value={input}
                onKeyDown={handleKeystroke}
                onPaste={handlePaste}
                onContextMenu={(e) => e.preventDefault()}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Andika mu rurimi rw'Ikirundi..."
                className="w-full min-h-[160px] bg-[#F5F5F0] rounded-[24px] p-6 text-lg font-medium focus:ring-4 focus:ring-[#5A5A40]/20 outline-none transition-all resize-none border-2 border-transparent focus:border-[#5A5A40]/10"
              />
            </div>

            <div className="mt-8 flex items-center justify-between">
               <div className="flex items-center gap-4 text-[#5A5A40]/40">
                <div className="flex items-center gap-1.5" title="Characters typed / Min threshold">
                  <Zap size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">
                    {keystrokeCount} / {Math.round(input.length * 0.7)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">
                    {Math.round((Date.now() - startTime) / 1000)}s
                  </span>
                </div>
              </div>

              <button
                disabled={!input.trim() || submitting}
                onClick={handleSubmit}
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 text-white shadow-lg ${
                  !input.trim() || submitting 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-[#5A5A40] hover:bg-[#4A4A35] hover:shadow-xl shadow-[#5A5A40]/20'
                }`}
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <span>Submit</span>
                    <Send size={18} />
                  </>
                )}
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 right-0 -bottom-16 text-center"
              >
                <p className="bg-red-500 text-white inline-block px-4 py-2 rounded-xl text-sm font-bold shadow-lg border-2 border-white">
                  {error}
                </p>
              </motion.div>
            )}

            {/* Floating Reward Animation */}
            {rewards.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 0, x: r.x }}
                animate={{ opacity: 1, y: -100 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 left-1/2 text-orange-600 font-bold text-xl pointer-events-none z-50 flex items-center gap-1"
              >
                <div className="bg-white px-2 py-1 rounded-lg shadow-xl border border-orange-100 flex items-center gap-1">
                  <TrendingUp size={16} />
                  <span>+$0.015 XP</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return <Loader2Icon className={className} size={size} />;
}
