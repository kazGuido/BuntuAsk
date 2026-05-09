import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ userId, userRole }: { userId: string; userRole: string }) {
  const navigate = useNavigate();

  const { data: user, isLoading } = useQuery({
    queryKey: ['me', userId],
    queryFn: async () => {
      const res = await fetch('/api/me', { headers: { 'X-User-Id': userId } });
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1CB0F6]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-6 md:p-12 space-y-8 bg-[#F7F7F7]">
      {/* Welcome Banner */}
      <div className="bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[#4B4B4B] mb-2">
            Welcome, <span className="text-[#1CB0F6]">{user?.username}</span>
          </h2>
          <p className="text-gray-400 text-lg font-bold uppercase tracking-wider">
            Level {user?.level} • {userRole === 'ANNOTATOR' ? 'Scholar' : 'Guardian'}
          </p>
        </div>
        
        <div className="flex items-center gap-8 bg-gray-50 px-6 py-4 rounded-2xl border-2 border-gray-100">
          <div className="flex flex-col items-center">
            <span className="text-[#FF9600] text-3xl font-bold mb-1">🔥</span>
            <span className="font-black text-2xl text-[#FF9600]">{user?.current_streak}</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Day Streak</span>
          </div>
          <div className="w-px h-16 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-[#1CB0F6] text-3xl font-bold mb-1">💎</span>
            <span className="font-black text-2xl text-[#1CB0F6]">{user?.wallet_balance?.toFixed(3) || '0.000'}</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Wallet ($)</span>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {userRole === 'ANNOTATOR' && (
          <div className="bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-8 hover:bg-gray-50 flex flex-col transition-all group">
            <div className="w-20 h-20 rounded-[24px] bg-[#58CC02] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] text-white flex items-center justify-center mb-6 shrink-0 text-4xl group-hover:scale-105 transition-transform">
              📝
            </div>
            <h3 className="text-2xl font-black text-[#4B4B4B] mb-2">Translate Tasks</h3>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              Claim a batch of 10 French to Kirundi translations. Earn $0.015 per approved row.
            </p>
            <button 
              onClick={() => navigate('/annotate')}
              className="mt-auto w-full py-5 rounded-[24px] bg-[#1CB0F6] border-b-4 border-[#1899D6] text-white font-black text-lg uppercase tracking-wider hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all"
            >
              Start Session
            </button>
          </div>
        )}

        {(userRole === 'REVIEWER' || userRole === 'ADMIN') && (
          <div className="bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-8 hover:bg-gray-50 flex flex-col transition-all group">
            <div className="w-20 h-20 rounded-[24px] bg-[#CE82FF] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] text-white flex items-center justify-center mb-6 shrink-0 text-4xl group-hover:scale-105 transition-transform">
              ⚖️
            </div>
            <h3 className="text-2xl font-black text-[#4B4B4B] mb-2">Review Queue</h3>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              Review pending translations from Scholars. High-logic reasoning required. Earn $0.005 per review.
            </p>
            <button 
              onClick={() => navigate('/review')}
              className="mt-auto w-full py-5 rounded-[24px] bg-[#FF9600] border-b-4 border-[#CC7800] text-white font-black text-lg uppercase tracking-wider hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all"
            >
              Start Reviewing
            </button>
          </div>
        )}
      </div>

      {userRole === 'ADMIN' || true ? (
        <div className="mt-8 p-6 border-2 border-red-200 bg-red-50 rounded-[24px] flex items-center justify-between">
          <div>
            <h4 className="text-red-500 font-black text-lg uppercase tracking-wider">Debug Tools</h4>
            <p className="text-gray-500 font-medium">Reset entire database to initial state.</p>
          </div>
          <button 
            onClick={async () => {
              await fetch('/api/debug/reset-tasks', { method: 'POST' });
              window.location.reload();
            }}
            className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-bold uppercase tracking-wider transition-colors"
          >
            Reset DB
          </button>
        </div>
      ) : null}
    </div>
  );
}
