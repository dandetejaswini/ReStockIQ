import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Sparkles, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { auth } from '../lib/firebase';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await sendPasswordResetEmail(auth, trimmed);
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send password reset email. Please verify your email address.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-[#E7E0D8] rounded-xl shadow-xs p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#46362F] text-white shadow-xs">
            <Sparkles className="w-6 h-6 text-[#D9C6A5]" />
          </div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
            Reset Password
          </h1>
          <p className="text-xs text-[#6B625B]">
            Enter your store email to receive a password reset link.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg text-[#B42335] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#8A9A83]/10 border border-[#8A9A83]/30 rounded-lg text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#8A9A83] mx-auto" />
              <p className="text-xs font-semibold text-[#46362F]">
                Password Reset Email Sent
              </p>
              <p className="text-[11px] text-[#6B625B] leading-relaxed">
                A password recovery email has been dispatched to <strong>{email}</strong>. Please check your inbox and follow the instructions.
              </p>
            </div>

            <Link
              to="/login"
              className="w-full py-2.5 px-4 text-xs font-medium text-center text-[#46362F] bg-[#E8E2F0] hover:bg-[#ded5e9] rounded-lg block transition-colors"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Store Work Email</label>
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B625B] hover:text-[#46362F]">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
