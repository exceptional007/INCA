import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ShieldCheck, Mail, Lock, Sparkles, UserCheck } from 'lucide-react';
import api from '../../api/axios';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data.data;
      login(accessToken, user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Invalid credentials or connection error.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const setTestUser = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Brand Title Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2 shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            Project INCA
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Academic Scheduling & Smart Attendance Management
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-200 mb-1">
              Sign In to Your Account
            </h2>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium animate-fadeIn">
                {error}
              </div>
            )}

            <Input
              label="Institutional Email"
              type="email"
              placeholder="user@inca.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Test Credentials
              </span>
              <span className="text-[10px] text-slate-500">Click to fill</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTestUser('admin@inca.edu', 'Admin@123')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3 h-3" /> Admin
              </button>
              <button
                type="button"
                onClick={() => setTestUser('faculty@inca.edu', 'Faculty@123')}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-medium hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3 h-3" /> Faculty
              </button>
              <button
                type="button"
                onClick={() => setTestUser('student@inca.edu', 'Student@123')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3 h-3" /> Student
              </button>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          Integrated Next-Generation Campus Automation &copy; 2026
        </p>
      </div>
    </div>
  );
};
