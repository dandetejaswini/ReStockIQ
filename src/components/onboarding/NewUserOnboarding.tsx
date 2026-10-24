import React from 'react';
import { 
  Package, 
  Upload, 
  Plus, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Boxes, 
  ArrowRight,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User, Supplier } from '../../types';

interface NewUserOnboardingProps {
  user: User | null;
  onOpenAddSku: () => void;
  onOpenCsvImport: () => void;
  onConnectSupabase: () => void;
  suppliers: Supplier[];
}

export const NewUserOnboarding: React.FC<NewUserOnboardingProps> = ({
  user,
  onOpenAddSku,
  onOpenCsvImport,
  onConnectSupabase,
  suppliers
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 font-sans">
      
      {/* Welcome Hero Banner */}
      <div className="bg-white border border-[#E7E0D8] rounded-2xl p-6 sm:p-10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8E2F0] text-[#46362F] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#8A9A83]" />
              <span>Workspace Ready · Predict Shortages. Prevent Stockouts.</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl font-normal tracking-tight text-[#46362F]">
              Welcome, {user?.name || 'Store Procurement Lead'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6B625B] max-w-2xl leading-relaxed">
              ReStockIQ eliminates inventory stockouts during supplier lead times by reconciling usable stock, inbound deliveries, vendor packaging constraints, and price shifts.
            </p>
          </div>
        </div>

        {/* Core Principles */}
        <div className="pt-4 border-t border-[#E7E0D8] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-semibold text-[#46362F] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#8A9A83]" />
              <span>Every Reorder Has Proof</span>
            </span>
            <p className="text-[11px] text-[#6B625B] leading-relaxed">
              Formulas calculate lead-time consumption and safety buffer down to the exact unit.
            </p>
          </div>

          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-semibold text-[#46362F] flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-[#8A9A83]" />
              <span>Packaging Constraint Enforced</span>
            </span>
            <p className="text-[11px] text-[#6B625B] leading-relaxed">
              Orders round automatically to supplier case pack minimums (e.g. cases of 12).
            </p>
          </div>

          <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] space-y-1">
            <span className="font-semibold text-[#46362F] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#8A9A83]" />
              <span>Governance & Price Gate</span>
            </span>
            <p className="text-[11px] text-[#6B625B] leading-relaxed">
              Wholesale price spikes ≥ 20.0% divert proposals to human budget review.
            </p>
          </div>
        </div>
      </div>

      {/* Clean Empty States Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div className="p-5 bg-white border border-[#E7E0D8] rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B]">Inventory</span>
              <Package className="w-4 h-4 text-[#46362F]" />
            </div>
            <p className="font-bold text-sm text-[#46362F]">No inventory items yet.</p>
            <p className="text-[11px] text-[#6B625B]">Add your first SKU or import a CSV to start tracking stock levels and lead-time demand.</p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onOpenAddSku}
              className="flex-1 py-2 px-3 font-semibold text-white bg-[#46362F] hover:bg-[#382b25] rounded-xl transition-colors text-center"
            >
              Add First SKU
            </button>
            <button
              onClick={onOpenCsvImport}
              className="flex-1 py-2 px-3 font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-xl transition-colors text-center"
            >
              Import CSV
            </button>
          </div>
        </div>

        <div className="p-5 bg-white border border-[#E7E0D8] rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B]">Suppliers</span>
              <Truck className="w-4 h-4 text-[#46362F]" />
            </div>
            <p className="font-bold text-sm text-[#46362F]">
              {suppliers.length === 0 ? 'No suppliers added yet.' : `${suppliers.length} Supplier(s) Registered`}
            </p>
            <p className="text-[11px] text-[#6B625B]">Register vendor lead times, case pack sizes, and contract unit pricing.</p>
          </div>
          <button
            onClick={() => navigate('/suppliers')}
            className="w-full py-2 px-3 font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Add Supplier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 bg-white border border-[#E7E0D8] rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B]">Orders & Approvals</span>
              <Boxes className="w-4 h-4 text-[#46362F]" />
            </div>
            <p className="font-bold text-sm text-[#46362F]">No orders yet. · No reorder requests yet.</p>
            <p className="text-[11px] text-[#6B625B]">No recommendations available yet. Analytics will appear when sufficient data is available.</p>
          </div>
          <button
            onClick={onConnectSupabase}
            className="w-full py-2 px-3 font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-[#8A9A83]" />
            <span>Database & RLS Settings</span>
          </button>
        </div>
      </div>

      {/* Empty State Notice */}
      <div className="p-4 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] text-center text-xs text-[#6B625B]">
        <p>
          No stockout warnings or replenishment calculations are shown because your catalog is currently empty. Add your inventory items and suppliers above to begin live intelligence.
        </p>
      </div>

    </div>
  );
};
