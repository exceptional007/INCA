import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
      navigate('/hub');
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
    <div className="min-h-screen bg-canvas-parchment flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Title Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[11px] bg-action-blue text-white mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink leading-tight">
            INCA
          </h1>
          <p className="text-sm text-ink-muted-80 font-normal mt-1">
            Intelligent Campus Assistant
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="bg-white border border-[#e0e0e0] rounded-[18px] shadow-none overflow-hidden">
          <CardHeader className="pt-8 pb-6 px-8 text-center">
            <CardTitle className="text-xl font-semibold tracking-tight text-ink">Sign In</CardTitle>
            <CardDescription className="text-xs text-ink-muted-80 font-normal mt-1.5">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3..5 rounded-[8px] bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold leading-relaxed">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-ink">Institutional Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-muted-48" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@inca.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 rounded-full border-[#e0e0e0] focus-visible:ring-ring"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-ink">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-muted-48" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 rounded-full border-[#e0e0e0] focus-visible:ring-ring"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-3 bg-action-blue text-white rounded-full h-11 active:scale-95 transition-transform"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col border-t border-[#e0e0e0] pt-6 pb-8 px-8 bg-canvas-parchment/60 gap-4">
            <div className="flex items-center justify-between w-full text-xs font-semibold text-ink-muted-80">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-action-blue" /> Test Credentials
              </span>
              <span className="text-[10px] text-ink-muted-48">Click to auto-fill</span>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestUser('admin@inca.edu', 'Admin@123')}
                className="text-[11px] h-8 rounded-full border-[#e0e0e0] text-ink hover:bg-canvas-parchment cursor-pointer"
              >
                <UserCheck className="w-3 h-3 mr-1" /> Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestUser('faculty@inca.edu', 'Faculty@123')}
                className="text-[11px] h-8 rounded-full border-[#e0e0e0] text-ink hover:bg-canvas-parchment cursor-pointer"
              >
                <UserCheck className="w-3 h-3 mr-1" /> Faculty
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestUser('student@inca.edu', 'Student@123')}
                className="text-[11px] h-8 rounded-full border-[#e0e0e0] text-ink hover:bg-canvas-parchment cursor-pointer"
              >
                <UserCheck className="w-3 h-3 mr-1" /> Student
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Footer */}
        <p className="text-center text-[11px] text-ink-muted-48">
          &copy; 2026 INCA Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
};
