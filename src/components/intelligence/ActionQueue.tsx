import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Boxes, 
  Truck, 
  Clock, 
  Package,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InventoryItem, Supplier, IncomingOrder, ReorderRequest } from '../../types';
import { calculateReorderPlan, checkSupplierPriceChange } from '../../utils/reorderCalculations';
import { formatCurrencyINR } from '../../utils/formatters';

interface ActionItem {
  id: string;
  sku?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: 'Stockout Risk' | 'Price Variance' | 'Pack Rounding' | 'Inbound Coverage' | 'Missing Evidence';
  title: string;
  reason: string;
  evidence: string;
  calculationTrace: string;
  actionLabel: string;
  actionRoute: string;
  targetSku?: string;
}

interface ActionQueueProps {
  inventory: InventoryItem[];
  suppliers: Supplier[];
  orders: IncomingOrder[];
  requests: ReorderRequest[];
  onSelectSku: (sku: string) => void;
}

export const ActionQueue: React.FC<ActionQueueProps> = ({
  inventory,
  suppliers,
  orders,
  requests,
  onSelectSku
}) => {
  const navigate = useNavigate();

  // Build prioritized queue strictly from live items
  const queueItems: ActionItem[] = [];

  inventory.forEach(item => {
    const sup = suppliers.find(s => s.id === item.supplierId);
    if (!sup) return;

    const plan = calculateReorderPlan(item, sup, orders);

    // 1. Critical Stockout Risk: Only flag when net requirement is genuinely positive
    if ((plan.stockStatus === 'Critical' || plan.stockStatus === 'Stockout Risk') && plan.netRequirement > 0) {
      queueItems.push({
        id: `ACT-STOCKOUT-${item.sku}`,
        sku: item.sku,
        priority: 'Critical',
        category: 'Stockout Risk',
        title: `Reorder Required for ${item.sku} (${item.name})`,
        reason: `Effective stock of ${item.currentStock - item.reservedStock} units falls below ${item.averageDailySales * item.leadTimeDays}-unit demand during ${item.leadTimeDays}-day lead window.`,
        evidence: `Ledger Stock: ${item.currentStock}u · Lead: ${item.leadTimeDays}d · Velocity: ${item.averageDailySales}u/day`,
        calculationTrace: `Net Requirement: ${plan.netRequirement} units → Sized to ${plan.finalOrderUnits} units (${plan.recommendedCases} cases)`,
        actionLabel: 'Open Decision Room',
        actionRoute: `/agent?sku=${item.sku}&autoAnalyze=true`,
        targetSku: item.sku,
      });
    }

    // 2. Pack Size Rounding Impact
    if (plan.packSize > 1 && plan.finalOrderUnits > plan.netRequirement && plan.netRequirement > 0) {
      const surplus = plan.finalOrderUnits - plan.netRequirement;
      queueItems.push({
        id: `ACT-PACK-${item.sku}`,
        sku: item.sku,
        priority: 'Medium',
        category: 'Pack Rounding',
        title: `Vendor Pack Conversion for ${item.sku}`,
        reason: `Raw need of ${plan.netRequirement} units rounded up to ${plan.finalOrderUnits} units (cases of ${plan.packSize}), generating a ${surplus}-unit safety buffer.`,
        evidence: `Supplier: ${sup.name} · Packaging Invariant: ${plan.packSize} units/case`,
        calculationTrace: `Math.ceil(${plan.netRequirement} / ${plan.packSize}) = ${plan.recommendedCases} cases (${plan.finalOrderUnits} units)`,
        actionLabel: 'Inspect Pack Math',
        actionRoute: `/agent?sku=${item.sku}&autoAnalyze=true`,
        targetSku: item.sku,
      });
    }
  });

  // 3. Supplier Price Surge (>= 20%)
  suppliers.forEach(sup => {
    const check = checkSupplierPriceChange(sup.currentUnitPrice, sup.previousUnitPrice);
    if (check.isPriceJumped) {
      queueItems.push({
        id: `ACT-PRICE-${sup.id}`,
        priority: 'High',
        category: 'Price Variance',
        title: `Price Jump Escalation: ${sup.name}`,
        reason: `Unit price increased from ₹${sup.previousUnitPrice.toFixed(2)} to ₹${sup.currentUnitPrice.toFixed(2)} (+${check.percentageChange}%). Exceeds 20.0% policy guardrail.`,
        evidence: `Vendor ID: ${sup.id} · Price Variance: +${check.percentageChange}%`,
        calculationTrace: `((₹${sup.currentUnitPrice} - ₹${sup.previousUnitPrice}) / ₹${sup.previousUnitPrice}) × 100 = +${check.percentageChange}%`,
        actionLabel: 'Review Budget Impact',
        actionRoute: '/approvals',
      });
    }
  });

  // 4. Duplicate Inbound Order Prevention Check
  const openOrders = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');
  openOrders.forEach(o => {
    const item = inventory.find(i => i.sku === o.sku);
    if (item && o.remainingOpenQuantity >= (item.averageDailySales * item.leadTimeDays)) {
      queueItems.push({
        id: `ACT-INBOUND-${o.id}`,
        sku: o.sku,
        priority: 'Low',
        category: 'Inbound Coverage',
        title: `Inbound PO-${o.id} Covers ${o.sku} Demand`,
        reason: `In-transit delivery of ${o.remainingOpenQuantity} units arriving ${o.expectedArrivalDate} fully satisfies lead requirements. Duplicate reorder suppressed.`,
        evidence: `Order: ${o.id} · Expected: ${o.expectedArrivalDate} · Carrier: Apex Logistics`,
        calculationTrace: `Pipeline (${o.remainingOpenQuantity}u) >= Lead Demand (${item.averageDailySales * item.leadTimeDays}u) → Zero duplicate requirement`,
        actionLabel: 'Track Inbound Order',
        actionRoute: '/suppliers',
        targetSku: o.sku,
      });
    }
  });

  // Sort queue by priority
  const priorityOrder: Record<string, number> = {
    'Critical': 1,
    'High': 2,
    'Medium': 3,
    'Low': 4,
  };

  const sortedQueue = queueItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  if (sortedQueue.length === 0) {
    return (
      <div className="bg-white border border-[#E7E0D8] rounded-2xl p-6 shadow-xs text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-[#8A9A83] mx-auto" />
        <h3 className="font-serif text-base font-medium text-[#46362F]">
          Action Queue Clear
        </h3>
        <p className="text-xs text-[#6B625B] max-w-md mx-auto">
          No actionable stockout exposures, supplier price surges, or ordering conflicts were identified across your active catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 shadow-xs space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E7E0D8] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-medium text-[#46362F]">
              Prioritized Inventory Action Queue
            </h3>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded-full">
              {sortedQueue.length} Actionable Items
            </span>
          </div>
          <p className="text-xs text-[#6B625B] mt-0.5">
            Ranked by replenishment urgency, lead-time duration, packaging constraints, and price variance rules.
          </p>
        </div>

        <span className="text-[11px] text-[#6B625B]">
          Transparent decision logic
        </span>
      </div>

      <div className="space-y-3">
        {sortedQueue.slice(0, 5).map((item) => (
          <div 
            key={item.id}
            className={`p-4 rounded-xl border transition-all ${
              item.priority === 'Critical' 
                ? 'bg-[#FDF0F2]/40 border-[#F8C8CE]' 
                : item.priority === 'High'
                ? 'bg-[#FFF8E6]/40 border-[#D9C6A5]'
                : 'bg-[#F8F6F2] border-[#E7E0D8]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    item.priority === 'Critical' ? 'bg-[#B42335] text-white border-[#B42335]' :
                    item.priority === 'High' ? 'bg-[#D9C6A5] text-[#46362F] border-[#D9C6A5]' :
                    item.priority === 'Medium' ? 'bg-[#E8E2F0] text-[#46362F] border-[#E7E0D8]' :
                    'bg-[#8A9A83]/15 text-[#324536] border-[#8A9A83]/30'
                  }`}>
                    {item.priority} Priority
                  </span>
                  <span className="text-[10px] font-semibold text-[#6B625B] uppercase tracking-wider">
                    {item.category}
                  </span>
                  {item.sku && (
                    <span className="font-mono text-[10px] font-bold text-[#46362F] bg-white px-1.5 py-0.2 rounded border border-[#E7E0D8]">
                      {item.sku}
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-xs text-[#46362F]">
                  {item.title}
                </h4>

                <p className="text-[11px] text-[#6B625B] leading-relaxed">
                  {item.reason}
                </p>

                <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#6B625B]">
                  <span><strong>Evidence:</strong> {item.evidence}</span>
                  <span><strong>Trace:</strong> <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8]">{item.calculationTrace}</code></span>
                </div>
              </div>

              {/* One-Click Action Trigger */}
              <button
                onClick={() => {
                  if (item.targetSku) {
                    onSelectSku(item.targetSku);
                  }
                  navigate(item.actionRoute);
                }}
                className="shrink-0 self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-2xs transition-colors"
              >
                <span>{item.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
