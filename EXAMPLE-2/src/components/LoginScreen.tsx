import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        if (isRegister) {
          setIsRegister(false);
          setUsername('');
          setPassword('');
          alert('Registration successful! Please login.');
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md border border-[#1a1a1a]/5"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white text-3xl font-bold italic mb-4 shadow-lg">
            B
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">BUNTU-TASKS</h1>
          <p className="text-[#5A5A40]/60 text-sm font-medium mt-1">Preserving Kirundi through Scholar SFT</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-1.5 ml-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all font-medium"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all font-medium"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5A5A40] text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A35] transition-colors shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            disabled={loading}
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm font-bold text-[#5A5A40]/60 hover:text-[#5A5A40] transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
