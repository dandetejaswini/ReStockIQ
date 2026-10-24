import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Layers, 
  ArrowRight, 
  ShieldCheck, 
  Boxes, 
  Truck, 
  TrendingUp, 
  Package, 
  DollarSign, 
  Lock,
  FileCheck,
  Check,
  Ban
} from 'lucide-react';
import { TestResult, TestScenarioId } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { formatCurrencyINR, formatDateTime } from '../../utils/formatters';

interface ScenarioResultModalProps {
  result: TestResult;
  onClose: () => void;
  onAction?: (scenarioId: TestScenarioId) => void;
}

export const ScenarioResultModal: React.FC<ScenarioResultModalProps> = ({ 
  result, 
  onClose,
  onAction
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const isTC1 = result.scenarioId === 'TC1';
  const isTC2 = result.scenarioId === 'TC2';
  const isTC3 = result.scenarioId === 'TC3';
  const isTC4 = result.scenarioId === 'TC4';

  const isPassed = result.status === 'Passed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#E7E0D8] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Scenario-Specific Identity */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E0D8] bg-[#F8F6F2]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
              isTC1 ? 'bg-[#46362F] text-[#D9C6A5]' :
              isTC2 ? 'bg-[#D9C6A5] text-[#46362F]' :
              isTC3 ? 'bg-[#8A9A83] text-white' :
              'bg-[#B42335] text-white'
            }`}>
              {isTC1 && <Package className="w-5 h-5" />}
              {isTC2 && <Boxes className="w-5 h-5" />}
              {isTC3 && <Truck className="w-5 h-5" />}
              {isTC4 && <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-white border border-[#E7E0D8] rounded text-[#46362F]">
                  {result.scenarioId}
                </span>
                <h3 className="font-serif text-base font-medium text-[#46362F]">
                  {result.scenarioTitle}
                </h3>
              </div>
              <p className="text-[11px] text-[#6B625B] mt-0.5">
                Deterministic Rule Engine Assertion · Run ID: <span className="font-mono">{result.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isPassed 
                ? 'bg-[#8A9A83]/15 text-[#324536] border-[#8A9A83]/40' 
                : 'bg-[#B42335]/15 text-[#B42335] border-[#B42335]/40'
            }`}>
              {isPassed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#324536]" /> : <XCircle className="w-3.5 h-3.5 text-[#B42335]" />}
              <span>{isPassed ? 'Assertion Passed' : 'Assertion Failed'}</span>
            </span>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B625B] hover:text-[#46362F] hover:bg-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          
          {/* ======================================================== */}
          {/* SCENARIO-SPECIFIC PRIMARY VISUAL SUMMARY                 */}
          {/* ======================================================== */}
          
          {/* TC1: Visual Waterfall & Stockout Coverage */}
          {isTC1 && (
            <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-[#46362F]">
                    Lead-Time Stockout Coverage Waterfall
                  </h4>
                  <p className="text-[11px] text-[#6B625B]">
                    SKU-101 (Organic Arabica Beans) · 5-Day Lead Window
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#46362F] px-2 py-1 bg-white border border-[#E7E0D8] rounded-lg">
                  Target: 30 units
                </span>
              </div>

              {/* Visual Breakdown Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-[#6B625B]">
                  <span>Usable Stock: 12u</span>
                  <span>Pipeline Supply: 0u</span>
                  <span className="font-bold text-[#46362F]">Proposed Order: +18u</span>
                </div>
                <div className="h-4 w-full bg-white rounded-md overflow-hidden flex border border-[#E7E0D8]">
                  <div style={{ width: '40%' }} className="bg-[#D9C6A5] flex items-center justify-center text-[10px] text-[#46362F] font-bold" title="Current Stock (12)">
                    12u Stock
                  </div>
                  <div style={{ width: '60%' }} className="bg-[#46362F] text-white flex items-center justify-center text-[10px] font-bold" title="Proposed Reorder (18)">
                    +18u Reorder
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#6B625B]">
                  <span>Demand: 4u/day × 5d = 20u</span>
                  <span>Safety Buffer: 10u</span>
                  <span className="text-[#324536] font-semibold">100% Demand & Buffer Covered</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E7E0D8] grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B625B]">Gross Need</p>
                  <p className="font-mono text-sm font-bold text-[#46362F]">30 units</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B625B]">Inbound Open</p>
                  <p className="font-mono text-sm font-bold text-[#6B625B]">0 units</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B625B]">Net Reorder</p>
                  <p className="font-mono text-sm font-bold text-[#46362F]">18 units</p>
                </div>
              </div>
            </div>
          )}

          {/* TC2: Pack-Size Conversion & Surplus Diagram */}
          {isTC2 && (
            <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-[#46362F]">
                    Supplier Packaging Constraint Conversion
                  </h4>
                  <p className="text-[11px] text-[#6B625B]">
                    SKU-102 (Glass Beverage Bottles) · Vendor Pack Size: 12 units/case
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#46362F] px-2 py-1 bg-white border border-[#E7E0D8] rounded-lg">
                  Pack Size: 12
                </span>
              </div>

              {/* Case Rounding Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-[#E7E0D8] rounded-lg space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-[#6B625B]">Case #1 (Units 1 - 12)</span>
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-6 bg-[#46362F] text-white rounded text-[10px] font-mono flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#324536] font-semibold">12 units applied to raw requirement</p>
                </div>

                <div className="p-3 bg-white border border-[#E7E0D8] rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#6B625B]">Case #2 (Units 13 - 24)</span>
                    <span className="text-[10px] font-bold text-[#D9C6A5] bg-[#46362F] px-1.5 py-0.5 rounded">
                      +7 Rounding Surplus
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-6 rounded text-[10px] font-mono flex items-center justify-center font-bold ${
                          i < 5 
                            ? 'bg-[#46362F] text-white' 
                            : 'bg-[#D9C6A5] text-[#46362F] border border-[#D9C6A5]'
                        }`}
                        title={i < 5 ? 'Applied to raw need' : 'Rounding surplus buffer'}
                      >
                        {i + 13}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#6B625B]">
                    5 units cover raw need · <strong className="text-[#46362F]">7 units carryover safety buffer</strong>
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#E8E2F0]/40 rounded-lg border border-[#E7E0D8] flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[#46362F]">Conversion Formula:</span>
                  <code className="ml-2 font-mono text-[#46362F]">Math.ceil(17 / 12) = 2 cases → 24 units</code>
                </div>
                <span className="font-bold text-[#46362F]">Surplus: 7 units (+41.2%)</span>
              </div>
            </div>
          )}

          {/* TC3: Inbound Pipeline & Duplicate Prevention */}
          {isTC3 && (
            <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-[#46362F]">
                    Inbound Pipeline Reconciliation & Duplicate Shield
                  </h4>
                  <p className="text-[11px] text-[#6B625B]">
                    SKU-103 (Shipping Cartons Large) · Active PO-2026-089
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#324536] px-2 py-1 bg-[#8A9A83]/15 border border-[#8A9A83]/40 rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Duplicate Prevented</span>
                </span>
              </div>

              {/* Inbound Supply Details */}
              <div className="p-3.5 bg-white border border-[#E7E0D8] rounded-lg space-y-2">
                <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#46362F]" />
                    <span className="font-mono font-bold text-[#46362F]">PO-2026-089</span>
                    <span className="text-[10px] text-[#6B625B]">Supplier: Apex Logistics</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#324536] bg-[#8A9A83]/15 px-2 py-0.5 rounded">
                    Status: Shipped
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B625B]">Inbound Supply</p>
                    <p className="font-mono text-sm font-bold text-[#46362F]">30 units</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B625B]">Lead Demand</p>
                    <p className="font-mono text-sm font-bold text-[#46362F]">20 units</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B625B]">Additional Need</p>
                    <p className="font-mono text-sm font-bold text-[#324536]">0 units</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#EBF7F0] border border-[#BCE8D3] rounded-lg text-[11px] text-[#324536] flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#324536]" />
                <p>
                  <strong>Duplicate Request Suppressed:</strong> The existing shipment of 30 units arriving on 2026-10-28 fully bridges lead-time consumption and safety buffer. ReStockIQ suppressed redundant purchase creation, saving ₹1,800 in unneeded inventory holding.
                </p>
              </div>
            </div>
          )}

          {/* TC4: Supplier Price Spike & Budget Gate */}
          {isTC4 && (
            <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-[#46362F]">
                    Supplier Price Spike & Governance Gate
                  </h4>
                  <p className="text-[11px] text-[#6B625B]">
                    SKU-104 (Eco Kraft Stand-Up Pouches) · Vendor: Sunfield Agri
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#B42335] px-2 py-1 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Auto-Approval Blocked</span>
                </span>
              </div>

              {/* Price Jump Comparison */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-[#E7E0D8] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B625B]">Previous Price</span>
                  <p className="font-mono text-base font-bold text-[#6B625B] line-through mt-0.5">
                    ₹50.00
                  </p>
                  <span className="text-[10px] text-[#6B625B]">Verified Ledger</span>
                </div>

                <div className="p-3 bg-white border border-[#F8C8CE] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[#B42335]">New Billed Price</span>
                  <p className="font-mono text-base font-bold text-[#B42335] mt-0.5">
                    ₹62.50
                  </p>
                  <span className="text-[10px] font-bold text-[#B42335]">+25.0% Variance</span>
                </div>

                <div className="p-3 bg-white border border-[#E7E0D8] rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B625B]">Order Impact</span>
                  <p className="font-mono text-base font-bold text-[#46362F] mt-0.5">
                    ₹2,500.00
                  </p>
                  <span className="text-[10px] text-[#B42335] font-semibold">+₹500.00 Inflation</span>
                </div>
              </div>

              <div className="p-3 bg-[#FFF8E6] border border-[#D9C6A5] rounded-lg text-[11px] text-[#46362F] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#46362F]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
                  <span>Mandatory Policy Escalation Triggered</span>
                </div>
                <p className="text-[#6B625B]">
                  Price increase of <strong>+25.0%</strong> exceeds the store's strict 20.0% safety invariant. Automatic purchase issuance is blocked. The proposal has been redirected to the <strong>Needs Budget Review</strong> authorization queue.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMMON STRUCTURED DETAILS: INPUTS, INVARIANTS & TRACE   */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Input Snapshot & Invariant */}
            <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-3">
              <h5 className="font-bold text-xs text-[#46362F] uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-[#8A9A83]" />
                <span>Actual Input Snapshot & Invariant</span>
              </h5>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1 border-b border-[#E7E0D8]">
                  <span className="text-[#6B625B]">Target Entity:</span>
                  <span className="font-mono font-semibold text-[#46362F]">{result.inputSnapshot.sku || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E7E0D8]">
                  <span className="text-[#6B625B]">Current Effective Stock:</span>
                  <span className="font-mono text-[#46362F]">
                    {result.inputSnapshot.effectiveStock !== undefined ? `${result.inputSnapshot.effectiveStock} units` : 
                     result.inputSnapshot.currentStock !== undefined ? `${result.inputSnapshot.currentStock} units` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E7E0D8]">
                  <span className="text-[#6B625B]">Expected Invariant:</span>
                  <span className="font-semibold text-[#324536]">
                    {isTC1 && 'Net Requirement === 18 units'}
                    {isTC2 && 'Case Pack === 12 → 2 cases (24 units)'}
                    {isTC3 && 'Inbound covers demand → 0 net order'}
                    {isTC4 && 'Price variance ≥ 20% → Budget Review'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6B625B]">Source Evidence IDs:</span>
                  <span className="font-mono text-[10px] text-[#6B625B]">
                    {result.evidence.join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Business Impact & Next Action */}
            <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-3">
              <h5 className="font-bold text-xs text-[#46362F] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8A9A83]" />
                <span>Business Impact & Recommended Action</span>
              </h5>

              <div className="space-y-2 text-[11px]">
                <div>
                  <span className="font-semibold text-[#46362F]">Business Consequence:</span>
                  <p className="text-[#6B625B] mt-0.5 leading-relaxed">
                    {isTC1 && 'Bridges lead-time vulnerability without over-ordering. Protects core revenue stream with zero idle capital.'}
                    {isTC2 && 'Eliminates supplier rejection penalties for broken case quantities while accumulating a predictable 7-unit safety buffer.'}
                    {isTC3 && 'Prevents double-ordering and unnecessary cash lockup when an inbound shipment is already committed.'}
                    {isTC4 && 'Protects retail store gross margins from unexpected supplier wholesale inflation through human gatekeeper control.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E7E0D8]">
                  <span className="font-semibold text-[#46362F]">Recommended Next Action:</span>
                  <p className="text-[#324536] font-medium mt-0.5">
                    {isTC1 && 'Review and authorize generated replenishment proposal REQ-TC1.'}
                    {isTC2 && 'Issue purchase order for 2 full cases (24 units) to Precision Glassware.'}
                    {isTC3 && 'Maintain order suppression. Monitor tracking updates on PO-2026-089.'}
                    {isTC4 && 'Open Approval Center to negotiate vendor terms or approve price change.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Execution Trace Log */}
          <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-2">
            <h5 className="font-bold text-xs text-[#46362F] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#8A9A83]" />
              <span>Deterministic Rule Execution Trace</span>
            </h5>
            <div className="bg-[#F8F6F2] p-3 rounded-lg border border-[#E7E0D8] font-mono text-[10.5px] space-y-1 text-[#46362F] overflow-x-auto">
              {(result.executionLog || []).map((log, idx) => (
                <div key={idx} className="flex gap-2 leading-relaxed">
                  <span className="text-[#6B625B] select-none">{String(idx + 1).padStart(2, '0')}</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#E7E0D8] bg-[#F8F6F2] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-[#6B625B]">
            Executed at {formatDateTime(result.timestamp || new Date().toISOString())} · Client-side rule verification
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-[#46362F] bg-white border border-[#E7E0D8] hover:bg-slate-50 rounded-lg transition-colors"
            >
              Close Trace
            </button>
            <button
              type="button"
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                setIsApplying(true);
                if (onAction) {
                  onAction(result.scenarioId);
                }
                onClose();
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#382b25] disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isApplying ? 'Applying Scenario…' : 'Apply Scenario in Decision Room'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
