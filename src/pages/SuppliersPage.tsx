import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  Clock, 
  TrendingUp, 
  Package, 
  Phone, 
  Mail, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Plus
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
import { Supplier } from '../types';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatCurrencyINR, formatDate } from '../utils/formatters';
import { checkSupplierPriceChange } from '../utils/reorderCalculations';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, orders, inventory, receiveIncomingOrder, addSupplier, addIncomingOrder } = useApp();

  const [activeTab, setActiveTab] = useState<'directory' | 'orders' | 'price' | 'leadtimes'>('directory');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    representative: '',
    email: '',
    phone: '',
    address: '',
    leadTimeDays: 5,
    packSize: 10,
    minimumOrderQuantity: 20,
    currentUnitPrice: 100,
    previousUnitPrice: 100,
  });

  const [newOrder, setNewOrder] = useState({
    sku: '',
    supplierId: '',
    orderedQuantity: 50,
    expectedArrivalDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  });

  // Filters for incoming orders
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderSupplierFilter, setOrderSupplierFilter] = useState<string>('ALL');

  // Overview metrics (safe for 0 suppliers)
  const totalSuppliers = suppliers.length;
  const activeOrders = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');
  const suppliersWithActiveOrders = new Set(activeOrders.map(o => o.supplierId)).size;
  const averageLeadTime = suppliers.length > 0
    ? Math.round(suppliers.reduce((acc, s) => acc + s.leadTimeDays, 0) / suppliers.length)
    : 0;
  const priceEscalatedSuppliers = suppliers.filter(s => checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice).isPriceJumped);
  const suppliersWithPriceJumps = priceEscalatedSuppliers.length;
  const totalValueOfOpenOrders = activeOrders.reduce((sum, o) => {
    const item = inventory.find(i => i.sku === o.sku);
    return sum + (o.remainingOpenQuantity * (item?.unitPrice || 0));
  }, 0);

  // Filtered orders
  const filteredOrders = orders.filter(order => {
    const matchStatus = orderStatusFilter === 'ALL' || order.status === orderStatusFilter;
    const matchSupplier = orderSupplierFilter === 'ALL' || order.supplierId === orderSupplierFilter;
    return matchStatus && matchSupplier;
  });

  // Real supplier price comparison data derived from actual suppliers
  const supplierPriceComparisonData = suppliers.map(s => ({
    name: s.name.split(' ')[0],
    PreviousPrice: s.previousUnitPrice,
    CurrentPrice: s.currentUnitPrice,
  }));

  // Lead-time comparison data
  const leadTimeComparisonData = suppliers.map(s => ({
    name: s.name.split(' ')[0],
    LeadDays: s.leadTimeDays,
    PackSize: s.packSize,
    MOQ: s.minimumOrderQuantity,
  }));

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const currPrice = Number(newSupplier.currentUnitPrice) || 100;
    const prevPrice = Number(newSupplier.previousUnitPrice) || currPrice;
    addSupplier({
      name: newSupplier.name.trim(),
      contactInformation: {
        representative: newSupplier.representative.trim() || 'Account Representative',
        email: newSupplier.email.trim() || 'orders@vendor.com',
        phone: newSupplier.phone.trim() || '',
        address: newSupplier.address.trim() || '',
      },
      leadTimeDays: Number(newSupplier.leadTimeDays) || 5,
      packSize: Number(newSupplier.packSize) || 1,
      minimumOrderQuantity: Number(newSupplier.minimumOrderQuantity) || 1,
      currentUnitPrice: currPrice,
      previousUnitPrice: prevPrice,
      priceHistory: [{ date: todayStr, price: currPrice }],
      status: checkSupplierPriceChange(currPrice, prevPrice).isPriceJumped
        ? 'Under Review'
        : 'Active',
    });
    setNewSupplier({
      name: '',
      representative: '',
      email: '',
      phone: '',
      address: '',
      leadTimeDays: 5,
      packSize: 10,
      minimumOrderQuantity: 20,
      currentUnitPrice: 100,
      previousUnitPrice: 100,
    });
    setIsAddSupplierOpen(false);
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSku = newOrder.sku || inventory[0]?.sku;
    const targetSup = newOrder.supplierId || suppliers[0]?.id || 'SUP-DEFAULT';
    if (!targetSku) return;
    const qty = Number(newOrder.orderedQuantity) || 10;
    addIncomingOrder({
      sku: targetSku.toUpperCase(),
      supplierId: targetSup,
      orderedQuantity: qty,
      remainingOpenQuantity: qty,
      expectedArrivalDate: newOrder.expectedArrivalDate,
      status: 'In Transit',
      orderDate: new Date().toISOString().split('T')[0],
    });
    setIsAddOrderOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Supply Chain & Logistics
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
              Vendor Contracts & Orders
            </span>
          </div>
          <p className="text-xs text-[#716A72] mt-0.5">
            Manage vendor networks, pipeline logistics, case pack constraints, and price increase escalations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#342721] rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier</span>
          </button>

          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#261E27] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#6F4E37]" />
            <span>Log Incoming Order</span>
          </button>

          {/* 4 Internal Workspace Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#F0EDE6] border border-[#E5E0D8] rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                activeTab === 'directory' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
              }`}
            >
              Supplier Directory ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                activeTab === 'orders' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
              }`}
            >
              Incoming Orders ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('price')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                activeTab === 'price' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
              }`}
            >
              Price Intelligence
            </button>
            <button
              onClick={() => setActiveTab('leadtimes')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                activeTab === 'leadtimes' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#716A72] hover:text-[#261E27]'
              }`}
            >
              Lead-Time Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Total Vendors"
          value={totalSuppliers}
          icon={Truck}
          description="Contracted vendors"
          trend={totalSuppliers > 0 ? 'Active' : 'Empty'}
        />
        <StatCard
          label="Inbound Active"
          value={suppliersWithActiveOrders}
          icon={Package}
          description="Open purchase orders"
          trend={`${suppliersWithActiveOrders} vendors`}
        />
        <StatCard
          label="Average Lead Time"
          value={totalSuppliers > 0 ? `${averageLeadTime} days` : '0 days'}
          icon={Clock}
          description="Restock delay baseline"
          trend="Benchmark"
        />
        <StatCard
          label="Price Escalations"
          value={suppliersWithPriceJumps}
          icon={TrendingUp}
          description="Exceeds 20% guardrail"
          trend={suppliersWithPriceJumps > 0 ? 'Escalated' : 'None'}
          trendType={suppliersWithPriceJumps > 0 ? 'marigold' : 'positive'}
        />
        <StatCard
          label="Inbound Open Value"
          value={formatCurrencyINR(totalValueOfOpenOrders)}
          icon={CheckCircle2}
          description="Committed in transit"
          trend="Pipeline"
        />
      </div>

      {/* TAB 1: Supplier Directory */}
      {activeTab === 'directory' && (
        <div className="bg-white border border-[#E8E3E9] rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E3E9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                Contracted Vendor Specifications & Case Packs
              </h2>
              <p className="text-[11px] text-[#77717D]">
                Lead times and pack sizes directly govern replenishment order sizing
              </p>
            </div>
            <span className="text-[11px] text-[#6F4E37] font-semibold bg-[#E8E2F0] px-2.5 py-1 rounded-lg self-start">
              INR Contract Master
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F2F6] border-b border-[#E8E3E9] text-[#77717D] font-semibold">
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-3">Contact & Rep</th>
                  <th className="py-3 px-3 text-right">Lead Time</th>
                  <th className="py-3 px-3 text-right">Pack Size</th>
                  <th className="py-3 px-3 text-right">MOQ</th>
                  <th className="py-3 px-3 text-right">Unit Price</th>
                  <th className="py-3 px-3 text-right">Price Variance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E3E9]">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 px-4 text-center">
                      <div className="max-w-sm mx-auto space-y-2.5">
                        <p className="text-sm font-bold text-[#46362F]">No suppliers added yet.</p>
                        <p className="text-xs text-[#77717D]">
                          Add your contracted suppliers to configure lead times, pack multiples, and unit pricing.
                        </p>
                        <button
                          onClick={() => setIsAddSupplierOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Supplier</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  suppliers.map(sup => {
                    const priceCheck = checkSupplierPriceChange(sup.currentUnitPrice, sup.previousUnitPrice);

                    return (
                      <tr key={sup.id} className="hover:bg-[#F5F2F6] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#29232D]">{sup.name}</div>
                          <div className="text-[10px] text-[#77717D] font-mono">{sup.id}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-[#29232D] font-medium">{sup.contactInformation.representative}</div>
                          <div className="text-[10px] text-[#77717D]">{sup.contactInformation.email}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-[#29232D]">
                          {sup.leadTimeDays} days
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-[#46362F]">
                          {sup.packSize} units/case
                        </td>
                        <td className="py-3.5 px-3 text-right text-[#77717D]">
                          {sup.minimumOrderQuantity} units
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-[#46362F]">
                          {formatCurrencyINR(sup.currentUnitPrice)}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {priceCheck.isPriceJumped ? (
                            <span className="inline-flex items-center gap-1 font-bold text-[#8A5F00] bg-[#FFF8E6] px-2 py-0.5 rounded border border-[#EAAA00]/40 text-[10px]">
                              +{priceCheck.percentageChange}%
                            </span>
                          ) : (
                            <span className="text-[#36765A] font-semibold text-[11px]">{priceCheck.percentageChange}%</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <StatusBadge status={sup.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedSupplier(sup)}
                            className="px-2.5 py-1 text-xs font-bold text-[#46362F] bg-[#E8E2F0] hover:bg-[#46362F] hover:text-white rounded-lg transition-colors"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Incoming Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-white border border-[#E8E3E9] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-lg text-[#29232D]"
              >
                <option value="ALL">All Order States</option>
                <option value="In Transit">In Transit</option>
                <option value="Ordered">Ordered</option>
                <option value="Received">Received (Historical)</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={orderSupplierFilter}
                onChange={(e) => setOrderSupplierFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-lg text-[#29232D]"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {(orderStatusFilter !== 'ALL' || orderSupplierFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setOrderStatusFilter('ALL');
                    setOrderSupplierFilter('ALL');
                  }}
                  className="text-xs text-[#46362F] font-semibold hover:underline px-2 py-1"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-xs text-[#77717D]">
              Showing <strong>{filteredOrders.length}</strong> purchase orders
            </div>
          </div>

          <div className="bg-white border border-[#E8E3E9] rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F2F6] border-b border-[#E8E3E9] text-[#77717D] font-semibold">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-3">SKU & Item</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3 text-right">Ordered Qty</th>
                    <th className="py-3 px-3 text-right">Open / Pending Qty</th>
                    <th className="py-3 px-3">Expected Arrival</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">ERP Source Ref</th>
                    <th className="py-3 px-4 text-right">Inbound Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E3E9]">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 px-4 text-center">
                        <div className="max-w-sm mx-auto space-y-2.5">
                          <p className="text-sm font-bold text-[#46362F]">No orders yet.</p>
                          <p className="text-xs text-[#77717D]">
                            Log an incoming purchase order to track pipeline shipments and offset replenishment calculations.
                          </p>
                          <button
                            onClick={() => setIsAddOrderOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Log Incoming Order</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const item = inventory.find(i => i.sku === order.sku);
                      const sup = suppliers.find(s => s.id === order.supplierId);
                      const isOpen = order.remainingOpenQuantity > 0 && order.status !== 'Received' && order.status !== 'Cancelled';

                      return (
                        <tr key={order.id} className="hover:bg-[#F5F2F6] transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#29232D]">
                            {order.id}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-[#46362F]">{order.sku}</span>
                            <span className="block text-[11px] text-[#77717D] line-clamp-1">{item?.name || 'Product'}</span>
                          </td>
                          <td className="py-3.5 px-3 text-[#77717D] font-medium">{sup?.name || order.supplierId}</td>
                          <td className="py-3.5 px-3 text-right text-[#77717D]">
                            {order.orderedQuantity} units
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {isOpen ? (
                              <span className="font-extrabold text-[#36765A] bg-[#EBF7F0] px-2 py-0.5 rounded border border-[#BCE8D3]">
                                {order.remainingOpenQuantity} units open
                              </span>
                            ) : (
                              <span className="text-[#77717D]">0 (Closed)</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-[#29232D]">
                            {formatDate(order.expectedArrivalDate)}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <StatusBadge status={order.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-3 text-[#77717D] font-mono text-[11px]">
                            {order.sourceRecordId}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isOpen ? (
                              <button
                                onClick={() => receiveIncomingOrder(order.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#36765A] hover:bg-[#2c614a] rounded-lg shadow-2xs transition-colors"
                                title="Receive shipment and restock ledger inventory"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Receive Shipment</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#36765A] font-semibold">
                                ✓ Received & Restocked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Price Intelligence */}
      {activeTab === 'price' && (
        <div className="space-y-6">
          {priceEscalatedSuppliers.length > 0 && (
            <div className="p-5 bg-[#FFF8E6] border border-[#EAAA00]/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#8A5F00] bg-white px-2 py-0.5 rounded border border-[#EAAA00]/30 uppercase">
                  Marigold Alert Triggered
                </span>
                <h3 className="text-sm font-bold text-[#8A5F00]">
                  Supplier Price Escalation Detected ({priceEscalatedSuppliers.map(s => s.name).join(', ')})
                </h3>
                <p className="text-xs text-[#29232D] leading-relaxed max-w-2xl">
                  One or more contracted suppliers increased unit pricing by 20% or more. Automated purchasing is routed to Budget Review.
                </p>
              </div>
              <button
                onClick={() => navigate('/approvals')}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#EAAA00] hover:bg-[#D49800] rounded-xl shadow-2xs transition-colors shrink-0"
              >
                Review Proposals
              </button>
            </div>
          )}

          <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
              Contract Unit Price Comparison (Previous vs Current INR)
            </h3>
            <p className="text-[11px] text-[#77717D]">
              Compares previous contract unit prices against current supplier unit pricing.
            </p>

            {suppliers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#77717D]">
                Analytics will appear when sufficient supplier data is available.
              </div>
            ) : (
              <div className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierPriceComparisonData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77717D' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#77717D' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val: any) => [`₹${val}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="PreviousPrice" fill="#D9C6A5" name="Previous Unit Price (₹)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="CurrentPrice" fill="#46362F" name="Current Unit Price (₹)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Lead-Time Analysis */}
      {activeTab === 'leadtimes' && (
        <div className="space-y-6">
          <div className="p-5 bg-white border border-[#E8E3E9] rounded-2xl shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
              Supplier Replenishment Lead Time vs Minimum Order Quantity
            </h3>
            <p className="text-[11px] text-[#77717D]">
              Evaluates restock delay against vendor minimum dispatch requirements.
            </p>

            {suppliers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#77717D]">
                Analytics will appear when sufficient supplier data is available.
              </div>
            ) : (
              <div className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadTimeComparisonData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77717D' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#77717D' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E3E9', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="LeadDays" fill="#6F4E37" name="Lead Time (Days)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="MOQ" fill="#46362F" name="MOQ (Units)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E8E3E9] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <h3 className="text-sm font-bold text-[#46362F]">Add Contracted Supplier</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter supplier name"
                    value={newSupplier.name}
                    onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Account Representative</label>
                  <input
                    type="text"
                    placeholder="Contact person"
                    value={newSupplier.representative}
                    onChange={e => setNewSupplier({ ...newSupplier, representative: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="orders@supplier.com"
                    value={newSupplier.email}
                    onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 ..."
                    value={newSupplier.phone}
                    onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newSupplier.leadTimeDays}
                    onChange={e => setNewSupplier({ ...newSupplier, leadTimeDays: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Pack Size (Units)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newSupplier.packSize}
                    onChange={e => setNewSupplier({ ...newSupplier, packSize: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">MOQ (Units)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newSupplier.minimumOrderQuantity}
                    onChange={e => setNewSupplier({ ...newSupplier, minimumOrderQuantity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Previous Unit Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={newSupplier.previousUnitPrice}
                    onChange={e => setNewSupplier({ ...newSupplier, previousUnitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Current Unit Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={newSupplier.currentUnitPrice}
                    onChange={e => setNewSupplier({ ...newSupplier, currentUnitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E3E9]">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-3 py-1.5 border border-[#E8E3E9] rounded-xl hover:bg-[#F5F2F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-[#46362F] hover:bg-[#342721] rounded-xl font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Incoming Order Modal */}
      {isAddOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E8E3E9] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <h3 className="text-sm font-bold text-[#46362F]">Log Incoming Purchase Order</h3>
              <button onClick={() => setIsAddOrderOpen(false)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOrder} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#29232D] mb-1">Target SKU *</label>
                {inventory.length > 0 ? (
                  <select
                    value={newOrder.sku || inventory[0]?.sku}
                    onChange={e => setNewOrder({ ...newOrder, sku: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  >
                    {inventory.map(item => (
                      <option key={item.sku} value={item.sku}>{item.sku} — {item.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Enter SKU code"
                    value={newOrder.sku}
                    onChange={e => setNewOrder({ ...newOrder, sku: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                )}
              </div>
              <div>
                <label className="block font-semibold text-[#29232D] mb-1">Supplier</label>
                <select
                  value={newOrder.supplierId || suppliers[0]?.id || ''}
                  onChange={e => setNewOrder({ ...newOrder, supplierId: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                >
                  {suppliers.length === 0 ? (
                    <option value="SUP-DEFAULT">Direct Supplier</option>
                  ) : (
                    suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Ordered Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newOrder.orderedQuantity}
                    onChange={e => setNewOrder({ ...newOrder, orderedQuantity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Expected Arrival</label>
                  <input
                    type="date"
                    required
                    value={newOrder.expectedArrivalDate}
                    onChange={e => setNewOrder({ ...newOrder, expectedArrivalDate: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E3E9]">
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="px-3 py-1.5 border border-[#E8E3E9] rounded-xl hover:bg-[#F5F2F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-[#46362F] hover:bg-[#342721] rounded-xl font-bold"
                >
                  Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Detail Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E8E3E9] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <div>
                <h3 className="text-sm font-bold text-[#46362F]">{selectedSupplier.name}</h3>
                <span className="text-[10px] text-[#77717D] font-mono">{selectedSupplier.id}</span>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl space-y-1.5">
                <p className="font-bold text-[#46362F]">Representative Contact</p>
                <div className="grid grid-cols-2 gap-2 text-[#77717D]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#6F4E37]" />
                    <span>{selectedSupplier.contactInformation.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#6F4E37]" />
                    <span>{selectedSupplier.contactInformation.phone}</span>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 pt-1 text-[#77717D]">
                  <MapPin className="w-3.5 h-3.5 text-[#6F4E37] mt-0.5 shrink-0" />
                  <span>{selectedSupplier.contactInformation.address}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 border border-[#E8E3E9] rounded-xl">
                  <p className="text-[10px] text-[#77717D]">Lead Time</p>
                  <p className="font-extrabold text-[#46362F] text-sm">{selectedSupplier.leadTimeDays} Days</p>
                </div>
                <div className="p-2.5 border border-[#E8E3E9] rounded-xl">
                  <p className="text-[10px] text-[#77717D]">Pack Multiple</p>
                  <p className="font-extrabold text-[#46362F] text-sm">{selectedSupplier.packSize} Units/Case</p>
                </div>
                <div className="p-2.5 border border-[#E8E3E9] rounded-xl">
                  <p className="text-[10px] text-[#77717D]">Min Order</p>
                  <p className="font-extrabold text-[#46362F] text-sm">{selectedSupplier.minimumOrderQuantity} Units</p>
                </div>
              </div>

              {checkSupplierPriceChange(selectedSupplier.currentUnitPrice, selectedSupplier.previousUnitPrice).isPriceJumped && (
                <div className="p-3.5 bg-[#FFF8E6] border border-[#EAAA00]/40 rounded-xl text-[#8A5F00]">
                  <p className="font-bold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#EAAA00]" />
                    <span>Price Jump Alert Active (+{checkSupplierPriceChange(selectedSupplier.currentUnitPrice, selectedSupplier.previousUnitPrice).percentageChange}%)</span>
                  </p>
                  <p className="text-[11px] mt-1 leading-relaxed">
                    Unit price increased from ₹{selectedSupplier.previousUnitPrice.toFixed(2)} to ₹{selectedSupplier.currentUnitPrice.toFixed(2)}. Proposals from this vendor require manager budget review.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#E8E3E9]">
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#46362F] hover:bg-[#4E1546] rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
