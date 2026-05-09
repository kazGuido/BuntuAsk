import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Task {
  id: string;
  source_data: string; // JSON string
  difficulty_weight: number;
}

export default function AnnotateSession({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  
  // Anti-cheat & Metrics
  const [keystrokes, setKeystrokes] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Rewards UI
  const [showReward, setShowReward] = useState(false);

  // Fetch / Claim tasks
  const { isLoading, error, refetch } = useQuery({
    queryKey: ['claimTasks', userId],
    queryFn: async () => {
      const res = await fetch('/api/tasks/claim', {
        method: 'POST',
        headers: { 'X-User-Id': userId }
      });
      if (!res.ok) throw new Error('Failed to claim tasks');
      const data = await res.json();
      setTasks(data);
      return data;
    },
    refetchOnWindowFocus: false, // Prevents claiming more when switching tabs
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/tasks/${tasks[currentIndex].id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Submit failed');
      return res.json();
    },
    onSuccess: () => {
      setShowReward(true);
      // Play a small beep sound via Web Audio API if possible
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (e) {
        // Ignore Audio context issues
      }

      setTimeout(() => {
        setShowReward(false);
        if (currentIndex < tasks.length - 1) {
          handleNextCard();
        } else {
          // Finished batch
          navigate('/');
        }
      }, 1000);
    }
  });

  // Track Tab Visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, currentIndex]);

  const handleNextCard = () => {
    setCurrentIndex(prev => prev + 1);
    setInputValue('');
    setKeystrokes(0);
    setTabSwitches(0);
    setStartTime(Date.now());
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F7F7F7]">
        <Loader2 className="w-10 h-10 animate-spin text-[#1CB0F6] mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-wider">Claiming your tasks...</p>
      </div>
    );
  }

  if (error || tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F7F7F7]">
        <div className="w-20 h-20 rounded-[24px] bg-[#58CC02] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] flex items-center justify-center mb-6 text-white">
          <CheckCircle2 className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black text-[#4B4B4B] mb-2">You're all caught up!</h2>
        <p className="text-gray-500 mb-8 max-w-md font-medium text-lg">There are no available tasks to claim right now. Please check back later.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 rounded-2xl bg-white border-2 border-gray-200 border-b-4 text-gray-400 font-black text-lg hover:bg-gray-50 uppercase tracking-wide transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentTask = tasks[currentIndex];

  // Calculate thinking time (2 seconds per 10 words)
  let wordCount = 10;
  let sourceText = "";
  try {
    const data = JSON.parse(currentTask?.source_data || '{}');
    sourceText = data.french || "";
    wordCount = sourceText.split(' ').length;
  } catch (e) {}
  
  const minSeconds = Math.max(2, Math.floor((wordCount / 10) * 2));
  const isTooFast = timeElapsed < minSeconds;
  
  const isPasted = keystrokes < (inputValue.length * 0.7);

  const handleSubmit = () => {
    if (isTooFast || inputValue.trim().length === 0) return;

    submitMutation.mutate({
      content: { kirundi: inputValue.trim() },
      metadata: {
        time_spent_ms: Date.now() - startTime,
        keystroke_count: keystrokes,
        paste_detected_bool: isPasted,
        tab_switches: tabSwitches
      }
    });
  };

  const progress = ((currentIndex) / tasks.length) * 100;

  return (
    <div className="flex-1 flex flex-col bg-[#F7F7F7]">
      {/* Header Navigation specific to annotation */}
      <nav className="h-20 px-4 md:px-8 flex items-center justify-between border-b-2 border-gray-100 bg-white">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="w-[200px] md:w-[400px] h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#58CC02] rounded-full shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-8 hidden md:flex">
          <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Task {currentIndex + 1} / {tasks.length}</span>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-20 relative pt-8 pb-40">
        <div className="max-w-[600px] w-full mb-8">
          <h1 className="text-3xl font-black text-[#4B4B4B] mb-2">Translate this phrase</h1>
          <div className="flex items-center gap-2">
            <span className="bg-white border-2 border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-400 uppercase">Scholar Dataset v1.0</span>
            <span className="bg-orange-100 border-2 border-orange-200 rounded-lg px-2 py-1 text-xs font-bold text-orange-600 uppercase hidden sm:block">Double Bounty 2x</span>
          </div>
        </div>

        {tabSwitches > 0 && (
          <div className="max-w-[600px] w-full mb-4 bg-orange-50 border-2 border-orange-200 text-orange-600 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            Tab switching detected. Stay focused to avoid flagging.
          </div>
        )}

        <div className="max-w-[600px] w-full bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-6 md:p-8 mb-8 relative">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-[#CE82FF] rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)]">
              🎓
            </div>
            <div className="pt-2">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">French (Source)</p>
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={currentTask.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-2xl font-medium text-[#4B4B4B] leading-snug"
                >
                  {sourceText}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="max-w-[600px] w-full relative">
          <div className="absolute -top-3 left-6 bg-[#F7F7F7] px-2 text-xs font-bold text-[#1CB0F6] uppercase tracking-widest z-10 rounded">
             Your Kirundi Translation
          </div>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                setKeystrokes(prev => prev + 1);
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            onPaste={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            placeholder="Andika hano..."
            className={cn(
              "w-full h-40 bg-white border-2 rounded-[32px] p-8 text-xl text-[#4B4B4B] focus:outline-none placeholder:text-gray-300 resize-none shadow-sm transition-all",
              inputValue.length > 0 ? "border-[#1CB0F6] border-b-8" : "border-gray-200 border-b-[6px] focus:border-[#1CB0F6] focus:border-b-8"
            )}
          />
          <div className="flex justify-between items-center sm:flex-row flex-col gap-2 mt-4 px-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <div className={`w-2 h-2 rounded-full ${keystrokes > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Keys: {keystrokes}</span>
              </div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <div className={`w-2 h-2 rounded-full ${isPasted ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{isPasted ? 'Paste Flagged' : 'No Paste'}</span>
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase",
              isTooFast ? "text-[#FF9600]" : "text-gray-400"
            )}>
              {isTooFast ? `Locked: ${(minSeconds - timeElapsed)}s Remaining` : 'Ready to submit'}
            </span>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 w-full md:h-32 p-4 md:p-0 border-t-2 border-gray-100 flex items-center justify-center bg-white z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1000px] w-full flex flex-col md:flex-row items-center justify-between gap-4">
          <button 
            onClick={() => {
              if (currentIndex < tasks.length - 1) handleNextCard();
              else navigate('/');
            }}
            className="w-full md:w-auto px-10 py-4 rounded-2xl border-2 border-gray-200 border-b-4 text-gray-400 font-black text-lg hover:bg-gray-50 uppercase tracking-wide active:border-b-2 active:translate-y-[2px] transition-all"
          >
            Skip Task
          </button>
          
          <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
            <div className="flex flex-col items-start md:items-end mr-2 md:mr-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Est. Reward</span>
              <span className="text-[#58CC02] font-black text-xl">+$0.015 XP</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isTooFast || inputValue.trim().length === 0 || submitMutation.isPending}
              className={cn(
                "w-full md:w-auto px-10 md:px-20 py-4 md:py-5 rounded-2xl font-black text-xl uppercase tracking-wider flex justify-center items-center gap-2 transition-all",
                isTooFast || inputValue.trim().length === 0
                  ? "bg-gray-200 border-b-4 border-gray-300 text-gray-400 cursor-not-allowed"
                  : "bg-[#58CC02] border-b-4 border-[#46A302] text-white hover:brightness-110 active:border-b-0 active:translate-y-1"
              )}
            >
              {submitMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Submit & Earn'}
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Reward Animation */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -100, scale: 1 }}
            exit={{ opacity: 0, y: -150, scale: 1.5 }}
            transition={{ duration: 0.8 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-black text-[#58CC02] drop-shadow-lg z-50 pointer-events-none"
            style={{ textShadow: '0 4px 0 #46A302' }}
          >
            +$0.015 XP
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
