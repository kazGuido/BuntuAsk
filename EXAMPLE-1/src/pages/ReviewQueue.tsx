import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Submission {
  id: string;
  task_id: string;
  source_data: string;
  content: string;
}

export default function ReviewQueue({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [direction, setDirection] = useState<'left'|'right'|null>(null); // For swipe animation

  const { data: queue = [], isLoading, error } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: async () => {
      const res = await fetch('/api/review/queue', {
        headers: { 'X-User-Id': userId }
      });
      if (!res.ok) throw new Error('Failed to fetch queue');
      return res.json();
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: 'APPROVE' | 'REJECT', reason?: string }) => {
      const res = await fetch(`/api/review/${queue[0].id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ action, reason })
      });
      if (!res.ok) throw new Error('Review failed');
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        setDirection(null);
        queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      }, 300);
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#1CB0F6] mb-4" />
        <p className="text-gray-400 font-bold uppercase tracking-wider">Loading Review Queue...</p>
      </div>
    );
  }

  if (error || queue.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[24px] bg-[#58CC02] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] flex items-center justify-center mb-6 text-white">
          <CheckCircle2 className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black text-[#4B4B4B] mb-2">Inbox Zero!</h2>
        <p className="text-gray-500 mb-8 max-w-md font-medium text-lg">There are no pending submissions to review right now. Great job!</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 rounded-2xl bg-white border-2 border-gray-200 border-b-4 text-gray-400 font-black text-lg hover:bg-gray-50 uppercase tracking-wide transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentItem = queue[0];
  let sourceFrench = "";
  let targetKirundi = "";
  try {
    const sData = JSON.parse(currentItem.source_data);
    const tData = JSON.parse(currentItem.content);
    sourceFrench = sData.french || "";
    targetKirundi = tData.kirundi || "";
  } catch (e) {}

  const handleApprove = () => {
    setDirection('right');
    reviewMutation.mutate({ action: 'APPROVE' });
  };

  const handleRejectInit = () => {
    setShowRejectModal(true);
  };

  const handleRejectConfirm = () => {
    setShowRejectModal(false);
    setDirection('left');
    reviewMutation.mutate({ action: 'REJECT', reason: rejectReason });
    setRejectReason('');
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 relative bg-[#F7F7F7]">
      {/* Header Setup */}
      <div className="flex w-full max-w-xl justify-between items-center mb-6 pt-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold tracking-widest text-[#FF9600] bg-orange-100 px-4 py-1.5 rounded-full border-2 border-orange-200 uppercase">
          {queue.length} Pending
        </span>
        <div className="w-8" />
      </div>

      <div className="relative w-full max-w-xl aspect-[3/4] md:aspect-auto md:h-[500px]">
        <AnimatePresence>
          <motion.div
            key={currentItem.id}
            initial={direction === null ? { scale: 0.9, opacity: 0 } : false}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              x: direction === 'right' ? 800 : direction === 'left' ? -800 : 0,
              rotate: direction === 'right' ? 15 : direction === 'left' ? -15 : 0
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute inset-0 flex flex-col bg-white rounded-[32px] border-2 border-gray-200 border-b-8 overflow-hidden"
          >
            {/* Top Half (Source) */}
            <div className="flex-1 p-8 md:p-10 bg-[#E5F3FF] border-b-2 border-gray-200 flex flex-col justify-center relative">
              <div className="absolute top-6 left-6 text-xs font-bold text-[#1CB0F6] bg-white border border-[#1CB0F6]/20 px-3 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                Source (French)
              </div>
              <p className="text-2xl text-[#4B4B4B] font-medium leading-relaxed mt-4">
                {sourceFrench}
              </p>
            </div>

            {/* Bottom Half (Translation) */}
            <div className="flex-1 p-8 md:p-10 flex flex-col justify-center relative bg-white">
              <div className="absolute top-6 left-6 text-xs font-bold text-[#58CC02] bg-green-50 border border-[#58CC02]/20 px-3 py-1 rounded-lg uppercase tracking-widest">
                Submission (Kirundi)
              </div>
              <p className="text-2xl text-[#4B4B4B] font-medium leading-relaxed mt-4">
                {targetKirundi}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-8 mt-12 mb-8">
        <button
          onClick={handleRejectInit}
          disabled={reviewMutation.isPending || !!direction}
          className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 border-b-8 flex items-center justify-center hover:bg-gray-50 active:border-b-2 active:translate-y-2 transition-all group"
        >
          <span className="text-3xl grayscale group-hover:grayscale-0 transition-all text-[#FF4B4B]">👎</span>
        </button>

        <button
          onClick={handleApprove}
          disabled={reviewMutation.isPending || !!direction}
          className="w-20 h-20 rounded-full bg-white border-2 border-gray-200 border-b-8 flex items-center justify-center hover:bg-gray-50 active:border-b-2 active:translate-y-2 transition-all group shadow-sm"
        >
          <span className="text-3xl grayscale group-hover:grayscale-0 transition-all text-[#58CC02]">👍</span>
        </button>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-black text-[#4B4B4B] mb-2">Reason for Rejection</h3>
              <p className="text-gray-400 font-bold text-sm uppercase tracking-wider mb-6">Select from templates</p>
              
              <select 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#F7F7F7] border-2 border-gray-200 rounded-2xl p-4 text-[#4B4B4B] font-medium text-lg mb-8 outline-none focus:border-[#1CB0F6]"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Google Translate detected">Google Translate detected</option>
                <option value="Bad Grammar / Syntax">Bad Grammar / Syntax</option>
                <option value="Incomplete Translation">Incomplete Translation</option>
                <option value="Spam / Gibberish">Spam / Gibberish</option>
              </select>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-4 rounded-xl border-2 border-gray-200 border-b-4 text-gray-400 font-black uppercase hover:bg-gray-50 active:border-b-2 active:translate-y-[2px] transition-all tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRejectConfirm}
                  disabled={!rejectReason}
                  className="flex-1 py-4 rounded-xl bg-[#FF4B4B] border-b-4 border-[#EA2B2B] disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-400 text-white font-black uppercase hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all tracking-wider"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
