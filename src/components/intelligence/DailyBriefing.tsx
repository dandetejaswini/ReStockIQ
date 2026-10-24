import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertTriangle, CheckCircle2, TrendingUp, ShieldCheck, Clock, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';
import { InventoryItem, Supplier, IncomingOrder, ReorderRequest } from '../../types';
import { calculateReorderPlan, checkSupplierPriceChange } from '../../utils/reorderCalculations';

interface DailyBriefingProps {
  inventory: InventoryItem[];
  suppliers: Supplier[];
  orders: IncomingOrder[];
  requests: ReorderRequest[];
  onRefresh?: () => void;
  lastRefreshTime?: string;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({
  inventory,
  suppliers,
  orders,
  requests,
  onRefresh,
  lastRefreshTime = 'Just now'
}) => {
  const navigate = useNavigate();

  if (inventory.length === 0) {
    return null;
  }

  // Calculate real metrics from current live state
  const atRiskSkus = inventory.filter(item => {
    const sup = suppliers.find(s => s.id === item.supplierId);
    if (!sup) return false;
    const plan = calculateReorderPlan(item, sup, orders);
    return plan.stockStatus === 'Critical' || plan.stockStatus === 'Stockout Risk';
  });

  const priceJumpSuppliers = suppliers.filter(s => {
    const check = checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice);
    return check.isPriceJumped;
  });

  const pendingApprovals = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review');

  const coveredByInbound = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');

  return (
    <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 shadow-xs space-y-3 font-sans transition-all hover:border-[#D9C6A5]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E7E0D8] pb-3">
        <div 
          onClick={() => navigate('/briefing')}
          className="flex items-center gap-2.5 cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/briefing'); }}
          title="Click to view full detailed Explainable Daily Briefing"
        >
          <div className="w-8 h-8 rounded-lg bg-[#E8E2F0] group-hover:bg-[#D9C6A5]/40 text-[#46362F] flex items-center justify-center transition-colors">
            <Sparkles className="w-4 h-4 text-[#8A9A83]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-medium text-[#46362F] group-hover:text-[#324536] flex items-center gap-1.5 transition-colors">
                <span>Explainable Daily Briefing</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-[#8A9A83]" />
              </h2>
              <span className="text-[10px] font-bold text-[#324536] bg-[#8A9A83]/15 px-2 py-0.5 rounded-full border border-[#8A9A83]/30">
                Live State
              </span>
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Synthesized from {inventory.length} SKUs, {orders.length} inbound shipments, and {suppliers.length} vendor price records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] text-[#6B625B]">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#8A9A83]" />
            <span>Refreshed: <strong className="text-[#46362F]">{lastRefreshTime}</strong></span>
          </div>

          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1 hover:text-[#46362F] hover:bg-[#F8F6F2] rounded transition-colors"
              title="Refresh ledger state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Explicit View Full Briefing button as required by Phase 8 */}
          <button
            onClick={() => navigate('/briefing')}
            className="flex items-center gap-1 ml-1 px-2.5 py-1 text-xs font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/50 border border-[#E7E0D8] rounded-lg transition-colors shadow-2xs"
          >
            <span>View Full Briefing</span>
            <ArrowRight className="w-3 h-3 text-[#6B625B]" />
          </button>
        </div>
      </div>

      {/* Structured Briefing Bullet Points - Each card deep links to the dedicated full briefing */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* 1. Stockout Risks */}
        <div 
          onClick={() => navigate('/briefing')}
          className="p-3 bg-[#F8F6F2] hover:bg-[#F8F6F2]/80 rounded-xl border border-[#E7E0D8] hover:border-[#8A9A83] space-y-1 cursor-pointer transition-all shadow-2xs"
          title="Click to view Lead-Time Exposure analysis"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Lead-Time Exposure</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              atRiskSkus.length > 0 ? 'bg-[#46362F] text-white' : 'bg-[#8A9A83]/15 text-[#324536]'
            }`}>
              {atRiskSkus.length} SKUs
            </span>
          </div>
          <p className="text-[11px] text-[#46362F] font-medium leading-relaxed">
            {atRiskSkus.length > 0 
              ? `${atRiskSkus.map(i => i.sku).join(', ')} require replenishment within the next delivery cycle.`
              : 'Zero active SKUs are currently at risk of stockout during supplier lead time.'}
          </p>
        </div>

        {/* 2. Reorders Needing Review */}
        <div 
          onClick={() => navigate('/briefing')}
          className="p-3 bg-[#F8F6F2] hover:bg-[#F8F6F2]/80 rounded-xl border border-[#E7E0D8] hover:border-[#8A9A83] space-y-1 cursor-pointer transition-all shadow-2xs"
          title="Click to view Pending Authorizations"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Pending Authorizations</span>
            <span className="text-[10px] font-bold bg-[#D9C6A5] text-[#46362F] px-1.5 py-0.5 rounded">
              {pendingApprovals.length} Proposals
            </span>
          </div>
          <p className="text-[11px] text-[#46362F] font-medium leading-relaxed">
            {pendingApprovals.length > 0
              ? `${pendingApprovals.length} replenishment requests await human manager authorization.`
              : 'All pending purchase proposals have been resolved and issued.'}
          </p>
        </div>

        {/* 3. Orders Covering Demand */}
        <div 
          onClick={() => navigate('/briefing')}
          className="p-3 bg-[#F8F6F2] hover:bg-[#F8F6F2]/80 rounded-xl border border-[#E7E0D8] hover:border-[#8A9A83] space-y-1 cursor-pointer transition-all shadow-2xs"
          title="Click to view Inbound Pipeline"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Inbound Pipeline</span>
            <span className="text-[10px] font-bold bg-[#8A9A83]/15 text-[#324536] px-1.5 py-0.5 rounded">
              {coveredByInbound.length} Active POs
            </span>
          </div>
          <p className="text-[11px] text-[#46362F] font-medium leading-relaxed">
            {coveredByInbound.length > 0
              ? `PO shipments (e.g. ${coveredByInbound[0]?.id}) offset raw demand, preventing duplicate reorders.`
              : 'No active purchase orders are currently in transit from suppliers.'}
          </p>
        </div>

        {/* 4. Budget & Price Exceptions */}
        <div 
          onClick={() => navigate('/briefing')}
          className="p-3 bg-[#F8F6F2] hover:bg-[#F8F6F2]/80 rounded-xl border border-[#E7E0D8] hover:border-[#8A9A83] space-y-1 cursor-pointer transition-all shadow-2xs"
          title="Click to view Pricing Guardrails"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#6B625B]">Pricing Guardrails</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              priceJumpSuppliers.length > 0 ? 'bg-[#B42335] text-white' : 'bg-[#8A9A83]/15 text-[#324536]'
            }`}>
              {priceJumpSuppliers.length > 0 ? 'Review Required' : 'Guarded'}
            </span>
          </div>
          <p className="text-[11px] text-[#46362F] font-medium leading-relaxed">
            {priceJumpSuppliers.length > 0
              ? `${priceJumpSuppliers[0]?.name} unit cost jumped ≥ 20.0%; auto-approval safely blocked.`
              : 'All supplier price variance levels remain within standard operating tolerance (< 20%).'}
          </p>
        </div>
      </div>
    </div>
  );
};
