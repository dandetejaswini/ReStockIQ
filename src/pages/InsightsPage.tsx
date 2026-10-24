import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle,
  Plus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatCurrencyINR } from '../utils/formatters';
import { calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { inventory, suppliers, orders, requests, setSelectedSku } = useApp();

  const [activeTab, setActiveTab] = useState<'demand' | 'health' | 'purchasing' | 'suppliers'>('demand');

  const categories = useMemo(() => Array.from(new Set(inventory.map(i => i.category))), [inventory]);

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

  // Enriched plans
  const enrichedPlans = useMemo(() => {
    return inventory.map(item => {
      const sup = suppliers.find(s => s.id === item.supplierId) || suppliers[0] || {
        ...defaultSupplier,
        id: item.supplierId || 'SUP-DEFAULT',
        leadTimeDays: item.leadTimeDays || 4,
        currentUnitPrice: item.unitPrice || 100,
        previousUnitPrice: item.unitPrice || 100,
      };
      const plan = calculateReorderPlan(item, sup, orders);
      return { item, sup, plan };
    });
  }, [inventory, suppliers, orders]);

  // Tab 1: Demand Data
  const demandVsStockData = enrichedPlans.map(p => ({
    name: p.item.sku,
    EffectiveStock: p.plan.effectiveStock,
    LeadDemand: p.plan.forecastDemand,
    SafetyStock: p.item.safetyStock,
    Inbound: p.plan.incomingOpenOrders,
  }));

  // Tab 2: Health distribution & category value
  const categoryValueData = categories.map(cat => {
    const items = inventory.filter(i => i.category === cat);
    const totalVal = items.reduce((sum, i) => sum + (i.currentStock * i.unitPrice), 0);
    return { name: cat, value: totalVal, count: items.length };
  });

  const categoryColors = ['#46362F', '#6F4E37', '#8A5F00', '#597B9C', '#36765A'];

  // Tab 3: Purchasing spend data
  const purchaseSpendBySupplier = suppliers.map(sup => {
    const supRequests = requests.filter(r => r.supplierId === sup.id);
    const committed = supRequests.filter(r => r.status === 'Approved' || r.status === 'Verified').reduce((sum, r) => sum + r.totalCost, 0);
    const pending = supRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review').reduce((sum, r) => sum + r.totalCost, 0);
    return {
      supplier: sup.name.split(' ')[0],
      Committed: committed,
      Pending: pending,
    };
  });

  // Tab 4: Supplier Lead Time & Price Variance
  const supplierPerformanceData = suppliers.map(sup => {
    const check = checkSupplierPriceChange(sup.currentUnitPrice, sup.previousUnitPrice);
    return {
      name: sup.name.split(' ')[0],
      leadTime: sup.leadTimeDays,
      packSize: sup.packSize,
      priceVariance: check.percentageChange,
      isPriceJump: check.isPriceJumped,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Inventory Insights & Analytics
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
              Supply Intelligence
            </span>
          </div>
          <p className="text-xs text-[#716A72] mt-0.5">
            Deep-dive analytical models for demand velocity, lead-time exposure, capital commitment, and supplier variance.
          </p>
        </div>

        {/* Workspace Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#F0EDE6] border border-[#E5E0D8] rounded-lg self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('demand')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              activeTab === 'demand' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
            }`}
          >
            Demand Forecasts
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              activeTab === 'health' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
            }`}
          >
            Inventory Health
          </button>
          <button
            onClick={() => setActiveTab('purchasing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              activeTab === 'purchasing' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
            }`}
          >
            Purchasing Spend
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              activeTab === 'suppliers' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
            }`}
          >
            Supplier Performance
          </button>
        </div>
      </div>

      {inventory.length === 0 && suppliers.length === 0 ? (
        <div className="bg-white border border-[#E8E3E9] rounded-2xl p-12 text-center shadow-2xs space-y-3">
          <h3 className="font-serif text-xl font-normal text-[#46362F]">
            Analytics will appear when sufficient data is available.
          </h3>
          <p className="text-xs text-[#77717D] max-w-md mx-auto">
            Add inventory SKUs and suppliers to populate demand forecasts, category capital breakdowns, and vendor lead-time comparisons.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/inventory')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Go to Inventory</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tab 1: Demand Forecasts */}
          {activeTab === 'demand' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#46362F]">
                      Stock Position vs Lead-Time Demand by SKU
                    </h3>
                    <p className="text-xs text-[#77717D]">
                      Compares current effective inventory against projected consumption during supplier replenishment window.
                    </p>
                  </div>
                  <span className="text-[11px] text-[#6F4E37] bg-[#E8E2F0] font-semibold px-2.5 py-1 rounded-lg self-start">
                    Deterministic Lead Window
                  </span>
                </div>

                {demandVsStockData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#77717D]">
                    Analytics will appear when sufficient data is available.
                  </div>
                ) : (
                  <div className="h-80 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demandVsStockData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77717D' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#77717D' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(val: any) => [`${val} units`, '']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="EffectiveStock" fill="#46362F" name="Effective Stock" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="LeadDemand" fill="#BE4856" name="Lead-Time Demand" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Inbound" fill="#36765A" name="Active Inbound" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Demand Insights Summary Table */}
              {enrichedPlans.length > 0 && (
                <div className="bg-white border border-[#E8E3E9] rounded-2xl p-5 shadow-2xs space-y-3">
                  <h4 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                    Lead-Time Consumption Summary & Stockout Invariant
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {enrichedPlans.slice(0, 3).map(({ item, plan }) => (
                      <div key={item.id} className="p-3.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#46362F]">{item.sku}</span>
                          <StatusBadge status={plan.stockStatus} size="sm" />
                        </div>
                        <p className="text-xs font-medium text-[#29232D] line-clamp-1">{item.name}</p>
                        <p className="text-[11px] text-[#77717D]">
                          Burn-rate: <strong className="text-[#29232D]">{item.averageDailySales}u/day</strong> · Lead time: <strong className="text-[#29232D]">{item.leadTimeDays}d</strong>
                        </p>
                        <p className="text-[11px] text-[#77717D]">
                          Forecast: <strong className="text-[#BE4856]">{plan.forecastDemand} units</strong> needed
                        </p>
                        <button
                          onClick={() => {
                            setSelectedSku(item.sku);
                            navigate('/agent');
                          }}
                          className="text-[11px] font-bold text-[#46362F] hover:underline pt-1 block"
                        >
                          Launch in ReStockIQ Copilot →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Inventory Health */}
          {activeTab === 'health' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#46362F]">
                  Inventory Capital Value by Category (INR)
                </h3>
                <p className="text-xs text-[#77717D]">
                  Breakdown of total working capital tied up in shelf stock across merchandise groups.
                </p>
                {categoryValueData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#77717D]">
                    Analytics will appear when sufficient data is available.
                  </div>
                ) : (
                  <>
                    <div className="h-64 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryValueData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryValueData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                            formatter={(val: any) => [formatCurrencyINR(val), 'Capital Value']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#E8E3E9]">
                      {categoryValueData.map((cat, idx) => (
                        <div key={cat.name} className="p-2 bg-[#F5F2F6] rounded-lg">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColors[idx % categoryColors.length] }} />
                            <span className="text-[11px] font-bold text-[#29232D] line-clamp-1">{cat.name}</span>
                          </div>
                          <p className="text-xs font-extrabold text-[#46362F]">{formatCurrencyINR(cat.value)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#46362F]">
                  Stock Health Status Distribution
                </h3>
                <p className="text-xs text-[#77717D]">
                  Categorization based on effective buffer safety vs replenishment lead time.
                </p>
                {enrichedPlans.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#77717D]">
                    No inventory items yet.
                  </div>
                ) : (
                  <div className="space-y-3 pt-3">
                    {enrichedPlans.map(({ item, plan }) => (
                      <div key={item.id} className="p-3 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#46362F]">{item.sku}</span>
                            <span className="text-xs text-[#77717D] line-clamp-1">{item.name}</span>
                          </div>
                          <span className="text-[10px] text-[#77717D]">
                            Stock: {plan.effectiveStock}u · Threshold: {item.reorderThreshold}u · Run-rate: {item.averageDailySales}u/day
                          </span>
                        </div>
                        <StatusBadge status={plan.stockStatus} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Purchasing Spend */}
          {activeTab === 'purchasing' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#46362F]">
                  Committed vs Pending Purchasing Value by Supplier (INR)
                </h3>
                <p className="text-xs text-[#77717D]">
                  Evaluates authorized purchase orders vs recommendations in the approval queue across contracted vendors.
                </p>

                {purchaseSpendBySupplier.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#77717D]">
                    Analytics will appear when sufficient supplier and purchase request data is available.
                  </div>
                ) : (
                  <div className="h-72 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={purchaseSpendBySupplier} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                        <XAxis dataKey="supplier" tick={{ fontSize: 11, fill: '#77717D' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#77717D' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(val: any) => [formatCurrencyINR(val), '']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="Committed" fill="#36765A" name="Authorized Spend" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Pending" fill="#EAAA00" name="Pending Review" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#FFF8E6] border border-[#EAAA00]/40 rounded-2xl text-xs flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#EAAA00]/20 text-[#8A5F00] mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#8A5F00] text-sm">Budget Guardrail Policy Active</h4>
                  <p className="text-[#77717D] mt-0.5 leading-relaxed">
                    Purchase proposals originating from suppliers with price variances ≥ 20.0% are held in "Needs Budget Review" state until signed off by the store procurement lead.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Supplier Performance */}
          {activeTab === 'suppliers' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E8EAF2] rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-[#46362F]">
                  Supplier Lead Time vs Contract Packaging Units
                </h3>
                <p className="text-xs text-[#77717D]">
                  Suppliers with higher pack size constraints require larger rounding multipliers during purchase calculation.
                </p>

                {supplierPerformanceData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#77717D]">
                    Analytics will appear when sufficient supplier data is available.
                  </div>
                ) : (
                  <div className="h-72 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={supplierPerformanceData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77717D' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#77717D' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="leadTime" fill="#6F4E37" name="Lead Time (Days)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="packSize" fill="#46362F" name="Pack Size (Units/Case)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#E8E3E9] rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-[#E8E3E9] flex items-center justify-between">
                  <h4 className="font-bold text-xs text-[#46362F]">Contract Pricing & Escalation Status</h4>
                  <span className="text-[11px] text-[#77717D]">20% Price Variance Guardrail</span>
                </div>
                <div className="divide-y divide-[#E8E3E9] text-xs">
                  {suppliers.length === 0 ? (
                    <div className="p-8 text-center text-[#77717D]">
                      No suppliers added yet.
                    </div>
                  ) : (
                    suppliers.map(sup => {
                      const check = checkSupplierPriceChange(sup.currentUnitPrice, sup.previousUnitPrice);
                      return (
                        <div key={sup.id} className="p-4 flex items-center justify-between hover:bg-[#F5F2F6] transition-colors">
                          <div>
                            <p className="font-bold text-[#29232D]">{sup.name} <span className="font-mono text-[#77717D] text-[10px]">({sup.id})</span></p>
                            <p className="text-[11px] text-[#77717D]">
                              Lead: {sup.leadTimeDays}d · Pack Multiple: {sup.packSize}u/case · MOQ: {sup.minimumOrderQuantity}u
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-extrabold text-[#46362F]">{formatCurrencyINR(sup.currentUnitPrice)}</p>
                            {check.isPriceJumped ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[#8A5F00] bg-[#FFF8E6] px-2 py-0.5 rounded border border-[#EAAA00]/40 text-[10px]">
                                +{check.percentageChange}% PRICE JUMP
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#36765A] font-semibold">Contract Stable ({check.percentageChange}%)</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
