import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Upload, 
  Eye, 
  Edit3, 
  Sparkles, 
  X, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Clock,
  Layers,
  Box,
  TrendingDown
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { InventoryItem, StockStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatCurrencyINR, formatDate } from '../utils/formatters';
import { calculateReorderPlan } from '../utils/reorderCalculations';
import { CsvImportModal } from '../components/onboarding/CsvImportModal';

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    inventory, 
    suppliers, 
    orders, 
    addInventoryItem, 
    updateInventoryItem, 
    importInventoryCsv, 
    setSelectedSku 
  } = useApp();

  const initialQuery = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'stock' | 'sales' | 'price' | 'sku'>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected item drawer
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Packaging',
    supplierId: suppliers[0]?.id || 'SUP-001',
    currentStock: 50,
    reservedStock: 0,
    averageDailySales: 5,
    leadTimeDays: 4,
    safetyStock: 10,
    reorderThreshold: 30,
    unitPrice: 100,
    sourceRecordId: 'MANUAL-ENTRY',
  });

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

  // Enriched items with calculations
  const enrichedItems = useMemo(() => {
    return inventory.map(item => {
      const sup = suppliers.find(s => s.id === item.supplierId) || suppliers[0] || {
        ...defaultSupplier,
        id: item.supplierId || 'SUP-DEFAULT',
        leadTimeDays: item.leadTimeDays || 4,
        currentUnitPrice: item.unitPrice || 100,
        previousUnitPrice: item.unitPrice || 100,
      };
      const plan = calculateReorderPlan(item, sup, orders);
      const daysOfStock = item.averageDailySales > 0 ? (plan.effectiveStock / item.averageDailySales).toFixed(1) : 'Stable';
      return {
        ...item,
        plan,
        supplierName: sup.name,
        daysOfStock,
      };
    });
  }, [inventory, suppliers, orders]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return enrichedItems.filter(item => {
      const matchesSearch = 
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSupplier = selectedSupplier === 'ALL' || item.supplierId === selectedSupplier;
      const matchesStatus = selectedStatus === 'ALL' || item.plan.stockStatus === selectedStatus;

      return matchesSearch && matchesCategory && matchesSupplier && matchesStatus;
    }).sort((a, b) => {
      let comp = 0;
      if (sortBy === 'sku') comp = a.sku.localeCompare(b.sku);
      if (sortBy === 'stock') comp = a.currentStock - b.currentStock;
      if (sortBy === 'sales') comp = a.averageDailySales - b.averageDailySales;
      if (sortBy === 'price') comp = a.unitPrice - b.unitPrice;
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [enrichedItems, searchQuery, selectedCategory, selectedSupplier, selectedStatus, sortBy, sortDirection]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCsv = () => {
    const headers = [
      'SKU', 'Name', 'Category', 'Supplier', 'CurrentStock', 
      'ReservedStock', 'IncomingStock', 'AvgDailySales', 'LeadTimeDays', 
      'ReorderThreshold', 'UnitPriceINR', 'StockStatus', 'DaysRemaining'
    ];

    const rows = enrichedItems.map(i => [
      i.sku,
      `"${i.name.replace(/"/g, '""')}"`,
      i.category,
      `"${i.supplierName}"`,
      i.currentStock,
      i.reservedStock,
      i.plan.incomingOpenOrders,
      i.averageDailySales,
      i.leadTimeDays,
      i.reorderThreshold,
      i.unitPrice,
      i.plan.stockStatus,
      i.daysOfStock
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ReStockIQ_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) return;

    const todayStr = new Date().toISOString().split('T')[0];

    addInventoryItem({
      sku: formData.sku.toUpperCase(),
      name: formData.name,
      category: formData.category,
      supplierId: formData.supplierId || suppliers[0]?.id || 'SUP-DEFAULT',
      currentStock: Number(formData.currentStock),
      reservedStock: Number(formData.reservedStock),
      averageDailySales: Number(formData.averageDailySales),
      salesHistory: [
        { date: todayStr, units: Number(formData.averageDailySales) },
      ],
      leadTimeDays: Number(formData.leadTimeDays),
      safetyStock: Number(formData.safetyStock),
      reorderThreshold: Number(formData.reorderThreshold),
      unitPrice: Number(formData.unitPrice),
      sourceRecordId: `SKU-${Date.now().toString().slice(-6)}`,
    });

    setFormData({
      sku: '',
      name: '',
      category: 'Packaging',
      supplierId: suppliers[0]?.id || 'SUP-DEFAULT',
      currentStock: 50,
      reservedStock: 0,
      averageDailySales: 5,
      leadTimeDays: 4,
      safetyStock: 10,
      reorderThreshold: 30,
      unitPrice: 100,
      sourceRecordId: 'MANUAL-ENTRY',
    });
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    updateInventoryItem(editingItem);
    setIsEditModalOpen(false);
    if (detailItem?.id === editingItem.id) {
      setDetailItem(editingItem);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Inventory Management
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
              {inventory.length} Tracked Lines
            </span>
          </div>
          <p className="text-xs text-[#716A72] mt-0.5">
            Monitor stock health, evaluate lead-time replenishment risks, and convert shortages into supplier case multiples.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#4E1546] rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add SKU</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#261E27] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#6F4E37]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#261E27] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#6F4E37]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3.5 bg-white border border-[#E5E0D8] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77717D]" />
          <input
            type="text"
            placeholder="Search by SKU or item name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] focus:bg-white text-[#29232D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D]"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedSupplier}
            onChange={(e) => {
              setSelectedSupplier(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D]"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D]"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="Healthy">Healthy</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Critical">Critical</option>
            <option value="Stockout Risk">Stockout Risk</option>
          </select>

          <select
            value={`${sortBy}-${sortDirection}`}
            onChange={(e) => {
              const [sb, sd] = e.target.value.split('-') as [any, any];
              setSortBy(sb);
              setSortDirection(sd);
            }}
            className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D]"
          >
            <option value="sku-asc">SKU (A to Z)</option>
            <option value="stock-asc">Stock (Lowest First)</option>
            <option value="stock-desc">Stock (Highest First)</option>
            <option value="sales-desc">Sales (Fastest)</option>
            <option value="price-desc">Price (Highest)</option>
          </select>

          {(searchQuery || selectedCategory !== 'ALL' || selectedSupplier !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedSupplier('ALL');
                setSelectedStatus('ALL');
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-[#46362F] hover:underline px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced Inventory Table */}
      <div className="bg-white border border-[#E8E3E9] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F2F6] border-b border-[#E8E3E9] text-[#77717D] font-semibold">
                <th className="py-3 px-4">SKU & Item Details</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Inbound</th>
                <th className="py-3 px-3 text-right">Daily Sales</th>
                <th className="py-3 px-3 text-right">Stock Cover</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-center">Health Status</th>
                <th className="py-3 px-3 text-center">Stockout Window</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3E9]">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <p className="text-sm font-bold text-[#46362F]">
                        {inventory.length === 0 ? 'No inventory items yet.' : 'No inventory items match your filters.'}
                      </p>
                      <p className="text-xs text-[#77717D]">
                        {inventory.length === 0
                          ? 'Add your first SKU or import a CSV catalog to start monitoring replenishment health.'
                          : 'Try adjusting your search query or clearing the active filters.'}
                      </p>
                      {inventory.length === 0 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First SKU</span>
                          </button>
                          <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#46362F] bg-[#F5F2F6] hover:bg-[#E8E2F0] border border-[#E8E3E9] rounded-xl transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Import CSV</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isRisk = item.plan.stockStatus === 'Stockout Risk' || item.plan.stockStatus === 'Critical';

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-[#F5F2F6] transition-colors ${
                        isRisk ? 'bg-[#FDF0F2]/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#46362F]">{item.sku}</div>
                        <div className="text-[11px] text-[#77717D] line-clamp-1">{item.name}</div>
                      </td>
                      <td className="py-3.5 px-3 text-[#77717D] font-medium">{item.category}</td>
                      <td className="py-3.5 px-3 text-[#29232D] font-semibold">{item.supplierName}</td>
                      <td className="py-3.5 px-3 text-right">
                        <span className={`font-bold ${isRisk ? 'text-[#BE4856]' : 'text-[#29232D]'}`}>
                          {item.currentStock}
                        </span>
                        {item.reservedStock > 0 && (
                          <span className="block text-[10px] text-[#77717D]">
                            ({item.reservedStock} res)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {item.plan.incomingOpenOrders > 0 ? (
                          <span className="font-bold text-[#36765A] bg-[#EBF7F0] px-1.5 py-0.2 rounded border border-[#BCE8D3]">
                            +{item.plan.incomingOpenOrders}
                          </span>
                        ) : (
                          <span className="text-[#77717D]">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right text-[#77717D]">
                        {item.averageDailySales} /day
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold text-[#29232D]">
                        {item.daysOfStock} days
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-[#46362F]">
                        {formatCurrencyINR(item.unitPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge status={item.plan.stockStatus} size="sm" />
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {item.plan.projectedStockoutDays !== null ? (
                          <span className={`font-bold ${item.plan.projectedStockoutDays <= item.leadTimeDays ? 'text-[#BE4856]' : 'text-[#77717D]'}`}>
                            {item.plan.projectedStockoutDays} days
                          </span>
                        ) : (
                          <span className="text-[#36765A] font-semibold">Protected</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDetailItem(item)}
                            title="Inspect Reorder Breakdown"
                            className="p-1 text-[#77717D] hover:text-[#46362F] hover:bg-[#E8E2F0] rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditModalOpen(true);
                            }}
                            title="Modify Attributes"
                            className="p-1 text-[#77717D] hover:text-[#29232D] hover:bg-[#F5F2F6] rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSku(item.sku);
                              navigate(`/agent?sku=${item.sku}&autoAnalyze=true`);
                            }}
                            title="Launch automatic AI analysis for this SKU"
                            className="p-1 text-[#46362F] hover:bg-[#E8E2F0] rounded-lg transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-[#D9C6A5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-3.5 border-t border-[#E8E3E9] text-xs text-[#77717D] bg-white">
          <span>
            Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} SKUs
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-[#E8E3E9] disabled:opacity-40 hover:bg-[#F5F2F6]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-[#29232D]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-[#E8E3E9] disabled:opacity-40 hover:bg-[#F5F2F6]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Item Detail Drawer */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl border-l border-[#E8E3E9] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-[#46362F]">{detailItem.sku}</span>
                  <StatusBadge status={calculateReorderPlan(detailItem, suppliers.find(s => s.id === detailItem.supplierId) || suppliers[0] || defaultSupplier, orders).stockStatus} />
                </div>
                <h3 className="text-xs text-[#77717D] mt-0.5">{detailItem.name}</h3>
              </div>
              <button onClick={() => setDetailItem(null)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6 flex-1 text-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#46362F]">7-Day Sales Velocity (Run-Rate)</h4>
                  <span className="text-[11px] text-[#77717D]">Average: {detailItem.averageDailySales} units/day</span>
                </div>
                <div className="h-36 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detailItem.salesHistory}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#77717D' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#77717D' }} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                      <Area type="monotone" dataKey="units" stroke="#46362F" fill="#E8E2F0" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Explainable Reorder Breakdown */}
              {(() => {
                const sup = suppliers.find(s => s.id === detailItem.supplierId) || suppliers[0] || defaultSupplier;
                const plan = calculateReorderPlan(detailItem, sup, orders);
                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                      Explainable Reorder Calculation
                    </h4>

                    <div className="space-y-2">
                      {plan.formulaSteps.map((step, idx) => (
                        <div key={idx} className="p-3 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-[#29232D]">
                            <span>{step.step}</span>
                            <span className="text-[#46362F] font-extrabold">{step.result}</span>
                          </div>
                          <div className="text-[11px] font-mono text-[#77717D] bg-white p-1 rounded border border-[#E8E3E9]">
                            {step.formula}
                          </div>
                          <div className="text-[10px] text-[#77717D]">
                            Inputs: {step.values}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-gradient-to-r from-[#E8E2F0] to-[#F5F2F6] border border-[#46362F]/20 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#46362F]">Calculated Order Multiplier</p>
                        <p className="text-base font-extrabold text-[#46362F]">
                          {plan.finalOrderUnits} units ({plan.recommendedCases} cases)
                        </p>
                        <p className="text-[11px] text-[#77717D]">
                          Total: {formatCurrencyINR(plan.totalCost)} @ {formatCurrencyINR(plan.unitPrice)}/u
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSku(detailItem.sku);
                          setDetailItem(null);
                          navigate(`/agent?sku=${detailItem.sku}&autoAnalyze=true`);
                        }}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl shadow-xs transition-colors"
                      >
                        Launch in ReStockIQ Copilot
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E8E3E9] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <h3 className="text-sm font-bold text-[#46362F]">Add New Catalog Item</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-111"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#29232D] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Herbal Extract 100ml"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Supplier</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Unit Price (₹ INR)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Daily Sales</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.averageDailySales}
                    onChange={(e) => setFormData({ ...formData, averageDailySales: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Lead (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E3E9]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E8E3E9] rounded-xl hover:bg-[#F5F2F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-[#46362F] hover:bg-[#4E1546] rounded-xl font-bold"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E8E3E9] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <div>
                <h3 className="text-sm font-bold text-[#46362F]">Edit SKU Attributes</h3>
                <p className="text-[11px] text-[#77717D]">Modifying {editingItem.sku} — changes will recompute replenishment math</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">SKU Identifier</label>
                  <input
                    type="text"
                    disabled
                    value={editingItem.sku}
                    className="w-full p-2.5 bg-[#E8E3E9]/50 border border-[#E8E3E9] rounded-xl font-mono text-[#77717D] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#29232D] mb-1">Product Description / Name *</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Assigned Supplier</label>
                  <select
                    value={editingItem.supplierId}
                    onChange={(e) => setEditingItem({ ...editingItem, supplierId: e.target.value })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Unit Price (₹ INR)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingItem.unitPrice}
                    onChange={(e) => setEditingItem({ ...editingItem, unitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Physical Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingItem.currentStock}
                    onChange={(e) => setEditingItem({ ...editingItem, currentStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Reserved Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingItem.reservedStock}
                    onChange={(e) => setEditingItem({ ...editingItem, reservedStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Daily Sales Rate</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingItem.averageDailySales}
                    onChange={(e) => setEditingItem({ ...editingItem, averageDailySales: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingItem.leadTimeDays}
                    onChange={(e) => setEditingItem({ ...editingItem, leadTimeDays: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#29232D] mb-1">Safety Stock Buffer</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingItem.safetyStock}
                    onChange={(e) => setEditingItem({ ...editingItem, safetyStock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E3E9]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#E8E3E9] rounded-xl hover:bg-[#F5F2F6] font-semibold text-[#77717D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-[#46362F] hover:bg-[#342721] rounded-xl font-bold shadow-xs transition-colors"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal with real parser and preview */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportItems={(items) => {
          items.forEach(addInventoryItem);
          setIsImportModalOpen(false);
        }}
        suppliers={suppliers}
      />
    </div>
  );
};
