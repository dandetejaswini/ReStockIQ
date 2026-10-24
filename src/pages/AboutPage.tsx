import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ShieldCheck, 
  Calculator, 
  Boxes, 
  Truck, 
  CheckSquare, 
  FileText, 
  ArrowRight, 
  CheckCircle2,
  AlertTriangle,
  Bot,
  Bell,
  Package,
  Mail,
  Clock,
  Lock,
  Sliders,
  Compass,
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { BRAND_CONFIG } from '../services/config';
import {
  Interactive3DContainer,
  IsometricSupplyChainVisual,
  DailyBriefingSynthesisVisual,
} from '../components/visuals/SupplyChainVisuals';

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { currentUser } = useApp();
  const isAuthenticated = Boolean(firebaseUser || currentUser);

  const platformFeatures = [
    {
      icon: Package,
      badge: 'Real-Time Catalog',
      title: 'Inventory Overview',
      description:
        'Monitor stock levels, reserved quantities, and inventory health status across your store catalog. Quickly identify low-stock and stockout-exposed items with metrics computed strictly from your authorized store records.',
      points: [
        'Monitor on-hand, reserved, and usable stock levels',
        'Identify low-stock and out-of-stock products early',
        'Zero fabricated metrics — clean empty states until you add data',
      ],
      link: '/inventory',
      linkLabel: 'View Inventory Control',
    },
    {
      icon: Sparkles,
      badge: 'Deterministic Math',
      title: 'AI-Powered Suggestions',
      description:
        'Generate actionable inventory and replenishment recommendations grounded in your actual daily sales velocity, supplier lead times, and safety buffers — with step-by-step explanations of why each recommendation matters.',
      points: [
        'Lead-time demand & safety stock reconciliation',
        'Transparent formula trace for every suggested order',
        'Never invents recommendations when catalog data is missing',
      ],
      link: '/briefing',
      linkLabel: 'Explore Daily Briefing',
    },
    {
      icon: Bell,
      badge: 'Proactive Signals',
      title: 'Smart Alerts',
      description:
        'Stay ahead of lead-time stockout risks, 20%+ supplier price surges, and pending purchase approvals. Includes configurable workspace alert rules and scheduled daily briefing email support.',
      points: [
        'Real-time alerts for stockout risk and ≥20% vendor price jumps',
        'Mandatory budget review gate for supplier price spikes',
        `Daily suggestion emails scheduled for ~${BRAND_CONFIG.dailyBriefTimeIST} once email automation is configured and verified`,
      ],
      link: '/settings',
      linkLabel: 'Configure Alert Rules',
    },
    {
      icon: Boxes,
      badge: 'Case-Pack Aware',
      title: 'Replenishment Planning',
      description:
        'Automatically reconcile open inbound purchase orders to prevent duplicate ordering, convert net unit deficits into supplier case-pack multiples, and route proposals through human approval workflows.',
      points: [
        'Offsets active in-transit supplier orders automatically',
        'Rounds order quantities to vendor case pack multiples',
        'Preserves supplier contracts and human-in-the-loop approvals',
      ],
      link: '/approvals',
      linkLabel: 'Open Approval Center',
    },
    {
      icon: Bot,
      badge: 'Interactive Assistant',
      title: `AI Assistant — ${BRAND_CONFIG.copilotName}`,
      description:
        `Ask inventory-related questions in natural language and receive deterministic, data-grounded answers from ${BRAND_CONFIG.copilotName} — paired with a live Replenishment Decision Room and cryptographic evidence panel.`,
      points: [
        'Ask which products need replenishment or face stockout risk',
        'Inspect unit-level math and supplier packaging constraints',
        'Draft purchase proposals directly for manager sign-off',
      ],
      link: '/agent',
      linkLabel: `Launch ${BRAND_CONFIG.copilotName}`,
    },
    {
      icon: Lock,
      badge: 'Multi-Layer Security',
      title: 'Secure Workspace',
      description:
        'Protected user authentication and profile management powered by Firebase Authentication (Google & Email/Password), Cloud Firestore user profiles, and Supabase PostgreSQL with Row-Level Security (RLS).',
      points: [
        'Google OAuth & Email/Password workspace authentication',
        'Tenant-isolated PostgreSQL storage with Row-Level Security',
        'Append-only audit trail for every inventory and approval event',
      ],
      link: '/audit',
      linkLabel: 'Inspect Audit Ledger',
    },
  ];

  const howItWorksSteps = [
    {
      stepNumber: '01',
      title: 'Connect to your workspace and access your inventory',
      description:
        'Sign in with Google or your work email, complete your store lead profile, and populate your catalog by adding SKUs manually or importing a CSV alongside your supplier lead times and pack sizes.',
      icon: Compass,
      accent: 'Workspace & Catalog Setup',
    },
    {
      stepNumber: '02',
      title: 'Review stock insights and AI-generated recommendations',
      description:
        `Examine deterministic lead-time demand forecasts, active inbound order offsets, and case-pack conversions in the dashboard or ask ${BRAND_CONFIG.copilotName} to summarize current low-stock items and inventory risks.`,
      icon: Calculator,
      accent: 'Deterministic Intelligence',
    },
    {
      stepNumber: '03',
      title: 'Take action and receive relevant alerts',
      description:
        'Submit verified replenishment proposals to the Approval Center for human sign-off, track supplier price variance guardrails, and configure your daily inventory brief preferences.',
      icon: CheckSquare,
      accent: 'Governed Execution & Alerts',
    },
  ];

  const officialScenarios = [
    {
      id: 'TC1',
      title: 'Lead-Time Stockout Depletion',
      desc: 'Calculates exact net replenishment (18 units) when usable stock falls below lead-time demand plus safety buffer with zero open inbound orders.',
    },
    {
      id: 'TC2',
      title: 'Supplier Case-Pack Multiples of 12',
      desc: 'Converts an unrounded 17-unit deficit into 2 full vendor cases (24 units) and transparently accounts for the +7 unit carryover buffer.',
    },
    {
      id: 'TC3',
      title: 'Inbound Order Duplicate Prevention',
      desc: 'Detects an active 30-unit in-transit purchase order covering lead-time demand and automatically suppresses duplicate order creation.',
    },
    {
      id: 'TC4',
      title: 'Supplier 20%+ Price Surge Gate',
      desc: 'Flags a +25% unit price increase (≥20% threshold), blocks standard auto-approval, and routes the proposal to Needs Budget Review.',
    },
  ];

  return (
    <div className="space-y-14 max-w-6xl mx-auto py-2 pb-12 font-sans">
      
      {/* ===================================================================== */}
      {/* 1. HERO SECTION                                                       */}
      {/* ===================================================================== */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E7E0D8] bg-gradient-to-br from-[#46362F] via-[#3A2C26] to-[#2B201C] text-white shadow-sm animate-fade-up">
        {/* Subtle decorative background grid */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(217, 198, 165, 0.55) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10 lg:p-12 items-center">
          {/* Left Hero Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#D9C6A5] text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>{BRAND_CONFIG.appName} · {BRAND_CONFIG.subtitle}</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-[54px] font-normal tracking-tight text-white leading-[1.08]">
                {BRAND_CONFIG.tagline}
              </h1>
              <p className="text-sm sm:text-base text-[#E8E2F0]/90 max-w-xl leading-relaxed">
                {BRAND_CONFIG.subtitle} Make better inventory decisions with AI-powered stock insights, replenishment suggestions, and timely alerts — all in one place.
              </p>
            </div>

            {/* Primary & Secondary CTAs + Immediate Daily Briefing Quick Action */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => navigate(isAuthenticated ? '/home' : '/agent')}
                className="quick-action-3d inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D9C6A5] hover:bg-[#c9b48f] text-[#46362F] text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/briefing"
                aria-label="Open In-App Daily Briefing"
                className="quick-action-3d inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#324536] hover:bg-[#3d5442] border border-[#8A9A83]/60 text-[#BCE8D3] text-xs sm:text-sm font-semibold shadow-xs transition-all"
              >
                <FileText className="w-4 h-4 text-[#BCE8D3]" aria-hidden="true" />
                <span>Daily Briefing</span>
              </Link>

              <Link
                to={isAuthenticated ? '/home' : '/signup'}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/25 text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <span>{isAuthenticated ? 'Go to Home Dashboard' : 'Get Started'}</span>
              </Link>

              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="text-xs font-semibold text-[#D9C6A5] hover:text-white underline underline-offset-4 px-2 py-2 transition-colors"
                >
                  Sign In to Workspace →
                </Link>
              )}
            </div>

            {/* Core Capability Highlights (No fabricated customer stats) */}
            <div className="pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/85">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#BCE8D3] shrink-0" />
                <span>Deterministic Lead-Time Math</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#BCE8D3] shrink-0" />
                <span>Inbound Order Reconciliation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#BCE8D3] shrink-0" />
                <span>Human-in-the-Loop Governance</span>
              </div>
            </div>
          </div>

          {/* Right Animated 3D Isometric Product Visual & SVG Flow (5 cols) */}
          <div className="lg:col-span-5">
            <Interactive3DContainer className="bg-[#F8F6F2] text-[#46362F] rounded-2xl p-5 border border-[#E7E0D8] shadow-xl space-y-4">
              {/* Top Mini Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#327456]" />
                  <span className="text-xs font-bold text-[#46362F]">
                    {BRAND_CONFIG.appName} Live Decision Preview
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E8E2F0] text-[#46362F]">
                  DETERMINISTIC_V1
                </span>
              </div>

              {/* Custom Isometric 3D Supply-Chain & AI Intelligence SVG Diagram */}
              <div className="bg-white rounded-xl p-3 border border-[#E7E0D8]">
                <IsometricSupplyChainVisual className="w-full h-36" />
              </div>

              {/* Sample Formula Breakdown Card */}
              <div className="p-3.5 bg-white rounded-xl border border-[#E7E0D8] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#46362F]">Replenishment Formula Trace</span>
                  <span className="text-[10px] font-semibold text-[#327456] bg-[#EBF7F0] px-2 py-0.5 rounded">
                    Explainable
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#46362F] bg-[#F8F6F2] p-2 rounded border border-[#E7E0D8]">
                  Net Need = (Daily Velocity × Lead Days + Safety Buffer) − Usable Stock − Open Inbound
                </p>
                <div className="flex items-center justify-between text-[11px] text-[#6B625B] pt-1">
                  <span>Rounds to vendor pack multiples</span>
                  <Link
                    to="/agent"
                    className="font-bold text-[#46362F] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open {BRAND_CONFIG.copilotName}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </Interactive3DContainer>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. APPLICATION FEATURES SECTION                                       */}
      {/* ===================================================================== */}
      <section id="platform-features" className="space-y-6 animate-fade-up-delay-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E7E0D8] pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8A9A83]">
              CORE PLATFORM CAPABILITIES
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#46362F]">
              Built for Grounded, Explainable Inventory Operations
            </h2>
          </div>
          <p className="text-xs text-[#6B625B] max-w-md">
            Every capability in {BRAND_CONFIG.appName} is connected to your real workspace records — with zero dummy metrics or unverified autonomous spending.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {platformFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="card-3d-subtle bg-white border border-[#E7E0D8] rounded-2xl p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#46362F] text-[#D9C6A5] flex items-center justify-center shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F]">
                      {feat.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-serif text-xl font-normal text-[#46362F]">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-[#6B625B] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  <ul className="space-y-1.5 pt-1">
                    {feat.points.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2 text-[11px] text-[#46362F]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#8A9A83] shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-[#E7E0D8]">
                  <Link
                    to={feat.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#46362F] hover:text-[#324536] transition-colors group"
                  >
                    <span>{feat.linkLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. HOW IT WORKS — 3-STEP VISUAL FLOW                                  */}
      {/* ===================================================================== */}
      <section className="bg-white border border-[#E7E0D8] rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 animate-fade-up-delay-2">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8A9A83]">
            WORKFLOW ARCHITECTURE
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#46362F]">
            How {BRAND_CONFIG.appName} Works in Three Steps
          </h2>
          <p className="text-xs text-[#6B625B] leading-relaxed">
            From connecting your store workspace to reviewing explainable AI replenishment calculations and authorizing purchase orders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {howItWorksSteps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.stepNumber}
                className="relative p-6 rounded-2xl bg-[#F8F6F2] border border-[#E7E0D8] space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#46362F] text-[#D9C6A5]">
                      STEP {step.stepNumber}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D8] flex items-center justify-center text-[#46362F]">
                      <StepIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-serif text-lg font-normal text-[#46362F] leading-snug">
                    {step.title}
                  </h3>

                  <p className="text-xs text-[#6B625B] leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E7E0D8] flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#46362F]">{step.accent}</span>
                  <span className="font-mono text-[#8A9A83] font-bold">0{index + 1} / 03</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. DAILY 10 AM EMAIL FEATURE — "YOUR DAILY INVENTORY BRIEF"           */}
      {/* ===================================================================== */}
      <section className="rounded-3xl border border-[#E7E0D8] bg-gradient-to-br from-[#F8F6F2] via-white to-[#E8E2F0]/35 p-6 sm:p-10 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Explanation (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#46362F] text-[#D9C6A5] text-xs font-semibold">
              <Mail className="w-3.5 h-3.5" />
              <span>Scheduled Morning Intelligence · {BRAND_CONFIG.dailyBriefTimeIST}</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#46362F]">
              Your Daily Inventory Brief
            </h2>

            <p className="text-sm text-[#46362F] font-medium leading-relaxed">
              Start your day with a concise overview of important inventory signals and suggested actions.
            </p>

            <p className="text-xs text-[#6B625B] leading-relaxed">
              {BRAND_CONFIG.appName} compiles your store’s lead-time stockout exposures, open inbound shipments, supplier price variance alerts, and pending reorder approvals into a structured daily briefing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-[#E7E0D8] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#46362F]">
                  <Clock className="w-4 h-4 text-[#8A9A83]" />
                  <span>Scheduled for ~{BRAND_CONFIG.dailyBriefTimeIST}</span>
                </div>
                <p className="text-[11px] text-[#6B625B] leading-relaxed">
                  Daily suggestion emails are intended to arrive at approximately {BRAND_CONFIG.dailyBriefTimeIST} so store leads can review priorities before vendor cutoffs.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-[#E7E0D8] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#46362F]">
                  <Sliders className="w-4 h-4 text-[#8A9A83]" />
                  <span>Data-Grounded & Configurable</span>
                </div>
                <p className="text-[11px] text-[#6B625B] leading-relaxed">
                  Suggestions depend on the availability and quality of inventory data in your catalog. Manage alert preferences anytime in Settings.
                </p>
              </div>
            </div>

            {/* Transparent Automation Verification Notice */}
            <div className="p-3.5 rounded-xl bg-[#FFF8E6] border border-[#D9C6A5] flex items-start gap-2.5 text-xs text-[#46362F]">
              <AlertTriangle className="w-4 h-4 text-[#B7791F] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Email Automation Status Notice:</span>
                <p className="text-[11px] text-[#6B625B] leading-relaxed">
                  {BRAND_CONFIG.emailAutomationVerified
                    ? `Automated daily ${BRAND_CONFIG.dailyBriefTimeIST} email delivery is configured and verified.`
                    : `In-app Daily Briefings are live now. Automated outbound ${BRAND_CONFIG.dailyBriefTimeIST} email delivery depends on completing and verifying the Google Apps Script email trigger configuration for your deployment.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/briefing"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#46362F] hover:bg-[#342721] text-white text-xs font-semibold transition-colors"
              >
                <span>Open In-App Daily Briefing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] text-xs font-semibold transition-colors"
              >
                <span>Manage Alert Preferences</span>
              </Link>
            </div>
          </div>

          {/* Right Digest Preview Card (5 cols) */}
          <div className="lg:col-span-5">
            <Interactive3DContainer className="bg-white rounded-2xl border border-[#E7E0D8] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E0D8]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#46362F] text-[#D9C6A5] flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#46362F]">
                      {BRAND_CONFIG.appName} Morning Brief Structure
                    </h3>
                    <p className="text-[10px] text-[#6B625B]">
                      Target Window: ~{BRAND_CONFIG.dailyBriefTimeIST} · Store Lead Digest
                    </p>
                  </div>
                </div>
                <DailyBriefingSynthesisVisual className="w-16 h-12 shrink-0" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E7E0D8] flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[#46362F] block">1. Lead-Time Stockout Exposures</span>
                    <span className="text-[11px] text-[#6B625B]">
                      SKUs where usable stock + open inbound is below lead-time demand
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#B42335] bg-[#FDF0F2] px-2 py-0.5 rounded shrink-0">
                    Priority 1
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E7E0D8] flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[#46362F] block">2. Case-Pack Adjusted Reorder Quantities</span>
                    <span className="text-[11px] text-[#6B625B]">
                      Exact case counts and estimated INR cost grounded in supplier contracts
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded shrink-0">
                    Pack Math
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E7E0D8] flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[#46362F] block">3. Price Variance & Approval Queue</span>
                    <span className="text-[11px] text-[#6B625B]">
                      Highlights ≥20% vendor price jumps and proposals awaiting sign-off
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#8A5F00] bg-[#FFF8E6] px-2 py-0.5 rounded shrink-0">
                    Guarded
                  </span>
                </div>
              </div>
            </Interactive3DContainer>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. DETERMINISTIC VERIFICATION & 4 OFFICIAL SCENARIOS (TC1-TC4)        */}
      {/* ===================================================================== */}
      <section className="bg-white border border-[#E7E0D8] rounded-3xl p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E0D8] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#8A9A83]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8A9A83]">
                VERIFIABLE RULE ENGINE
              </span>
            </div>
            <h2 className="font-serif text-2xl font-normal text-[#46362F]">
              4 Official Replenishment Verification Scenarios
            </h2>
          </div>
          <Link
            to="/test-lab"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F8F6F2] hover:bg-[#E8E2F0]/50 border border-[#E7E0D8] text-xs font-bold text-[#46362F] transition-colors self-start sm:self-auto"
          >
            <span>Run Scenarios in Test Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {officialScenarios.map((sc) => (
            <div
              key={sc.id}
              className="p-4 rounded-2xl bg-[#F8F6F2] border border-[#E7E0D8] space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-[#E7E0D8] text-[#46362F]">
                  {sc.id}
                </span>
                <h3 className="text-xs font-bold text-[#46362F] pt-1">{sc.title}</h3>
                <p className="text-[11px] text-[#6B625B] leading-relaxed">{sc.desc}</p>
              </div>
              <div className="pt-2 border-t border-[#E7E0D8]/80 flex items-center justify-between text-[10px] text-[#327456] font-semibold">
                <span>Deterministic Check</span>
                <span>Verified</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. FINAL CALL TO ACTION                                               */}
      {/* ===================================================================== */}
      <section className="rounded-3xl bg-[#46362F] text-white p-8 sm:p-12 text-center space-y-6 shadow-sm">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#D9C6A5] text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{BRAND_CONFIG.appName} Workspace</span>
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-normal tracking-tight text-white">
            Ready to make inventory decisions with more confidence?
          </h2>
          <p className="text-xs sm:text-sm text-[#E8E2F0]/85 leading-relaxed">
            Create your store workspace or sign in to monitor inventory health, run {BRAND_CONFIG.copilotName}, and manage verified replenishment proposals.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
          {isAuthenticated ? (
            <>
              <Link
                to="/home"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D9C6A5] hover:bg-[#c9b48f] text-[#46362F] text-xs sm:text-sm font-bold shadow-xs transition-all"
              >
                <span>Open Home Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/agent"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/25 text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <span>Launch {BRAND_CONFIG.copilotName}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D9C6A5] hover:bg-[#c9b48f] text-[#46362F] text-xs sm:text-sm font-bold shadow-xs transition-all"
              >
                <span>Create Account (Sign Up)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/25 text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <span>Sign In to Workspace</span>
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
