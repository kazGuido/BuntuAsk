import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AnnotateSession from './pages/AnnotateSession';
import ReviewQueue from './pages/ReviewQueue';

const queryClient = new QueryClient();

export default function App() {
  // Simple global state for current user context (mimicking auth)
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('userRole'));

  const login = (id: string, role: string) => {
    localStorage.setItem('userId', id);
    localStorage.setItem('userRole', role);
    setUserId(id);
    setUserRole(role);
  };

  const logout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    setUserId(null);
    setUserRole(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-[#F7F7F7] text-[#4B4B4B] font-sans flex flex-col select-none overflow-x-hidden">
          {/* Header Navigation */}
          <header className="h-20 px-8 flex items-center justify-between border-b-2 border-gray-100 bg-white shrink-0">
            <h1 className="text-2xl font-black tracking-tight text-[#58CC02]">Buntu-Tasks</h1>
            {userId && (
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-2 bg-[#E5F3FF] px-4 py-2 rounded-xl border-2 border-[#1CB0F6] border-b-4">
                  <span className="text-[#1CB0F6] font-bold text-sm tracking-tighter uppercase">ROLE: {userRole}</span>
                </div>
                <button onClick={logout} className="text-gray-400 hover:text-gray-600 transition-colors uppercase font-bold tracking-widest text-xs">
                  Logout
                </button>
              </div>
            )}
          </header>

          <main className="flex-1 flex flex-col relative overflow-hidden">
            <Routes>
              {!userId ? (
                <>
                  <Route path="*" element={<Navigate to="/login" />} />
                  <Route path="/login" element={<Login onLogin={login} />} />
                </>
              ) : (
                <>
                  <Route path="/login" element={<Navigate to="/" />} />
                  <Route path="/" element={<Dashboard userId={userId} userRole={userRole!} />} />
                  <Route path="/annotate" element={<AnnotateSession userId={userId} />} />
                  <Route path="/review" element={<ReviewQueue userId={userId} />} />
                </>
              )}
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

