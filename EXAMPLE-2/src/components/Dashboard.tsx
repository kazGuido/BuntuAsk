import React from 'react';
import { 
  BookOpen, 
  Eye, 
  Trophy, 
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';
import { User, UserRole } from '../types';

interface DashboardProps {
  user: User;
  onStartSession: () => void;
  onOpenReview: () => void;
  onOpenLeaderboard: () => void;
}

export default function Dashboard({ user, onStartSession, onOpenReview, onOpenLeaderboard }: DashboardProps) {
  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="bg-[#5A5A40] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10">
          <h2 className="text-4xl font-bold tracking-tight mb-2 italic">Amahoro, {user.username}!</h2>
          <p className="text-white/80 font-medium max-w-md">Ready to contribute to the Kirundi Scholar dataset? Every translation brings us closer to a high-fidelity AI for Burundi.</p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <button 
              onClick={onStartSession}
              className="bg-white text-[#5A5A40] px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#F5F5F0] transition-colors shadow-lg active:scale-95"
            >
              <BookOpen size={20} />
              Start Learning
            </button>
            <div className="flex -space-x-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#5A5A40] bg-white/20 backdrop-blur-md flex items-center justify-center text-xs font-bold">
                   UI
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#5A5A40] bg-[#F5F5F0] flex items-center justify-center text-[#5A5A40] text-xs font-bold">
                +12k
              </div>
            </div>
          </div>
        </div>

        {/* Abstract shapes for design */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
      </div>

      {/* Grid Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ActionCard 
          icon={<TrendingUp className="text-blue-500" />}
          title="Leaderboard"
          description="Check out the weekly top earners and Kirundi scholars."
          onClick={onOpenLeaderboard}
        />
        {(user.role === UserRole.ADMIN || user.role === UserRole.REVIEWER) && (
          <ActionCard 
            icon={<Eye className="text-purple-500" />}
            title="Review Queue"
            description="Help verify submitted translations and unlock rewards."
            onClick={onOpenReview}
          />
        )}
        <div className="bg-white rounded-3xl p-6 border border-[#1a1a1a]/5 flex flex-col justify-between group cursor-default shadow-sm border-dashed border-2">
          <div className="flex flex-col gap-4">
             <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Next Reward</h3>
              <p className="text-sm text-[#1a1a1a]/50 font-medium">Earn $10.00 to unlock your first mobile money payout.</p>
            </div>
          </div>
          <div className="mt-6 bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-1000" 
              style={{ width: `${(user.wallet_balance / 10) * 100}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox label="Earned" value={`$${user.wallet_balance.toFixed(2)}`} />
        <StatBox label="XP Points" value={user.xp_points.toString()} />
        <StatBox label="Level" value={user.level.toString()} />
        <StatBox label="Tasks Left" value="12,402" muted />
      </div>
    </div>
  );
}

function ActionCard({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white rounded-3xl p-6 border border-[#1a1a1a]/5 flex flex-col gap-4 text-left group hover:shadow-xl transition-all active:scale-[0.98]"
    >
      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-[#1a1a1a]/50 font-medium">{description}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-[#5A5A40] text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight size={16} />
      </div>
    </button>
  );
}

function StatBox({ label, value, muted = false }: { label: string, value: string, muted?: boolean }) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-[#1a1a1a]/5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-1">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${muted ? 'opacity-40' : ''}`}>{value}</p>
    </div>
  );
}
