import React, { useState } from 'react';
import { Sparkles, ShieldCheck, ArrowRight, Building, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface GoogleOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const GoogleOnboardingModal: React.FC<GoogleOnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const { firebaseUser, submitOnboarding } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [acknowledged, setAcknowledged] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError('Please provide a store, warehouse, or enterprise business name.');
      return;
    }
    if (!acknowledged) {
      setError('Please acknowledge store procurement governance and safety rules.');
      return;
    }

    setError(null);
    setIsLoading(true);

    const res = await submitOnboarding(storeName.trim());
    setIsLoading(false);

    if (res.success) {
      onComplete();
    } else {
      setError(res.error || 'Failed to complete onboarding. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E7E0D8] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#46362F] text-white flex items-center justify-center mx-auto shadow-xs">
            <Building className="w-6 h-6 text-[#D9C6A5]" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8E2F0] text-[#46362F] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#8A9A83]" />
            <span>Google Account Connected</span>
          </div>
          <h2 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
            Welcome, {firebaseUser?.displayName || 'Store Lead'}
          </h2>
          <p className="text-xs text-[#6B625B] max-w-md mx-auto leading-relaxed">
            To initialize your replenishment workspace, please specify your store or warehouse location and acknowledge procurement governance.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg text-[#B42335] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#46362F] mb-1.5">
              Store / Business Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Indiranagar Retail Branch / North Hub"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full p-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F] font-medium"
            />
          </div>

          <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8A9A83]" />
              <span className="font-semibold text-[#46362F]">Store Procurement Governance</span>
            </div>
            <p className="text-[11px] text-[#6B625B] leading-relaxed">
              Every reorder has proof. Reorder proposals are verified against lead times, rounded to supplier pack multiples, and checked against a 20% price spike threshold.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="acknowledge-rules"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="w-4 h-4 text-[#46362F] rounded accent-[#46362F]"
            />
            <label htmlFor="acknowledge-rules" className="text-[11px] text-[#46362F] cursor-pointer">
              I acknowledge store procurement governance and safety rules.
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !storeName.trim() || !acknowledged}
            className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span>{isLoading ? 'Saving Workspace...' : 'Complete Setup & Open Workspace'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
