import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Building2,
  LockKeyhole
} from 'lucide-react';
import api from '../../api/axios';
import gsap from 'gsap';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const backNavRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // GSAP Entrance Animation with Lifecycle Cleanup
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out', clearProps: 'all' },
      });

      // 1. Navigation
      if (backNavRef.current) {
        tl.fromTo(
          backNavRef.current,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.35 }
        );
      }

      // 2. Brand header elements
      if (brandRef.current && brandRef.current.children.length > 0) {
        tl.fromTo(
          brandRef.current.children,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.4 },
          '-=0.15'
        );
      }

      // 3. Main Login Card
      if (cardRef.current) {
        tl.fromTo(
          cardRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.45 },
          '-=0.2'
        );
      }

      // 4. Form fields
      if (fieldsRef.current && fieldsRef.current.children.length > 0) {
        tl.fromTo(
          fieldsRef.current.children,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.35 },
          '-=0.25'
        );
      }

      // 5. Submit button
      if (submitBtnRef.current) {
        tl.fromTo(
          submitBtnRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.3 },
          '-=0.15'
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Subtle GSAP animation when error state occurs
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      errorRef.current,
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data.data;
      login(accessToken, user);
      navigate('/hub');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Invalid institutional credentials or network error.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-secondary/30 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans text-foreground"
    >
      {/* Top Header Navigation */}
      <div 
        ref={backNavRef}
        className="w-full max-w-md sm:max-w-xl mx-auto flex items-center justify-between pt-2 pb-4"
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2 py-1.5"
          aria-label="Return to public landing page"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to home</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-background/80 px-2.5 py-1 rounded-full border border-border shadow-2xs">
          <LockKeyhole className="w-3.5 h-3.5 text-primary" />
          <span>Single Sign-On</span>
        </div>
      </div>

      {/* Main Centered Login Card Area */}
      <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
        {/* Brand Header */}
        <div ref={brandRef} className="flex flex-col items-center text-center mb-6">
          <div 
            onClick={() => navigate('/')}
            className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs mb-3 cursor-pointer transition-transform hover:scale-102"
            title="Return to INCA Home"
          >
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              INCA
            </h1>
            <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              Campus Portal
            </span>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground font-normal mt-1">
            Intelligent Campus Assistant
          </p>
        </div>

        {/* Card Container */}
        <div 
          ref={cardRef}
          className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8"
        >
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Welcome to INCA
            </h2>
            <p className="text-xs text-muted-foreground mt-1 text-balance">
              One secure sign-in for students, faculty, and administrators.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Banner */}
            {error && (
              <div 
                ref={errorRef}
                role="alert"
                className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium leading-relaxed flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                <span>{error}</span>
              </div>
            )}

            <div ref={fieldsRef} className="space-y-4">
              {/* Institutional Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Institutional Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@inca.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 rounded-xl border-border bg-background h-11 text-sm focus-visible:ring-ring"
                    autoComplete="username"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 rounded-xl border-border bg-background h-11 text-sm focus-visible:ring-ring"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Primary Submit Button */}
            <Button
              ref={submitBtnRef}
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-medium rounded-xl text-sm shadow-xs transition-all cursor-pointer mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Unified Platform Access Notice */}
          <div className="mt-6 pt-5 border-t border-border/80 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Role permissions are resolved automatically upon sign-in.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Understated Institutional Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-4 text-[11px] text-muted-foreground">
        <div>
          &copy; {new Date().getFullYear()} INCA. Intelligent Campus Assistant. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
