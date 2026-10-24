import React, { useState } from 'react';
import { TopNavigation } from './TopNavigation';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Boxes,
  AlertTriangle,
  Database,
  FileText,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BRAND_CONFIG } from '../../services/config';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    supabaseConfigError,
    supabaseConnectionStatus,
    recheckSupabaseConnection,
    migrationNotice,
    requests
  } = useApp();
  const [isRechecking, setIsRechecking] = useState(false);

  const isPublicPage = location.pathname === '/' || location.pathname === '/about' || location.pathname === '/contact';
  const isBriefingPage = location.pathname === '/briefing' || location.pathname === '/daily-briefing';
  const isAgentPage = location.pathname === '/agent';
  const pendingCount = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review').length;

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      await recheckSupabaseConnection();
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#F8F6F2] text-[#46362F] flex flex-col font-['Manrope',sans-serif] relative selection:bg-[#E8E2F0] selection:text-[#46362F]">
      {/* Horizontal Deep Espresso Top Navigation */}
      <TopNavigation />

      {/* Explicit Supabase Configuration / Connection Error Banner (Shown on operational routes) */}
      {!isPublicPage && supabaseConfigError && (
        <div
          role="alert"
          className="bg-[#B42335] text-white px-3.5 sm:px-6 py-2.5 text-xs border-b border-[#961b2b] shadow-xs w-full"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 max-w-[1440px] mx-auto w-full min-w-0">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#F8C8CE] mt-0.5 sm:mt-0" />
              <div className="min-w-0 break-words">
                <span className="font-bold">
                  {supabaseConnectionStatus === 'connection_failed'
                    ? 'Supabase Connection Error: '
                    : 'Supabase Configuration Error: '}
                </span>
                <span>{supabaseConfigError}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleRecheck}
                disabled={isRechecking}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-semibold rounded text-[11px] whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRechecking ? 'animate-spin' : ''}`} />
                <span>{isRechecking ? 'Checking…' : 'Retry Connection'}</span>
              </button>
              <Link 
                to="/settings?tab=supabase" 
                className="px-2.5 py-1 bg-white text-[#B42335] font-semibold rounded text-[11px] whitespace-nowrap hover:bg-[#F8F6F2] transition-colors"
              >
                Review Configuration
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Migration Notice Banner (Shown on operational routes when tables are missing) */}
      {!isPublicPage && migrationNotice && !supabaseConfigError && (
        <div className="bg-[#46362F] text-[#F8F6F2] border-b border-[#D9C6A5]/30 px-3.5 sm:px-6 py-2.5 text-xs shadow-xs w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-[1440px] mx-auto w-full min-w-0">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <Database className="w-4 h-4 text-[#D9C6A5] shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0 break-words">
                <span className="font-bold">Database Setup Notice: </span>
                <span>PostgreSQL database tables not detected. Please run the SQL migrations in the Supabase SQL Editor to activate live storage.</span>
              </div>
            </div>
            <Link 
              to="/settings?tab=supabase" 
              className="px-2.5 py-1 bg-[#D9C6A5] text-[#46362F] font-semibold rounded text-[11px] whitespace-nowrap hover:bg-[#c9b48f] transition-colors self-start sm:self-auto shrink-0"
            >
              View SQL Migrations
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full min-w-0 mx-auto px-3.5 sm:px-6 py-5 sm:py-8">
        {children}
      </main>

      {/* Editorial Multi-Column Enterprise Footer */}
      <footer className="border-t border-[#E7E0D8] bg-[#F8F6F2] pt-10 sm:pt-12 pb-8 text-xs text-[#6B625B] w-full">
        <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#E7E0D8]">
            
            {/* Column 1: Brand & Platform Identity (5 cols) */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#324536] border border-[#8A9A83]/30 flex items-center justify-center text-[#BCE8D3]">
                  <Boxes className="w-4 h-4 text-[#BCE8D3]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif font-bold text-base text-[#46362F]">{BRAND_CONFIG.appName}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-[#46362F] bg-[#D9C6A5] rounded tracking-wider">
                      AI
                    </span>
                  </div>
                  <p className="text-[9px] uppercase tracking-widest text-[#6B625B] font-medium">
                    {BRAND_CONFIG.tagline}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#6B625B] leading-relaxed max-w-sm">
                {BRAND_CONFIG.appName} — {BRAND_CONFIG.subtitle} Predicts stockout risk during supplier lead times, reconciles in-transit orders, enforces packaging constraints, and drafts verified purchase proposals for procurement approval.
              </p>

              {/* Platform Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8A9A83]/40 bg-white text-[11px] text-[#324536] font-medium shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A9A83] animate-pulse" />
                <span>{BRAND_CONFIG.appName} Intelligence Engine • Active</span>
              </div>
            </div>

            {/* Column 2: Navigation Links (2 cols) */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#46362F]">
                Navigation
              </h4>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link to="/" className="hover:text-[#46362F] transition-colors">About & Overview</Link>
                </li>
                <li>
                  <Link to="/home" className="hover:text-[#46362F] transition-colors">Home Dashboard</Link>
                </li>
                <li>
                  <Link to="/briefing" className="hover:text-[#46362F] transition-colors font-semibold text-[#324536]">
                    Daily Briefing
                  </Link>
                </li>
                <li>
                  <Link to="/agent" className="hover:text-[#46362F] transition-colors flex items-center gap-1">
                    <span>{BRAND_CONFIG.copilotName}</span>
                    <span className="text-[9px] font-bold text-[#46362F] bg-[#E8E2F0] px-1 rounded">AI</span>
                  </Link>
                </li>
                <li>
                  <Link to="/inventory" className="hover:text-[#46362F] transition-colors">Inventory Control</Link>
                </li>
                <li>
                  <Link to="/suppliers" className="hover:text-[#46362F] transition-colors">Incoming Orders</Link>
                </li>
                <li>
                  <Link to="/approvals" className="hover:text-[#46362F] transition-colors">Approval Center</Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Disruption Playbooks (3 cols) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#46362F]">
                Disruption Playbooks
              </h4>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link to="/test-lab" className="hover:text-[#46362F] transition-colors">Lead-Time Depletion (TC1)</Link>
                </li>
                <li>
                  <Link to="/test-lab" className="hover:text-[#46362F] transition-colors">Case Pack Multiples of 12 (TC2)</Link>
                </li>
                <li>
                  <Link to="/test-lab" className="hover:text-[#46362F] transition-colors">Inbound Duplicate Cover (TC3)</Link>
                </li>
                <li>
                  <Link to="/test-lab" className="hover:text-[#46362F] transition-colors">Supplier 20% Price Spike (TC4)</Link>
                </li>
                <li>
                  <Link to="/audit" className="hover:text-[#46362F] transition-colors">Delivery Drift Audit Logging</Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Platform Resources & Governance (2 cols) */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#46362F]">
                Governance & Support
              </h4>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <Link to="/contact" className="hover:text-[#46362F] transition-colors">
                    Technical Support
                  </Link>
                </li>
                <li>
                  <Link to="/audit" className="hover:text-[#46362F] transition-colors">
                    Compliance Ledger
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:text-[#46362F] transition-colors">
                    Safety Principles
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className="hover:text-[#46362F] transition-colors">
                    Workspace Settings
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#6B625B]">
            <p>© 2026 {BRAND_CONFIG.appName}. {BRAND_CONFIG.tagline} Every reorder has a reason. Every decision has proof.</p>
            <div className="flex items-center gap-3">
              <span className="text-[#327456] font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Deterministic Rules Engine Active</span>
              </span>
              <span>·</span>
              <span className="font-mono bg-[#E7E0D8]/60 px-2 py-0.5 rounded text-[#46362F] font-semibold">
                INR Mode
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Persistent Floating Daily Briefing Quick Action (Hidden on Briefing page & Copilot chat page to prevent any overlap) */}
      {!isBriefingPage && !isAgentPage && (
        <div
          className="fixed bottom-4 right-3.5 sm:bottom-5 sm:right-5 z-40 pointer-events-none max-w-[calc(100vw-1.75rem)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button
            type="button"
            onClick={() => navigate('/briefing')}
            aria-label="Open In-App Daily Briefing"
            title="Open In-App Daily Briefing"
            className="pointer-events-auto quick-action-3d group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#46362F] hover:bg-[#324536] text-white text-xs font-semibold shadow-lg border border-[#D9C6A5]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C6A5] focus-visible:ring-offset-2"
          >
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#324536] group-hover:bg-[#46362F] text-[#BCE8D3] flex items-center justify-center border border-[#8A9A83]/40 transition-colors shrink-0">
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap">Daily Briefing</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-[#D9C6A5] text-[#46362F] leading-none tabular-nums">
                {pendingCount}
              </span>
            )}
            <ArrowUpRight className="w-3.5 h-3.5 text-[#D9C6A5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
