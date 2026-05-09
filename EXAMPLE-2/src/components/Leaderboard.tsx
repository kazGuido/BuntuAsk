import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Trophy, 
  Medal, 
  TrendingUp, 
  Loader2,
  Users
} from 'lucide-react';

interface LeaderboardPlayer {
  id: string;
  username: string;
  xp_points: number;
  level: number;
}

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [leaders, setLeaders] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setLeaders(data);
        }
      } catch (err) {
        console.error("Failed to fetch leaders", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaders();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors flex items-center gap-2 font-bold text-sm">
          <ChevronLeft size={20} />
          Back
        </button>
        <div className="flex items-center gap-2 bg-[#5A5A40] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
          <Users size={14} />
          <span>Global Scholars</span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter">Scholars Hall of Fame</h1>
        <p className="text-[#1a1a1a]/50 font-medium">The top contributors building the future of Kirundi AI.</p>
      </div>

      <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-[#1a1a1a]/5 relative">
        {/* Top 3 Podium (Simplified for list) */}
        <div className="p-2 space-y-1">
          {leaders.map((player, index) => {
            const isTop3 = index < 3;
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-5 transition-colors ${
                  index === 0 ? 'bg-yellow-50' : 
                  index === 1 ? 'bg-gray-50' : 
                  index === 2 ? 'bg-orange-50' : 
                  'hover:bg-gray-50/50'
                }`}
              >
                <div className="w-10 text-center font-bold text-xl font-mono text-[#5A5A40]/30 italic">
                  {index + 1}
                </div>
                
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-inner ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-400' : 
                    'bg-[#5A5A40]/20 text-[#5A5A40]'
                  }`}>
                    {player.username.charAt(0).toUpperCase()}
                  </div>
                  {isTop3 && (
                    <div className="absolute -top-2 -right-2 bg-white rounded-full shadow-md p-1">
                      {index === 0 ? <Medal className="text-yellow-500" size={14} /> : 
                       index === 1 ? <Medal className="text-gray-400" size={14} /> : 
                       <Medal className="text-orange-400" size={14} />}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-bold tracking-tight text-lg">{player.username}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Level {player.level}</span>
                    <span className="w-1 h-1 bg-[#1a1a1a]/10 rounded-full" />
                    <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                       <TrendingUp size={10} />
                       Kirundi Scholar
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold tracking-tight text-[#5A5A40]">{player.xp_points.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/40">Total XP</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-[#1a1a1a]/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#1a1a1a]/30 uppercase tracking-widest">Global Rank</p>
            <p className="font-bold text-lg">Top 1%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#1a1a1a]/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-500">
            <Medal size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#1a1a1a]/30 uppercase tracking-widest">Your Achievement</p>
            <p className="font-bold text-lg">Novice Translator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
