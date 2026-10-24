import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { InventoryItem, Supplier } from '../../types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>[]) => void;
  suppliers: Supplier[];
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportItems,
  suppliers
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseAndImport = () => {
    try {
      setParseError(null);
      const lines = csvContent.trim().split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        setParseError('Please paste your CSV inventory records before importing.');
        return;
      }

      const defaultSupplierId = suppliers[0]?.id || 'SUP-001';
      const defaultSupplier = suppliers.find(s => s.id === defaultSupplierId) || suppliers[0];
      const itemsToImport: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>[] = [];
      const today = new Date().toISOString().split('T')[0];

      // Check if first row is header
      const firstRowParts = lines[0].split(',').map(p => p.trim().toLowerCase());
      const startIndex = firstRowParts[0] === 'sku' ? 1 : 0;

      if (lines.length <= startIndex) {
        setParseError('CSV must include at least one data row.');
        return;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 8) {
          throw new Error(`Row ${i + 1} has insufficient columns (expected at least 8: SKU, Name, Category, Stock, Reserved, DailySales, LeadDays, SafetyStock, ReorderPoint).`);
        }

        const [sku, name, category, stock, reserved, dailySales, leadDays, safetyStock, reorderPoint, unitPrice] = parts;
        const dailyUnits = Math.max(1, parseInt(dailySales, 10) || 1);

        itemsToImport.push({
          sku: sku.toUpperCase(),
          name,
          category: category || 'General',
          currentStock: parseInt(stock, 10) || 0,
          reservedStock: parseInt(reserved, 10) || 0,
          averageDailySales: dailyUnits,
          salesHistory: [
            { date: today, units: dailyUnits }
          ],
          leadTimeDays: Math.max(1, parseInt(leadDays, 10) || 1),
          safetyStock: parseInt(safetyStock, 10) || 0,
          reorderThreshold: parseInt(reorderPoint, 10) || 20,
          supplierId: defaultSupplierId,
          unitPrice: unitPrice ? Number(unitPrice) : (defaultSupplier?.currentUnitPrice || 100),
          sourceRecordId: `CSV-IMP-${Date.now()}-${i}`,
        });
      }

      onImportItems(itemsToImport);
      setCsvContent('');
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse CSV format.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#E7E0D8] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#E7E0D8] bg-[#F8F6F2]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#46362F] text-[#D9C6A5] flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-medium text-[#46362F]">
                Import Inventory CSV
              </h3>
              <p className="text-[11px] text-[#6B625B]">
                Paste comma-separated retail inventory records
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

        <div className="p-5 space-y-4 text-xs">
          <p className="text-[#6B625B] leading-relaxed">
            Columns: <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">SKU, Name, Category, Stock, Reserved, DailySales, LeadDays, SafetyStock, ReorderPoint, UnitPrice</code>
          </p>

          {parseError && (
            <div className="p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg text-[#B42335] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          <textarea
            rows={7}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder={`SKU,Name,Category,Stock,Reserved,DailySales,LeadDays,SafetyStock,ReorderPoint,UnitPrice`}
            className="w-full p-3 font-mono text-[11px] bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl text-[#46362F] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#46362F]"
          />

          <div className="pt-3 border-t border-[#E7E0D8] flex items-center justify-between">
            <span className="text-[10px] text-[#6B625B]">
              Deterministic formulas will ingest all rows immediately.
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
                type="button"
                onClick={handleParseAndImport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-2xs flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#D9C6A5]" />
                <span>Import Rows</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
