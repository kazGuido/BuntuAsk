import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { 
  X, 
  Check, 
  ChevronLeft, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { Submission } from '../types';

interface ReviewQueueProps {
  onBack: () => void;
}

export default function ReviewQueue({ onBack }: ReviewQueueProps) {
  const [queue, setQueue] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchQueue() {
      try {
        const res = await fetch('/api/review/queue');
        if (res.ok) {
          const data = await res.json();
          setQueue(data);
        } else {
          setError("Failed to load queue");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchQueue();
  }, []);

  const handleAction = async (submissionId: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    try {
      const res = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, action, reason: reason || 'N/A' })
      });
      if (res.ok) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
    </div>
  );

  if (queue.length === 0 || currentIndex >= queue.length) return (
    <div className="bg-white rounded-[40px] p-12 text-center border border-[#1a1a1a]/5 max-w-lg mx-auto">
      <Check className="mx-auto text-green-500 mb-6 w-16 h-16 bg-green-50 p-4 rounded-full" />
      <h2 className="text-2xl font-bold mb-3">Queue Empty!</h2>
      <p className="text-[#1a1a1a]/50 font-medium mb-8">You've cleared the reviewer workspace. More tasks will appear as annotators submit them.</p>
      <button onClick={onBack} className="bg-[#5A5A40] text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-[#5A5A40]/20">Return Home</button>
    </div>
  );

  const current = queue[currentIndex];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors flex items-center gap-2 font-bold text-sm">
          <ChevronLeft size={20} />
          Back
        </button>
        <span className="bg-[#5A5A40]/10 text-[#5A5A40] px-4 py-1 rounded-full text-xs font-bold font-mono">
          PENDING: {queue.length - currentIndex}
        </span>
      </div>

      <div className="relative h-[550px] w-full max-w-[400px] mx-auto perspective-1000">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 100) {
                handleAction(current.id, 'APPROVE');
              } else if (info.offset.x < -100) {
                // For simplicity, just reject standard. In real app, show reason modal.
                handleAction(current.id, 'REJECT', 'Generic Rejection');
              }
            }}
            className="absolute inset-0 bg-white border border-[#1a1a1a]/10 rounded-[48px] shadow-2xl p-8 flex flex-col cursor-grab active:cursor-grabbing overflow-hidden"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-[#5A5A40]">
                    {current.submitter_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{current.submitter_name}</p>
                    <p className="text-[10px] text-[#5A5A40]/40 font-mono font-bold uppercase tracking-widest">Scholar Level 2</p>
                  </div>
                </div>
                <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg" title="View Details">
                  <ExternalLink size={14} />
                </div>
              </div>

              <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar py-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]/40 block mb-2">French (Original)</label>
                  <p className="text-lg font-bold tracking-tight text-[#1a1a1a]/80 italic">"{current.source_data?.french}"</p>
                </div>

                <div className="bg-[#5A5A40]/5 rounded-3xl p-6 border border-[#5A5A40]/10">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]/60 block mb-2">Kirundi (Submission)</label>
                  <p className="text-xl font-bold tracking-tight leading-relaxed">
                    {current.content.kirundi}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 pb-4">
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1a1a1a]/30 uppercase tracking-widest">Thought Time</span>
                    <span className="font-mono text-sm font-bold">{(current.metadata.time_spent_ms / 1000).toFixed(1)}s</span>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1a1a1a]/30 uppercase tracking-widest">Tab Switches</span>
                    <span className={`font-mono text-sm font-bold ${current.metadata.tab_switches > 2 ? 'text-red-500' : ''}`}>
                      {current.metadata.tab_switches}
                    </span>
                 </div>
              </div>

              <div className="flex items-center justify-center gap-6 mt-4">
                <button 
                  onClick={() => handleAction(current.id, 'REJECT', 'Rejected by Reviewer')}
                  className="w-16 h-16 rounded-full border-2 border-red-100 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 group"
                >
                  <X size={32} className="group-hover:rotate-90 transition-transform" />
                </button>
                <div className="h-10 w-px bg-gray-100" />
                <button 
                  onClick={() => handleAction(current.id, 'APPROVE')}
                  className="w-16 h-16 rounded-full border-2 border-green-100 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-95 group"
                >
                  <Check size={32} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {/* Tips for Swipe */}
              <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Swipe Left to Reject • Right to Approve</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
