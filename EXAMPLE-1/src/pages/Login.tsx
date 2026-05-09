import React, { useState } from 'react';

export default function Login({ onLogin }: { onLogin: (id: string, role: string) => void }) {
  const [selectedUser, setSelectedUser] = useState<string>('u1');

  // Hardcoded seeded users
  const users = [
    { id: 'u1', username: 'annotator_1', role: 'ANNOTATOR' },
    { id: 'u2', username: 'reviewer_1', role: 'REVIEWER' }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.id === selectedUser);
    if (user) {
      onLogin(user.id, user.role);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F7F7F7]">
      <div className="w-full max-w-md bg-white border-2 border-gray-200 border-b-8 rounded-[32px] p-8 shadow-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-[#CE82FF] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] text-white mb-6 text-4xl">
            🎓
          </div>
          <h2 className="text-3xl font-black text-[#4B4B4B]">Log in to Buntu</h2>
          <p className="text-gray-400 mt-2 font-bold uppercase tracking-wider text-sm">Select a test account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div>
            <div className="space-y-4">
              {users.map(u => (
                <label 
                  key={u.id} 
                  className={`flex items-center p-5 border-2 rounded-[24px] cursor-pointer transition-all ${
                    selectedUser === u.id 
                      ? 'border-[#1CB0F6] bg-[#E5F3FF]' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="user" 
                    value={u.id} 
                    checked={selectedUser === u.id}
                    onChange={() => setSelectedUser(u.id)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <p className={`font-black text-xl ${selectedUser === u.id ? 'text-[#1CB0F6]' : 'text-[#4B4B4B]'}`}>
                      {u.username}
                    </p>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-wide mt-1">Role: {u.role}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedUser === u.id ? 'border-[#1CB0F6]' : 'border-gray-300'
                  }`}>
                    {selectedUser === u.id && <div className="w-3 h-3 bg-[#1CB0F6] rounded-full" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          <button 
            type="submit"
            className="w-full py-5 rounded-[24px] bg-[#58CC02] border-b-4 border-[#46A302] text-white font-black text-xl uppercase tracking-wider hover:brightness-110 active:border-b-0 active:translate-y-1 transition-all"
          >
            Enter Platform
          </button>
        </form>
      </div>
    </div>
  );
}
