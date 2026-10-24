import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowLeft, 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Truck, 
  Package, 
  BadgeAlert, 
  DollarSign, 
  Boxes, 
  ArrowRight, 
  ExternalLink,
  ChevronRight,
  Database,
  FileCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';
import { formatCurrencyINR, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { DailyBriefingSynthesisVisual } from '../components/visuals/SupplyChainVisuals';

export const DailyBriefingPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    inventory, 
    suppliers, 
    orders, 
    requests, 
    setSelectedSku,
    isBackendConfigured 
  } = useApp();

  const [refreshTimestamp, setRefreshTimestamp] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [activeTab, setActiveTab] = useState<'all' | 'exposure' | 'authorizations' | 'pipeline' | 'pricing'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsRefreshing(false);
    }, 350);
  };

  const defaultSupplier = {
    id: 'SUP-DEFAULT',
    name: 'Direct Supplier',
    contactInformation: { email: '', phone: '', address: '', representative: '' },
    leadTimeDays: 4,
    packSize: 1,
    minimumOrderQuantity: 1,
    currentUnitPrice: 100,
    previousUnitPrice: 100,
    reliabilityScore: 95,
    status: 'Active' as const,
  };

  // 1. Lead-Time Exposure Analysis
  const inventoryPlans = inventory.map(item => {
    const sup = suppliers.find(s => s.id === item.supplierId) || suppliers[0] || {
      ...defaultSupplier,
      id: item.supplierId || 'SUP-DEFAULT',
      leadTimeDays: item.leadTimeDays || 4,
      currentUnitPrice: item.unitPrice || 100,
      previousUnitPrice: item.unitPrice || 100,
    };
    return {
      item,
      supplier: sup,
      plan: calculateReorderPlan(item, sup, orders)
    };
  });

  const exposureItems = inventoryPlans.filter(p => 
    p.plan.stockStatus === 'Critical' || 
    p.plan.stockStatus === 'Stockout Risk' || 
    p.plan.stockStatus === 'Low Stock'
  );

  // 2. Pending Authorizations
  const pendingRequests = requests.filter(r => 
    r.status === 'Pending Approval' || 
    r.status === 'Needs Budget Review'
  );

  // 3. Inbound Pipeline (eligible open orders)
  const openOrders = orders.filter(o => 
    o.status !== 'Received' && 
    o.status !== 'Cancelled'
  );

  // 4. Pricing Guardrails
  const priceAlertSuppliers = suppliers.filter(s => {
    const check = checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice);
    return check.isPriceJumped;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E7E0D8]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="p-1.5 rounded-lg border border-[#E7E0D8] bg-white hover:bg-[#F8F6F2] text-[#46362F] transition-colors"
              title="Return to Home Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#46362F] tracking-tight">
                Explainable Daily Briefing
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold text-[#324536] bg-[#8A9A83]/15 rounded-full border border-[#8A9A83]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A9A83] animate-pulse" />
                Live State
              </span>
            </div>
          </div>
          <p className="text-xs text-[#6B625B] pl-9">
            Authoritative daily synthesis derived from {inventory.length} SKUs, {openOrders.length} inbound shipments, and {suppliers.length} supplier catalogs.
          </p>
        </div>

        {/* Provenance & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E7E0D8] bg-white text-xs text-[#6B625B]">
            <Clock className="w-3.5 h-3.5 text-[#8A9A83]" />
            <span>Refreshed: <strong className="text-[#46362F]">{refreshTimestamp}</strong></span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#46362F] hover:bg-[#342721] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Recomputing...' : 'Refresh Briefing'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E7E0D8] pb-3">
        {[
          { id: 'all', label: 'All Sections' },
          { id: 'exposure', label: `Lead-Time Exposure (${exposureItems.length})` },
          { id: 'authorizations', label: `Pending Approvals (${pendingRequests.length})` },
          { id: 'pipeline', label: `Inbound Pipeline (${openOrders.length})` },
          { id: 'pricing', label: `Pricing Guardrails (${priceAlertSuppliers.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[#46362F] text-white shadow-xs'
                : 'bg-white text-[#6B625B] hover:bg-[#F8F6F2] border border-[#E7E0D8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Executive Summary Card */}
      <div className="bg-gradient-to-br from-[#F8F6F2] to-white border border-[#E7E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8A9A83]" />
              <h2 className="font-serif text-lg font-normal text-[#46362F]">Executive Supply-Chain Summary</h2>
            </div>
            <p className="text-xs text-[#6B625B]">
              Four-layer operational synthesis across stockout exposure, pending sign-offs, inbound PO cover, and vendor pricing guardrails.
            </p>
          </div>
          <DailyBriefingSynthesisVisual className="w-24 h-16 shrink-0 hidden sm:block" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div className="card-3d-subtle bg-white p-3.5 rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Stockout Urgency</span>
            <div className="text-xl font-serif text-[#46362F] tabular-nums">
              {exposureItems.filter(p => p.plan.stockStatus === 'Critical' || p.plan.stockStatus === 'Stockout Risk').length} Critical SKUs
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Require immediate reorder proposal before lead-time depletion.
            </p>
          </div>

          <div className="card-3d-subtle bg-white p-3.5 rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Awaiting Sign-off</span>
            <div className="text-xl font-serif text-[#46362F] tabular-nums">
              {pendingRequests.length} Proposals
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Totaling {formatCurrencyINR(pendingRequests.reduce((sum, r) => sum + r.totalCost, 0))} in committed spend.
            </p>
          </div>

          <div className="card-3d-subtle bg-white p-3.5 rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Pipeline Protection</span>
            <div className="text-xl font-serif text-[#46362F] tabular-nums">
              {openOrders.length} Inbound POs
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Actively offset demand to prevent duplicate order generation.
            </p>
          </div>

          <div className="card-3d-subtle bg-white p-3.5 rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Policy Guardrails</span>
            <div className="text-xl font-serif text-[#46362F] tabular-nums">
              {priceAlertSuppliers.length > 0 ? `${priceAlertSuppliers.length} Price Surge` : 'Guarded'}
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Automatic purchase order creation is blocked for items with ≥20% price jumps.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Lead-Time Exposure */}
      {(activeTab === 'all' || activeTab === 'exposure') && (
        <section id="exposure" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B42335]" />
              <h2 className="font-serif text-xl font-normal text-[#46362F]">Lead-Time Exposure & Stockout Risk</h2>
            </div>
            <span className="text-xs text-[#6B625B]">
              Calculated using: Usable Stock + Pipeline Inbound vs. Lead-Time Demand + Safety Buffer
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E7E0D8] bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[11px] uppercase tracking-wider text-[#6B625B] font-bold">
                  <th className="py-3 px-4">SKU & Product</th>
                  <th className="py-3 px-3">Usable Stock</th>
                  <th className="py-3 px-3">Velocity & Lead</th>
                  <th className="py-3 px-3">Eligible Inbound</th>
                  <th className="py-3 px-3">Net Requirement</th>
                  <th className="py-3 px-3">Pack Multiple</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D8]">
                {exposureItems.map(({ item, supplier, plan }) => (
                  <tr key={item.sku} className="hover:bg-[#F8F6F2]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#46362F]">{item.sku}</div>
                      <div className="text-[11px] text-[#6B625B] truncate max-w-xs">{item.name}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#46362F]">
                      {item.currentStock - item.reservedStock} units
                    </td>
                    <td className="py-3 px-3 text-[#6B625B]">
                      {item.averageDailySales}u/day · {item.leadTimeDays}d lead
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#8A9A83]">
                      +{plan.incomingOpenOrders} units
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#46362F]">{plan.netRequirement} units</span>
                    </td>
                    <td className="py-3 px-3 text-[#6B625B]">
                      {plan.finalOrderUnits} units ({plan.recommendedCases} cs × {plan.packSize})
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={plan.stockStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedSku(item.sku);
                          navigate(`/agent?sku=${item.sku}&autoAnalyze=true`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#46362F] hover:bg-[#342721] text-white text-[11px] font-semibold transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-[#D9C6A5]" />
                        <span>Decision Room</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {exposureItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#6B625B] text-xs">
                      No SKUs currently qualify as exposed to lead-time stockout risk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 2: Pending Authorizations */}
      {(activeTab === 'all' || activeTab === 'authorizations') && (
        <section id="authorizations" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#46362F]" />
              <h2 className="font-serif text-xl font-normal text-[#46362F]">Pending Reorder Authorizations</h2>
            </div>
            <span className="text-xs text-[#6B625B]">
              Every purchase proposal requires human verification and governance
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E7E0D8] bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[11px] uppercase tracking-wider text-[#6B625B] font-bold">
                  <th className="py-3 px-4">Proposal ID</th>
                  <th className="py-3 px-3">SKU & Item</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Proposed Units</th>
                  <th className="py-3 px-3">Total Spend</th>
                  <th className="py-3 px-3">Budget Gate</th>
                  <th className="py-3 px-3">Current Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D8]">
                {pendingRequests.map(req => (
                  <tr key={req.id} className="hover:bg-[#F8F6F2]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#46362F]">{req.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#46362F]">{req.sku}</div>
                      <div className="text-[11px] text-[#6B625B] truncate max-w-xs">{req.productName}</div>
                    </td>
                    <td className="py-3 px-3 text-[#6B625B]">{req.supplierName}</td>
                    <td className="py-3 px-3 font-semibold text-[#46362F]">
                      {req.proposedQuantity} units ({req.caseCount} cs)
                    </td>
                    <td className="py-3 px-3 font-bold text-[#46362F]">
                      {formatCurrencyINR(req.totalCost)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        req.budgetStatus === 'Price Increase Review' 
                          ? 'bg-[#B42335]/10 text-[#B42335] border border-[#B42335]/20' 
                          : 'bg-[#8A9A83]/15 text-[#324536]'
                      }`}>
                        {req.budgetStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate('/approvals')}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] text-[11px] font-semibold transition-colors"
                      >
                        <span>Open Approval</span>
                        <ChevronRight className="w-3 h-3 text-[#6B625B]" />
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingRequests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#6B625B] text-xs">
                      All purchase proposals have been reviewed and approved.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 3: Inbound Pipeline */}
      {(activeTab === 'all' || activeTab === 'pipeline') && (
        <section id="pipeline" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#8A9A83]" />
              <h2 className="font-serif text-xl font-normal text-[#46362F]">Inbound Pipeline & Duplicate Protection</h2>
            </div>
            <span className="text-xs text-[#6B625B]">
              Active in-transit supplier deliveries offsetting lead-time demand
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E7E0D8] bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[11px] uppercase tracking-wider text-[#6B625B] font-bold">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-3">Target SKU</th>
                  <th className="py-3 px-3">Inbound Units</th>
                  <th className="py-3 px-3">Expected Arrival</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Replenishment Impact</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D8]">
                {openOrders.map(order => {
                  const item = inventory.find(i => i.sku === order.sku);
                  const isCovering = item && order.remainingOpenQuantity >= (item.averageDailySales * item.leadTimeDays);

                  return (
                    <tr key={order.id} className="hover:bg-[#F8F6F2]/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#46362F]">{order.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#46362F]">{order.sku}</div>
                        <div className="text-[11px] text-[#6B625B] truncate max-w-xs">{item?.name || 'Supply Item'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#8A9A83]">
                        {order.remainingOpenQuantity} units
                      </td>
                      <td className="py-3 px-3 font-medium text-[#46362F]">
                        {formatDate(order.expectedArrivalDate)}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#6B625B]">
                        {isCovering 
                          ? '✅ Offsets full lead-time demand. Duplicate order prevented.' 
                          : '⚡ Partial offset against gross lead-time requirements.'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => navigate('/suppliers')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] text-[#46362F] text-[11px] font-semibold transition-colors"
                        >
                          <span>Track Inbound</span>
                          <ExternalLink className="w-3 h-3 text-[#6B625B]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 4: Pricing Guardrails */}
      {(activeTab === 'all' || activeTab === 'pricing') && (
        <section id="pricing" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgeAlert className="w-4 h-4 text-[#B42335]" />
              <h2 className="font-serif text-xl font-normal text-[#46362F]">Pricing Guardrails & Price Jump Safeguards</h2>
            </div>
            <span className="text-xs text-[#6B625B]">
              Detects supplier unit price variance ≥ 20.0% and halts automatic purchase orders
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E7E0D8] bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[11px] uppercase tracking-wider text-[#6B625B] font-bold">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-3">Previous Price</th>
                  <th className="py-3 px-3">Current Price</th>
                  <th className="py-3 px-3">Price Variance</th>
                  <th className="py-3 px-3">Policy Threshold</th>
                  <th className="py-3 px-3">Safeguard Gate</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0D8]">
                {suppliers.map(sup => {
                  const check = checkSupplierPriceChange(sup.currentUnitPrice, sup.previousUnitPrice);
                  return (
                    <tr key={sup.id} className="hover:bg-[#F8F6F2]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#46362F]">{sup.name}</div>
                        <div className="text-[11px] text-[#6B625B]">ID: {sup.id} · Lead: {sup.leadTimeDays}d</div>
                      </td>
                      <td className="py-3 px-3 text-[#6B625B]">
                        {formatCurrencyINR(sup.previousUnitPrice)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#46362F]">
                        {formatCurrencyINR(sup.currentUnitPrice)}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          check.isPriceJumped 
                            ? 'bg-[#B42335]/10 text-[#B42335] font-bold' 
                            : 'text-[#6B625B]'
                        }`}>
                          {check.percentageChange >= 0 ? `+${check.percentageChange}%` : `${check.percentageChange}%`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#6B625B]">20.0% Max Variance</td>
                      <td className="py-3 px-3">
                        {check.isPriceJumped ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#B42335] bg-[#FDF0F2] px-2 py-0.5 rounded border border-[#B42335]/20">
                            <BadgeAlert className="w-3 h-3" />
                            <span>Needs Budget Review</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#324536] bg-[#8A9A83]/15 px-2 py-0.5 rounded border border-[#8A9A83]/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Within Budget Bounds</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => navigate('/approvals')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] text-[11px] font-semibold transition-colors"
                        >
                          <span>Review Proposals</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 5: Evidence & Cryptographic Verification Invariants */}
      <div className="p-5 bg-white rounded-2xl border border-[#E7E0D8] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#8A9A83]" />
          <h3 className="font-serif text-base font-medium text-[#46362F]">Source Evidence & Cryptographic Invariants</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#6B625B]">
          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-bold text-[#46362F]">Deterministic Math Engine</span>
            <p className="text-[11px]">
              Every net requirement strictly executes Math.max(0, Lead-Demand + Buffer - Available - Inbound). Zero hallucinated metrics.
            </p>
          </div>
          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-bold text-[#46362F]">Idempotency Guardrails</span>
            <p className="text-[11px]">
              Proposals leverage cryptographic composite keys (ORD-SKU-SUP-DATE) preventing duplicate purchase orders across human and AI runs.
            </p>
          </div>
          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-bold text-[#46362F]">Backend Architecture</span>
            <p className="text-[11px]">
              {isBackendConfigured 
                ? 'Supabase live PostgreSQL schema with Row-Level Security active.' 
                : 'Demonstration isolated fixtures running deterministic local calculations; ready for Supabase pairing.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
