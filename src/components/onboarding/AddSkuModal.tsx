import React, { useState } from 'react';
import { X, Package } from 'lucide-react';
import { InventoryItem, Supplier } from '../../types';

interface AddSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSku: (skuData: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>) => void;
  suppliers: Supplier[];
}

export const AddSkuModal: React.FC<AddSkuModalProps> = ({
  isOpen,
  onClose,
  onAddSku,
  suppliers
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Packaging');
  const [currentStock, setCurrentStock] = useState<number>(20);
  const [reservedStock, setReservedStock] = useState<number>(0);
  const [averageDailySales, setAverageDailySales] = useState<number>(3);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [safetyStock, setSafetyStock] = useState<number>(10);
  const [reorderThreshold, setReorderThreshold] = useState<number>(25);
  const [unitPrice, setUnitPrice] = useState<number>(100);
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || 'SUP-001');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;

    const selectedSup = suppliers.find(s => s.id === supplierId);
    const resolvedUnitPrice = unitPrice > 0 ? unitPrice : (selectedSup?.currentUnitPrice || 50);
    const today = new Date().toISOString().split('T')[0];

    onAddSku({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      currentStock,
      reservedStock,
      reorderThreshold,
      averageDailySales,
      salesHistory: [
        { date: today, units: averageDailySales },
      ],
      leadTimeDays,
      safetyStock,
      supplierId: supplierId.trim() || 'SUP-001',
      unitPrice: resolvedUnitPrice,
      sourceRecordId: `REC-${Date.now().toString().slice(-6)}`,
    });

    setSku('');
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E7E0D8] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#E7E0D8] bg-[#F8F6F2]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#46362F] text-[#D9C6A5] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-medium text-[#46362F]">
                Add Catalog SKU
              </h3>
              <p className="text-[11px] text-[#6B625B]">
                Configure inventory stock, sales velocity, and supplier lead-time
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-[#6B625B] hover:text-[#46362F] rounded-lg hover:bg-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">SKU Code *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SKU-101"
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
              >
                <option value="Raw Materials">Raw Materials</option>
                <option value="Packaging">Packaging</option>
                <option value="Finished Goods">Finished Goods</option>
                <option value="Dry Goods">Dry Goods</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#46362F] mb-1">Product Description *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name"
              className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Current Stock</label>
              <input
                type="number"
                min="0"
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Reserved Stock</label>
              <input
                type="number"
                min="0"
                required
                value={reservedStock}
                onChange={(e) => setReservedStock(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Daily Sales (Run-rate)</label>
              <input
                type="number"
                min="1"
                required
                value={averageDailySales}
                onChange={(e) => setAverageDailySales(parseInt(e.target.value, 10) || 1)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(parseInt(e.target.value, 10) || 1)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Safety Buffer</label>
              <input
                type="number"
                min="0"
                required
                value={safetyStock}
                onChange={(e) => setSafetyStock(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                required
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Assigned Supplier</label>
              {suppliers.length > 0 ? (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id}) — Pack: {s.packSize}u
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  placeholder="SUP-001"
                  className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
                />
              )}
            </div>
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Unit Price (₹ INR)</label>
              <input
                type="number"
                min="1"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                className="w-full p-2 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F] font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E7E0D8] flex items-center justify-between">
            <span className="text-[10px] text-[#6B625B]">
              Deterministic replenishment calculations will activate automatically.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-[#6B625B] hover:text-[#46362F] bg-white border border-[#E7E0D8] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-2xs"
              >
                Save SKU
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
