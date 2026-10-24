import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { signInUser, isSupabaseReady } from '../services/supabaseClient';
import { getBackendConfig } from '../services/config';
import { GoogleOnboardingModal } from '../components/onboarding/GoogleOnboardingModal';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginUser } = useApp();
  const { signInWithGoogle, signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleSuccess, setGoogleSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isGoogleLoading) return;
    setErrorMessage(null);
    setGoogleSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);

    const config = getBackendConfig();
    if (config.isMisconfigured) {
      setErrorMessage(`Configuration Error: ${config.configError}`);
      setIsLoading(false);
      return;
    }

    // 1. Authenticate with Firebase Email/Password
    let firebaseAuthError: string | undefined;
    try {
      const fbRes = await signInWithEmail(trimmedEmail, password);
      if (fbRes.success) {
        // Also attempt to sign in to Supabase if the user has a matching Supabase account
        if (isSupabaseReady()) {
          await signInUser(trimmedEmail, password).catch(() => {});
        }
        loginUser(trimmedEmail, trimmedEmail.split('@')[0]);
        setIsLoading(false);
        navigate('/home');
        return;
      } else {
        firebaseAuthError = fbRes.error;
      }
    } catch (err: any) {
      firebaseAuthError = err?.message;
    }

    // 2. If not found in Firebase or using Supabase credentials directly, check Supabase Auth
    if (isSupabaseReady()) {
      const res = await signInUser(trimmedEmail, password);
      if (res.success && res.user) {
        loginUser(res.user.email, res.user.name);
        setIsLoading(false);
        navigate('/home');
        return;
      } else {
        setErrorMessage(firebaseAuthError || res.error || 'Invalid email or password. Please verify your credentials.');
        setIsLoading(false);
        return;
      }
    }

    setErrorMessage(firebaseAuthError || 'Authentication failed. Please verify your email and password.');
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    if (isLoading || isGoogleLoading) return;
    setErrorMessage(null);
    setGoogleSuccess(null);
    setIsGoogleLoading(true);
    
    const res = await signInWithGoogle();
    setIsGoogleLoading(false);

    if (res.success && res.profile) {
      loginUser(res.profile.email, res.profile.displayName);
      setGoogleSuccess(`Authenticated as ${res.profile.email}`);
      if (res.needsOnboarding) {
        setIsOnboardingModalOpen(true);
      } else {
        navigate('/home');
      }
    } else if (res.error) {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-4xl bg-white border border-[#E7E0D8] rounded-xl shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* Left Side: Brand Story & Governance Pillars */}
        <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-[#46362F] via-[#3A2C26] to-[#2B201C] p-8 text-white flex-col justify-between relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(217, 198, 165, 0.6) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[#D9C6A5]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-2xl font-normal tracking-tight">ReStockIQ</h2>
            <p className="text-xs text-[#E8E2F0] leading-relaxed italic">
              "Predict Shortages. Prevent Stockouts."
            </p>
            <p className="text-[11px] text-white/80 leading-relaxed">
              AI-powered inventory intelligence and supply-chain optimization. Predict stockouts during supplier lead time, reconcile in-transit supply, and verify supplier orders.
            </p>
          </div>

          <div className="relative z-10 space-y-2 pt-6 text-xs text-[#E8E2F0]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>Deterministic Lead-Time Rules</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>Case Pack Conversion (Cases of 12)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>Duplicate Inbound Prevention</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>20% Price Variance Guardrail</span>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication Form */}
        <div className="md:col-span-7 p-6 sm:p-10 space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif font-semibold text-lg text-[#46362F]">ReStockIQ</span>
              <span className="text-[10px] font-medium text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
                Procurement Portal
              </span>
            </div>
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Sign in to Workspace
            </h1>
            <p className="text-xs text-[#6B625B]">
              Authenticate to access your store inventory dashboard.
            </p>
          </div>

          {googleSuccess && (
            <div className="p-3 bg-[#EBF7F0] border border-[#BCE8D3] rounded-lg text-[#324536] text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8A9A83]" />
              <span>{googleSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg text-[#B42335] text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Work Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-medium text-[#46362F]">Password</label>
                <Link to="/forgot-password" className="text-[#46362F] hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 pr-9 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B625B] hover:text-[#46362F]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-[#E7E0D8] w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-[#6B625B] uppercase tracking-wider absolute">
              OR
            </span>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            aria-label="Continue with Google"
            className="w-full py-2.5 px-4 text-xs font-semibold text-[#46362F] bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] hover:border-[#46362F]/30 rounded-lg shadow-2xs transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>
              {isGoogleLoading
                ? 'Connecting to Google...'
                : googleSuccess
                ? 'Google Account Verified'
                : 'Continue with Google'}
            </span>
          </button>

          <p className="text-center text-xs text-[#6B625B]">
            Need an account?{' '}
            <Link to="/signup" className="text-[#46362F] font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Required Store Lead Onboarding Modal for Google Users */}
      <GoogleOnboardingModal
        isOpen={isOnboardingModalOpen}
        onComplete={() => {
          setIsOnboardingModalOpen(false);
          navigate('/home');
        }}
      />
    </div>
  );
};
