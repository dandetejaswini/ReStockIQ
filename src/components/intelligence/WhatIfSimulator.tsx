import React, { useState } from 'react';
import { 
  Sliders, 
  RotateCcw, 
  Sparkles, 
  Boxes, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  HelpCircle,
  ArrowRight,
  Info
} from 'lucide-react';
import { InventoryItem, Supplier, IncomingOrder } from '../../types';
import { roundToSupplierPackSize, checkSupplierPriceChange } from '../../utils/reorderCalculations';
import { formatCurrencyINR } from '../../utils/formatters';

interface WhatIfSimulatorProps {
  inventory: InventoryItem[];
  suppliers: Supplier[];
  orders: IncomingOrder[];
  onApplyToDecisionRoom?: (sku: string) => void;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  inventory,
  suppliers,
  orders,
  onApplyToDecisionRoom
}) => {
  const [selectedSku, setSelectedSku] = useState<string>(inventory[0]?.sku || 'SKU-101');
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.0); // 0.5x to 2.0x
  const [leadTimeAdjustment, setLeadTimeAdjustment] = useState<number>(0); // -3 to +7 days
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0); // 0% to 50%
  const [includeInbound, setIncludeInbound] = useState<boolean>(true);

  const currentItem = inventory.find(i => i.sku === selectedSku) || inventory[0];
  const currentSupplier = suppliers.find(s => s.id === currentItem?.supplierId) || suppliers[0];

  if (!currentItem || !currentSupplier) {
    return null;
  }

  // Base values
  const baseEffectiveStock = currentItem.currentStock - currentItem.reservedStock;
  const baseDailySales = currentItem.averageDailySales;
  const baseLeadTime = currentItem.leadTimeDays;
  const basePrice = currentSupplier.currentUnitPrice;

  // Inbound supply calculation
  const inboundQty = orders
    .filter(o => o.sku === currentItem.sku && o.status !== 'Received' && o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.remainingOpenQuantity, 0);

  // Simulated values
  const simulatedDailySales = Math.max(1, Math.round(baseDailySales * demandMultiplier));
  const simulatedLeadTime = Math.max(1, baseLeadTime + leadTimeAdjustment);
  const simulatedUnitPrice = Number((basePrice * (1 + priceChangePercent / 100)).toFixed(2));
  const simulatedInbound = includeInbound ? inboundQty : 0;

  // Simulated calculations
  const simulatedDemand = simulatedDailySales * simulatedLeadTime;
  const simulatedTarget = simulatedDemand + currentItem.safetyStock;
  const simulatedAvailable = baseEffectiveStock + simulatedInbound;
  const rawRequirement = Math.max(0, simulatedTarget - simulatedAvailable);

  const packResult = roundToSupplierPackSize(rawRequirement, currentSupplier.packSize);
  const totalCost = packResult.finalUnits * simulatedUnitPrice;

  const priceAnalysis = checkSupplierPriceChange(simulatedUnitPrice, basePrice);
  const isBudgetReviewTriggered = priceAnalysis.percentageChange >= 20.0;

  const resetSimulation = () => {
    setDemandMultiplier(1.0);
    setLeadTimeAdjustment(0);
    setPriceChangePercent(0);
    setIncludeInbound(true);
  };

  return (
    <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 shadow-xs space-y-4 font-sans">
      
      {/* Header with Mandatory "Hypothetical Scenario" Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E7E0D8] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#D9C6A5]/30 text-[#46362F] flex items-center justify-center">
            <Sliders className="w-4 h-4 text-[#46362F]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-medium text-[#46362F]">
                What-If Replenishment Stress Test
              </h3>
              <span className="text-[10px] font-bold text-[#46362F] bg-[#D9C6A5] px-2 py-0.5 rounded-full">
                Interactive Simulation
              </span>
            </div>
            <p className="text-[11px] text-[#6B625B]">
              Simulate volatile demand spikes, supplier delivery delays, and wholesale price increases before saving.
            </p>
          </div>
        </div>

        <button
          onClick={resetSimulation}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#6B625B] hover:text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-lg transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Parameters</span>
        </button>
      </div>

      {/* Hypothetical Guardrail Notice */}
      <div className="p-2.5 bg-[#FFF8E6] border border-[#D9C6A5] rounded-xl text-[11px] text-[#46362F] flex items-center gap-2">
        <Info className="w-4 h-4 text-[#B7791F] shrink-0" />
        <span>
          <strong>Hypothetical Simulation Mode:</strong> Calculations in this panel are temporary projections and are <em>not</em> persisted to your operational purchasing ledger until explicitly saved as a proposal.
        </span>
      </div>

      {/* Simulator Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl text-xs">
        
        {/* SKU Selection */}
        <div>
          <label className="block font-medium text-[#46362F] mb-1">Target SKU</label>
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="w-full p-2 bg-white border border-[#E7E0D8] rounded-lg text-[#46362F] text-xs font-medium"
          >
            {inventory.map(item => (
              <option key={item.sku} value={item.sku}>
                {item.sku} — {item.name}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[#6B625B] mt-1 block">
            Vendor: {currentSupplier.name} (Pack of {currentSupplier.packSize})
          </span>
        </div>

        {/* Demand Multiplier Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-medium text-[#46362F]">Demand Velocity</label>
            <span className="font-mono font-bold text-[#46362F]">{demandMultiplier.toFixed(1)}x ({simulatedDailySales}u/day)</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={demandMultiplier}
            onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
            className="w-full accent-[#46362F]"
          />
          <div className="flex justify-between text-[10px] text-[#6B625B] mt-0.5">
            <span>0.5x (-50%)</span>
            <span>1.0x Normal</span>
            <span>2.5x Surge</span>
          </div>
        </div>

        {/* Lead Time Adjustment Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-medium text-[#46362F]">Supplier Lead Time</label>
            <span className="font-mono font-bold text-[#46362F]">{simulatedLeadTime} days ({leadTimeAdjustment >= 0 ? `+${leadTimeAdjustment}` : leadTimeAdjustment}d)</span>
          </div>
          <input
            type="range"
            min="-2"
            max="10"
            step="1"
            value={leadTimeAdjustment}
            onChange={(e) => setLeadTimeAdjustment(parseInt(e.target.value, 10))}
            className="w-full accent-[#46362F]"
          />
          <div className="flex justify-between text-[10px] text-[#6B625B] mt-0.5">
            <span>Fast (-2d)</span>
            <span>Normal ({baseLeadTime}d)</span>
            <span>Delayed (+10d)</span>
          </div>
        </div>

        {/* Price Increase Variance Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-medium text-[#46362F]">Supplier Price Shift</label>
            <span className={`font-mono font-bold ${priceChangePercent >= 20 ? 'text-[#B42335]' : 'text-[#46362F]'}`}>
              +{priceChangePercent}% (₹{simulatedUnitPrice})
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={priceChangePercent}
            onChange={(e) => setPriceChangePercent(parseInt(e.target.value, 10))}
            className="w-full accent-[#46362F]"
          />
          <div className="flex justify-between text-[10px] text-[#6B625B] mt-0.5">
            <span>0% Baseline</span>
            <span>+20% Guardrail</span>
            <span>+50% Spike</span>
          </div>
        </div>
      </div>

      {/* Real-Time Stress Test Output Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-white border border-[#E7E0D8] rounded-xl space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#6B625B]">Simulated Lead Demand</span>
          <p className="font-mono text-base font-bold text-[#46362F]">
            {simulatedDemand} units
          </p>
          <span className="text-[10px] text-[#6B625B]">{simulatedDailySales}u/day × {simulatedLeadTime}d</span>
        </div>

        <div className="p-3 bg-white border border-[#E7E0D8] rounded-xl space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#6B625B]">Raw Net Shortfall</span>
          <p className="font-mono text-base font-bold text-[#46362F]">
            {rawRequirement} units
          </p>
          <span className="text-[10px] text-[#6B625B]">Target {simulatedTarget} - Avail {simulatedAvailable}</span>
        </div>

        <div className="p-3 bg-white border border-[#E7E0D8] rounded-xl space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-[#6B625B]">Case Pack Rounded</span>
          <p className="font-mono text-base font-bold text-[#46362F]">
            {packResult.finalUnits} units
          </p>
          <span className="text-[10px] text-[#324536] font-semibold">
            {packResult.recommendedCases} cases of {currentSupplier.packSize}
          </span>
        </div>

        <div className={`p-3 bg-white border rounded-xl space-y-0.5 ${
          isBudgetReviewTriggered ? 'border-[#F8C8CE] bg-[#FDF0F2]/40' : 'border-[#E7E0D8]'
        }`}>
          <span className="text-[10px] uppercase font-bold text-[#6B625B]">Simulated Purchase Cost</span>
          <p className={`font-mono text-base font-bold ${
            isBudgetReviewTriggered ? 'text-[#B42335]' : 'text-[#46362F]'
          }`}>
            {formatCurrencyINR(totalCost)}
          </p>
          <span className={`text-[10px] font-semibold ${
            isBudgetReviewTriggered ? 'text-[#B42335]' : 'text-[#324536]'
          }`}>
            {isBudgetReviewTriggered ? '⚠️ Triggers Budget Review' : '✅ Standard Issuance'}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#E7E0D8] text-xs">
        <p className="text-[11px] text-[#6B625B]">
          Stress-tested with current catalog constraints. No data modified in permanent storage.
        </p>

        {onApplyToDecisionRoom && (
          <button
            onClick={() => onApplyToDecisionRoom(currentItem.sku)}
            className="flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-2xs transition-colors"
          >
            <span>Inspect in Decision Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
