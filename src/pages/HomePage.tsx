import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Truck, 
  CheckSquare, 
  Wallet, 
  ArrowRight, 
  Sparkles, 
  ChevronRight,
  ShieldCheck, 
  FileCheck,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Boxes,
  Cpu,
  BadgeAlert,
  Plus,
  Upload,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatCurrencyINR } from '../utils/formatters';
import { calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';
import { NewUserOnboarding } from '../components/onboarding/NewUserOnboarding';
import { AddSkuModal } from '../components/onboarding/AddSkuModal';
import { CsvImportModal } from '../components/onboarding/CsvImportModal';
import { DailyBriefing } from '../components/intelligence/DailyBriefing';
import { ActionQueue } from '../components/intelligence/ActionQueue';
import { WhatIfSimulator } from '../components/intelligence/WhatIfSimulator';
import {
  Interactive3DContainer,
  PredictiveReplenishmentVisual,
} from '../components/visuals/SupplyChainVisuals';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, firebaseUser } = useAuth();
  const { 
    currentUser,
    inventory, 
    suppliers, 
    orders, 
    requests, 
    setSelectedSku,
    addInventoryItem,
    importInventoryCsv,
    isOnboardingPreview,
    toggleOnboardingPreview
  } = useApp();

  const [isAddSkuOpen, setIsAddSkuOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  const displayName = userProfile?.displayName || firebaseUser?.displayName || currentUser?.name || firebaseUser?.email?.split('@')[0] || 'Store Procurement Lead';
  const storeName = userProfile?.storeName || 'Retail Store Workspace';

  // Compute metrics strictly from authorized real state
  const totalSkus = inventory.length;
  const activeOrders = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');
  const pendingApprovals = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review');

  const defaultSupplier = suppliers[0] || {
    id: 'UNASSIGNED',
    name: 'Unassigned Supplier',
    contactInformation: { representative: '', email: '', phone: '', address: '' },
    leadTimeDays: 5,
    packSize: 1,
    minimumOrderQuantity: 1,
    currentUnitPrice: 0,
    previousUnitPrice: 0,
    status: 'Active' as const,
  };

  const inventoryPlans = inventory.map(item => {
    const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
    return {
      item,
      plan: calculateReorderPlan(item, sup, orders),
      supplier: sup
    };
  });

  const lowStockCount = inventoryPlans.filter(p => p.plan.stockStatus === 'Low Stock').length;
  const criticalCount = inventoryPlans.filter(p => p.plan.stockStatus === 'Critical' || p.plan.stockStatus === 'Stockout Risk').length;

  // Real committed spend & inventory value
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);
  const committedSpend = requests
    .filter(r => r.status === 'Approved' || r.status === 'Verified')
    .reduce((sum, r) => sum + r.totalCost, 0);

  // Supplier price increase alert check (>= 20%)
  const priceAlerts = suppliers.filter(s => {
    const check = checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice);
    return check.isPriceJumped;
  });

  // Recharts: Stock Position vs Threshold Data
  const stockComparisonData = inventoryPlans.slice(0, 6).map(p => ({
    name: p.item.sku,
    Stock: p.item.currentStock,
    Threshold: p.item.reorderThreshold,
    Inbound: p.plan.incomingOpenOrders,
  }));

  // Featured SKU for Hero Card (real SKU from catalog)
  const featuredPlan = inventoryPlans.find(p => p.plan.stockStatus === 'Stockout Risk' || p.plan.stockStatus === 'Critical') || inventoryPlans[0];

  // 6-Step Visual Workflow Steps
  const workflowSteps = [
    {
      num: '01',
      title: 'Inventory Evidence',
      desc: 'Ingests verified stock levels, reservation buffers, and daily sales burn-rate from store ledgers.',
      icon: Package,
    },
    {
      num: '02',
      title: 'Inbound Reconciliation',
      desc: 'Audits active in-transit shipments to offset gross lead-time demand and prevent duplicate orders.',
      icon: Truck,
    },
    {
      num: '03',
      title: 'Pack-Size Math',
      desc: 'Rounds calculated replenishment units up to the vendor’s exact packaging multiples (e.g. cases of 12).',
      icon: Boxes,
    },
    {
      num: '04',
      title: 'Safeguards & Pricing',
      desc: 'Identifies unit price surges ≥ 20.0% and automatically diverts proposals to Budget Review.',
      icon: BadgeAlert,
    },
    {
      num: '05',
      title: 'Human Approval Gate',
      desc: 'Every purchase proposal requires explicit manager review and authorization before issuance.',
      icon: CheckSquare,
    },
    {
      num: '06',
      title: 'Audit Record',
      desc: 'Logs cryptographic event hashes, idempotency keys, and rationale traces for full governance.',
      icon: FileCheck,
    },
  ];

  // New user with no inventory data
  if (inventory.length === 0 || isOnboardingPreview) {
    return (
      <div className="space-y-6">
        {isOnboardingPreview && (
          <div className="flex items-center justify-between p-3.5 bg-[#FFF8E6] border border-[#D9C6A5] rounded-xl text-xs text-[#46362F] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B7791F] animate-ping" />
              <span>
                <strong>Onboarding View:</strong> Viewing empty catalog experience.
              </span>
            </div>
            <button
              onClick={toggleOnboardingPreview}
              className="px-3 py-1 font-bold text-xs bg-[#46362F] hover:bg-[#342721] text-white rounded-lg transition-colors"
            >
              Exit Onboarding Preview
            </button>
          </div>
        )}

        <NewUserOnboarding
          user={currentUser ? { ...currentUser, name: displayName } : null}
          onOpenAddSku={() => setIsAddSkuOpen(true)}
          onOpenCsvImport={() => setIsCsvImportOpen(true)}
          onConnectSupabase={() => navigate('/settings')}
          suppliers={suppliers}
        />

        <AddSkuModal 
          isOpen={isAddSkuOpen} 
          onClose={() => setIsAddSkuOpen(false)} 
          onAddSku={addInventoryItem} 
          suppliers={suppliers} 
        />

        <CsvImportModal 
          isOpen={isCsvImportOpen} 
          onClose={() => setIsCsvImportOpen(false)} 
          onImportItems={importInventoryCsv} 
          suppliers={suppliers} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Workspace Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-white border border-[#E7E0D8] rounded-2xl shadow-2xs text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#46362F] text-white flex items-center justify-center font-bold text-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#46362F]">{displayName}</span>
              <span className="text-[10px] text-[#324536] bg-[#8A9A83]/15 px-2 py-0.5 rounded border border-[#8A9A83]/30 font-semibold">
                {storeName}
              </span>
            </div>
            <p className="text-[11px] text-[#6B625B]">
              {inventory.length} Tracked SKUs · {suppliers.length} Suppliers · Deterministic Supply Chain Engine
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/briefing')}
            className="quick-action-3d flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#324536] rounded-lg shadow-2xs transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-[#D9C6A5]" />
            <span>Open Daily Briefing</span>
          </button>
          <button
            onClick={() => setIsAddSkuOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#46362F]" />
            <span>Add SKU</span>
          </button>
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#46362F]" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* Explainable Daily Briefing */}
      <DailyBriefing
        inventory={inventory}
        suppliers={suppliers}
        orders={orders}
        requests={requests}
      />

      {/* Top Subtitle Badge */}
      <div className="flex justify-start">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E7E0D8] bg-white text-[#46362F] text-xs font-medium shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#8A9A83]" />
          <span>Autonomous Predictive Supply Chain Intelligence</span>
        </div>
      </div>

      {/* Hero Section: Two-Column Balanced Editorial Layout */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          
          {/* Left Column */}
          <div className="lg:col-span-7 p-6 sm:p-10 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#E8E2F0] text-[#46362F] text-xs font-semibold tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#D9C6A5]" />
                <span className="uppercase text-[11px] font-bold">INTELLIGENT REPLENISHMENT OPERATIONS</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-serif text-3xl sm:text-5xl text-[#46362F] font-normal tracking-tight leading-[1.1]">
                  Predict Shortages.<br className="hidden sm:inline" /> Prevent Stockouts.
                </h1>
                <p className="text-sm text-[#6B625B] max-w-xl leading-relaxed">
                  ReStockIQ monitors SKU stock levels, reconciles incoming supplier orders, enforces packaging constraints, and drafts verified purchase proposals before stockouts impact revenue.
                </p>
              </div>

              {/* Two Prominent CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/agent')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#46362F] hover:bg-[#342721] text-white text-xs font-semibold shadow-xs hover:shadow transition-all"
                >
                  <Cpu className="w-4 h-4 text-[#D9C6A5]" />
                  <span>Explore ReStockIQ Copilot</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>

                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] text-xs font-semibold transition-all"
                >
                  <span>How It Works</span>
                </button>
              </div>
            </div>

            {/* Trust Proof Strip */}
            <div className="pt-6 border-t border-[#E7E0D8]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8A9A83] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#46362F]">100% Deterministic Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#8A9A83] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#46362F]">Case-Pack Math Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#8A9A83] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#46362F]">Inbound Offset Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#8A9A83] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#46362F]">Immutable Audit Trail</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Featured SKU Signal Card */}
          <div className="lg:col-span-5 relative min-h-[320px] lg:min-h-full overflow-hidden bg-gradient-to-br from-[#46362F] via-[#3A2C26] to-[#2B201C] flex items-center justify-center p-6 border-t lg:border-t-0 lg:border-l border-[#E7E0D8]">
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(217, 198, 165, 0.6) 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            
            {featuredPlan && (
              <Interactive3DContainer className="relative z-10 w-full max-w-sm space-y-3">
                <PredictiveReplenishmentVisual className="w-full h-24" />
                <div className="bg-white/95 backdrop-blur-md border border-white/60 p-4 rounded-xl shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E7E0D8]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#46362F]" />
                      <span className="text-xs font-bold text-[#46362F] font-mono">{featuredPlan.item.sku}</span>
                    </div>
                    <StatusBadge status={featuredPlan.plan.stockStatus} size="sm" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#46362F]">{featuredPlan.item.name}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] tabular-nums">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#6B625B]">On-Hand</span>
                        <p className="font-bold text-[#46362F]">{featuredPlan.plan.effectiveStock} units</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#6B625B]">Lead Demand</span>
                        <p className="font-bold text-[#46362F]">{featuredPlan.plan.forecastDemand} units</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-[#6B625B]">Recommended</span>
                        <p className="font-bold text-[#327456]">+{featuredPlan.plan.finalOrderUnits} units</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#E7E0D8] text-[11px] tabular-nums">
                    <span className="text-[#6B625B]">Pack Size: {featuredPlan.plan.packSize}u ({featuredPlan.plan.recommendedCases} cases)</span>
                    <span className="font-bold text-[#46362F]">Est. {formatCurrencyINR(featuredPlan.plan.totalCost)}</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSku(featuredPlan.item.sku);
                      navigate('/agent');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#342721] rounded-lg transition-colors"
                  >
                    <span>Examine Decision Room Logic</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Interactive3DContainer>
            )}
          </div>
        </div>
      </div>

      {/* 6-Step Visual Workflow Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A9A83]">
              DETERMINISTIC VERIFICATION LIFECYCLE
            </span>
            <h2 className="font-serif text-2xl text-[#46362F] font-normal">
              How ReStockIQ Prevents Stockouts
            </h2>
          </div>
          <Link to="/" className="text-xs font-semibold text-[#46362F] hover:underline flex items-center gap-1">
            <span>Read full methodology</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div 
                key={step.num}
                className="card-3d-subtle p-4 bg-white border border-[#E7E0D8] rounded-xl shadow-2xs space-y-2.5 flex flex-col justify-between hover:border-[#8A9A83]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#8A9A83]">{step.num}</span>
                  <div className="w-7 h-7 rounded-lg bg-[#E8E2F0] flex items-center justify-center text-[#46362F]">
                    <Icon className="w-4 h-4 text-[#46362F]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#46362F]">{step.title}</h3>
                  <p className="text-[11px] text-[#6B625B] leading-relaxed mt-1">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6 Executive Metric Cards (Computed Strictly from Real Data) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          label="Tracked SKUs"
          value={totalSkus}
          icon={Package}
          description="Catalog lines monitored"
          trend={`${totalSkus} Lines`}
          trendType="neutral"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Low Stock Warning"
          value={lowStockCount}
          icon={AlertTriangle}
          description="Approaching safety point"
          trend={`${lowStockCount} Items`}
          trendType={lowStockCount > 0 ? 'warning' : 'positive'}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Stockout Exposure"
          value={criticalCount}
          icon={TrendingDown}
          description="Depleted within lead time"
          trend={`${criticalCount} Critical`}
          trendType={criticalCount > 0 ? 'danger' : 'positive'}
          onClick={() => navigate('/agent')}
        />
        <StatCard
          label="In-Transit Supply"
          value={activeOrders.length}
          icon={Truck}
          description="Open supplier shipments"
          trend={`${activeOrders.length} Orders`}
          trendType="neutral"
          onClick={() => navigate('/suppliers')}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          icon={CheckSquare}
          description="Human sign-offs needed"
          trend={`${pendingApprovals.length} Requests`}
          trendType="marigold"
          onClick={() => navigate('/approvals')}
        />
        <StatCard
          label="Inventory Value"
          value={formatCurrencyINR(totalInventoryValue)}
          icon={Wallet}
          description={`Committed POs: ${formatCurrencyINR(committedSpend)}`}
          trend="Shelf Capital"
          trendType="positive"
          onClick={() => navigate('/insights')}
        />
      </div>

      {/* Prioritized Inventory Action Queue */}
      <ActionQueue
        inventory={inventory}
        suppliers={suppliers}
        orders={orders}
        requests={requests}
        onSelectSku={setSelectedSku}
      />

      {/* What-If Replenishment Stress Test */}
      <WhatIfSimulator
        inventory={inventory}
        suppliers={suppliers}
        orders={orders}
        onApplyToDecisionRoom={(sku) => {
          setSelectedSku(sku);
          navigate('/agent');
        }}
      />

      {/* Main Operational & Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Data Visualizations & Evidence (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 bg-white border border-[#E7E0D8] rounded-xl shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                  Effective Stock vs Reorder Point (Units)
                </h3>
                <p className="text-[11px] text-[#6B625B]">
                  Comparison of available on-hand units against supplier lead-time demand threshold
                </p>
              </div>
              <Link to="/inventory" className="text-xs font-semibold text-[#46362F] hover:underline flex items-center gap-1">
                <span>All SKUs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B625B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B625B' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E7E0D8', borderRadius: '8px', fontSize: '11px' }} 
                    formatter={(val: any) => [`${val} units`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Stock" fill="#46362F" name="Current On-Hand" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Threshold" fill="#8A9A83" name="Reorder Point" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Inbound" fill="#D9C6A5" name="In-Transit Orders" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Operational Alerts, Supplier Price Jumps & Approvals (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Supplier Price Increase Warning Banner */}
          {priceAlerts.length > 0 && (
            <div className="p-4 bg-[#FFF8E6] border border-[#EAAA00]/40 rounded-xl shadow-2xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EAAA00] animate-pulse" />
                  <h4 className="text-xs font-bold text-[#8A5F00] uppercase tracking-wider">
                    Supplier Price Surge
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-[#8A5F00] bg-white px-2 py-0.5 rounded border border-[#EAAA00]/30 font-mono">
                  {priceAlerts[0].id}
                </span>
              </div>

              <p className="text-xs text-[#46362F] leading-relaxed">
                <strong>{priceAlerts[0].name}</strong> increased unit prices from <strong>₹{priceAlerts[0].previousUnitPrice.toFixed(2)}</strong> to <strong>₹{priceAlerts[0].currentUnitPrice.toFixed(2)}</strong>.
              </p>

              <div className="pt-2 flex items-center justify-end border-t border-[#EAAA00]/25">
                <button
                  onClick={() => navigate('/approvals')}
                  className="px-3 py-1 text-xs font-semibold text-white bg-[#B7791F] hover:bg-[#996519] rounded shadow-2xs transition-colors"
                >
                  Review Proposals
                </button>
              </div>
            </div>
          )}

          {/* Critical Replenishment Signals */}
          <div className="p-5 bg-white border border-[#E7E0D8] rounded-xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                Critical Replenishment Signals
              </h3>
              <Link to="/inventory" className="text-xs font-semibold text-[#46362F] hover:underline">
                View All ({inventoryPlans.length})
              </Link>
            </div>

            <div className="divide-y divide-[#E7E0D8]">
              {inventoryPlans
                .filter(p => p.plan.stockStatus === 'Stockout Risk' || p.plan.stockStatus === 'Critical' || p.plan.stockStatus === 'Low Stock')
                .slice(0, 3)
                .map(({ item, plan, supplier }) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setSelectedSku(item.sku);
                      navigate('/agent');
                    }}
                    className="py-3 flex items-center justify-between hover:bg-[#F8F6F2] px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#46362F]">{item.sku}</span>
                        <StatusBadge status={plan.stockStatus} size="sm" />
                      </div>
                      <p className="text-[11px] text-[#6B625B] mt-0.5 line-clamp-1">{item.name}</p>
                      <p className="text-[10px] text-[#6B625B]">
                        Lead: {supplier.leadTimeDays}d · Stock: {plan.effectiveStock}u · Demand: {plan.forecastDemand}u
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-[#46362F]">
                        +{plan.finalOrderUnits} units
                      </span>
                      <p className="text-[10px] text-[#6B625B]">
                        ({plan.recommendedCases} cases)
                      </p>
                    </div>
                  </div>
                ))}

              {inventoryPlans.filter(p => p.plan.stockStatus !== 'Healthy').length === 0 && (
                <p className="py-4 text-center text-xs text-[#6B625B]">
                  No SKUs currently require urgent replenishment.
                </p>
              )}
            </div>
          </div>

          {/* Pending Approvals Queue */}
          <div className="p-5 bg-white border border-[#E7E0D8] rounded-xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                Human Approval Queue
              </h3>
              <Link to="/approvals" className="text-xs font-semibold text-[#46362F] hover:underline">
                Review ({pendingApprovals.length})
              </Link>
            </div>

            <div className="divide-y divide-[#E7E0D8]">
              {pendingApprovals.slice(0, 3).map((req) => (
                <div 
                  key={req.id}
                  onClick={() => navigate('/approvals')}
                  className="py-3 flex items-center justify-between hover:bg-[#F8F6F2] px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-[#46362F]">{req.id}</span>
                      <StatusBadge status={req.status} size="sm" />
                    </div>
                    <p className="text-[11px] text-[#6B625B] mt-0.5">{req.sku}: {req.productName}</p>
                    <p className="text-[10px] text-[#6B625B]">{req.supplierName}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-[#46362F]">{formatCurrencyINR(req.totalCost)}</p>
                    <p className="text-[10px] text-[#6B625B]">{req.proposedQuantity} units</p>
                  </div>
                </div>
              ))}

              {pendingApprovals.length === 0 && (
                <p className="py-4 text-center text-xs text-[#6B625B]">
                  No reorder requests yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add SKU & CSV Import Modals */}
      <AddSkuModal 
        isOpen={isAddSkuOpen} 
        onClose={() => setIsAddSkuOpen(false)} 
        onAddSku={addInventoryItem} 
        suppliers={suppliers} 
      />

      <CsvImportModal 
        isOpen={isCsvImportOpen} 
        onClose={() => setIsCsvImportOpen(false)} 
        onImportItems={importInventoryCsv} 
        suppliers={suppliers} 
      />
    </div>
  );
};
