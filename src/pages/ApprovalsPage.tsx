import React, { useState } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp, 
  X, 
  MessageSquare,
  Sparkles,
  Layers,
  Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ReorderRequest, ReorderRequestStatus } from '../types';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { formatCurrencyINR, formatDate, formatDateTime } from '../utils/formatters';

export const ApprovalsPage: React.FC = () => {
  const { requests, updateRequestStatus } = useApp();

  const [activeTab, setActiveTab] = useState<'Pending' | 'Budget Review' | 'Approved' | 'Rejected' | 'ALL'>('Pending');
  const [selectedRequest, setSelectedRequest] = useState<ReorderRequest | null>(null);

  // Modals for actions
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'Approve' | 'Reject' | 'Needs Budget Review' | 'Returned For Changes';
    request: ReorderRequest | null;
  }>({
    isOpen: false,
    type: 'Approve',
    request: null,
  });

  const [actionComment, setActionComment] = useState('');

  // Summary Metrics
  const pendingCount = requests.filter(r => r.status === 'Pending Approval').length;
  const approvedCount = requests.filter(r => r.status === 'Approved' || r.status === 'Verified').length;
  const budgetReviewCount = requests.filter(r => r.status === 'Needs Budget Review').length;
  const rejectedCount = requests.filter(r => r.status === 'Rejected').length;
  const pendingValue = requests
    .filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review')
    .reduce((sum, r) => sum + r.totalCost, 0);

  // Filtered requests based on tabs
  const filteredRequests = requests.filter(r => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'Pending') return r.status === 'Pending Approval';
    if (activeTab === 'Budget Review') return r.status === 'Needs Budget Review';
    if (activeTab === 'Approved') return r.status === 'Approved' || r.status === 'Verified';
    if (activeTab === 'Rejected') return r.status === 'Rejected';
    return true;
  });

  const handleOpenActionModal = (
    request: ReorderRequest, 
    type: 'Approve' | 'Reject' | 'Needs Budget Review' | 'Returned For Changes'
  ) => {
    setActionComment('');
    setActionModal({ isOpen: true, type, request });
  };

  const handleExecuteAction = () => {
    if (!actionModal.request) return;

    let targetStatus: ReorderRequestStatus;
    if (actionModal.type === 'Approve') targetStatus = 'Approved';
    else if (actionModal.type === 'Reject') targetStatus = 'Rejected';
    else if (actionModal.type === 'Needs Budget Review') targetStatus = 'Needs Budget Review';
    else targetStatus = 'Needs Review';

    updateRequestStatus(
      actionModal.request.id,
      targetStatus,
      actionComment || `Manager decision: ${actionModal.type}`
    );

    setActionModal({ isOpen: false, type: 'Approve', request: null });
    if (selectedRequest?.id === actionModal.request.id) {
      setSelectedRequest(prev => prev ? { ...prev, status: targetStatus } : null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-[#E7E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#46362F]">
              Approval Center
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2.5 py-0.5 rounded-full">
              Human-in-the-Loop Governance
            </span>
          </div>
          <p className="text-xs text-[#6B625B] mt-1">
            "Every reorder has a reason. Every decision has proof." — Verify calculations and supplier pricing before committing purchase capital.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E7E0D8] rounded-xl self-start md:self-auto overflow-x-auto shadow-2xs">
          <button
            onClick={() => setActiveTab('Pending')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'Pending' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('Budget Review')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'Budget Review' ? 'bg-[#B7791F] text-white font-bold shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
            }`}
          >
            Budget Review ({budgetReviewCount})
          </button>
          <button
            onClick={() => setActiveTab('Approved')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'Approved' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab('Rejected')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'Rejected' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'ALL' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
            }`}
          >
            All ({requests.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <StatCard
          label="Pending Sign-off"
          value={pendingCount}
          icon={Clock}
          description="In review queue"
          trend="Action Needed"
          trendType={pendingCount > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Budget Reviews"
          value={budgetReviewCount}
          icon={TrendingUp}
          description="Price jump ≥ 20%"
          trend="Escalated"
          trendType={budgetReviewCount > 0 ? 'marigold' : 'neutral'}
        />
        <StatCard
          label="Authorized POs"
          value={approvedCount}
          icon={CheckCircle2}
          description="Signed for dispatch"
          trend="Approved"
          trendType="positive"
        />
        <StatCard
          label="Rejected Orders"
          value={rejectedCount}
          icon={XCircle}
          description="Suppressed/declined"
          trend="Declined"
          trendType="neutral"
        />
        <StatCard
          label="Pending Capital"
          value={formatCurrencyINR(pendingValue)}
          icon={FileText}
          description="Awaiting sign-off"
          trend="Committed"
          trendType="neutral"
        />
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-[#E7E0D8] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[#6B625B] font-semibold">
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-3">Item / SKU</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-right">Proposed Units</th>
                <th className="py-3 px-3 text-right">Case Count</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">Total Cost</th>
                <th className="py-3 px-3 text-center">Budget Status</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0D8]">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#6B625B]">
                    {requests.length === 0 ? 'No reorder requests yet.' : 'No purchase requests match this filter.'}
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const isPending = req.status === 'Pending Approval' || req.status === 'Needs Budget Review';

                  return (
                    <tr key={req.id} className="hover:bg-[#F8F6F2] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold font-mono text-[#46362F]">{req.id}</span>
                        <span className="block text-[10px] text-[#6B625B]">{formatDate(req.createdAt)}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-[#46362F]">{req.sku}</span>
                        <span className="block text-[11px] text-[#6B625B] line-clamp-1">{req.productName}</span>
                      </td>
                      <td className="py-3.5 px-3 text-[#6B625B] font-medium">{req.supplierName}</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-[#46362F]">
                        {req.proposedQuantity} units
                      </td>
                      <td className="py-3.5 px-3 text-right text-[#6B625B]">
                        {req.caseCount} cases
                      </td>
                      <td className="py-3.5 px-3 text-right text-[#6B625B]">
                        {formatCurrencyINR(req.unitPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-[#46362F]">
                        {formatCurrencyINR(req.totalCost)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {req.budgetStatus === 'Price Increase Review' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8A5F00] bg-[#FFF8E6] px-2 py-0.5 rounded border border-[#EAAA00]/40">
                            +25% JUMP
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#327456] font-semibold">Standard</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="px-2.5 py-1 text-xs font-bold text-[#46362F] bg-[#E8E2F0] hover:bg-[#46362F] hover:text-white rounded-lg transition-colors"
                          >
                            Inspect
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleOpenActionModal(req, 'Approve')}
                                className="px-2.5 py-1 text-xs font-bold text-[#327456] bg-[#EBF7F0] hover:bg-[#D5EFE2] rounded-lg border border-[#BCE8D3] transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenActionModal(req, 'Reject')}
                                className="px-2.5 py-1 text-xs font-bold text-[#B42335] bg-[#FDF0F2] hover:bg-[#F9D6DC] rounded-lg border border-[#F8C8CE] transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl border-l border-[#E7E0D8] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#E7E0D8] bg-[#F8F6F2]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#46362F] font-mono">{selectedRequest.id}</span>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <p className="text-xs text-[#6B625B] mt-0.5">{selectedRequest.sku}: {selectedRequest.productName}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-1 text-[#6B625B] hover:text-[#46362F]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1 text-xs">
              <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#6B625B]">Requested Replenishment:</span>
                  <span className="text-base font-extrabold text-[#46362F]">
                    {selectedRequest.proposedQuantity} units ({selectedRequest.caseCount} cases)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B625B]">Supplier:</span>
                  <span className="font-semibold text-[#46362F]">{selectedRequest.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B625B]">Unit Price:</span>
                  <span className="font-semibold text-[#46362F]">{formatCurrencyINR(selectedRequest.unitPrice)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E7E0D8] pt-2">
                  <span className="font-bold text-[#46362F]">Total Estimated Spend:</span>
                  <span className="font-extrabold text-base text-[#46362F]">{formatCurrencyINR(selectedRequest.totalCost)}</span>
                </div>
              </div>

              <div className="p-3.5 bg-white border border-[#E7E0D8] rounded-xl space-y-1">
                <p className="font-bold text-[#46362F]">Justification & Reasoning</p>
                <p className="text-[#6B625B] leading-relaxed">{selectedRequest.reason}</p>
                {selectedRequest.reviewComment && (
                  <p className="text-[#327456] font-medium pt-1 border-t border-[#E7E0D8] mt-1">
                    <strong>Review Note:</strong> {selectedRequest.reviewComment}
                  </p>
                )}
                {selectedRequest.rejectionReason && (
                  <p className="text-[#B42335] font-medium pt-1 border-t border-[#E7E0D8] mt-1">
                    <strong>Rejection Cause:</strong> {selectedRequest.rejectionReason}
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-1 font-mono text-[11px]">
                <p className="font-bold text-[#46362F] font-sans text-xs">Cryptographic Invariants</p>
                <p className="text-[#6B625B]">Idempotency Key: <span className="text-[#46362F] font-bold">{selectedRequest.idempotencyKey}</span></p>
                <p className="text-[#6B625B]">Evidence Sources: {selectedRequest.sourceEvidenceIds.join(', ')}</p>
                <p className="text-[#6B625B]">Created: {formatDateTime(selectedRequest.createdAt)}</p>
              </div>

              {(selectedRequest.status === 'Pending Approval' || selectedRequest.status === 'Needs Budget Review') && (
                <div className="space-y-2 pt-2 border-t border-[#E7E0D8]">
                  <p className="font-bold text-[#46362F]">Human Authorization Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenActionModal(selectedRequest, 'Approve')}
                      className="py-2.5 px-3 text-xs font-bold text-white bg-[#327456] hover:bg-[#285d45] rounded-xl shadow-xs"
                    >
                      Authorize & Approve
                    </button>
                    <button
                      onClick={() => handleOpenActionModal(selectedRequest, 'Reject')}
                      className="py-2.5 px-3 text-xs font-bold text-[#B42335] bg-[#FDF0F2] hover:bg-[#F9D6DC] border border-[#F8C8CE] rounded-xl"
                    >
                      Decline Proposal
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenActionModal(selectedRequest, 'Needs Budget Review')}
                      className="py-2 px-3 text-xs font-bold text-[#8A5F00] bg-[#FFF8E6] hover:bg-[#FFF1CC] border border-[#EAAA00]/40 rounded-xl"
                    >
                      Route to Budget Review
                    </button>
                    <button
                      onClick={() => handleOpenActionModal(selectedRequest, 'Returned For Changes')}
                      className="py-2 px-3 text-xs font-medium text-[#6B625B] bg-white hover:bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl"
                    >
                      Return for Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={actionModal.isOpen}
        title={`${actionModal.type} Purchase Request ${actionModal.request?.id}`}
        description={`Please confirm your decision for ${actionModal.request?.sku} (${actionModal.request?.proposedQuantity} units for ${formatCurrencyINR(actionModal.request?.totalCost || 0)}). This action is permanently recorded in the audit trail.`}
        confirmLabel={`Confirm ${actionModal.type}`}
        variant={actionModal.type === 'Reject' ? 'danger' : actionModal.type === 'Approve' ? 'primary' : 'warning'}
        onConfirm={handleExecuteAction}
        onClose={() => setActionModal({ isOpen: false, type: 'Approve', request: null })}
      >
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#46362F]">
            Decision Justification Note:
          </label>
          <textarea
            rows={2}
            placeholder="Add an explanation for this governance sign-off..."
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            className="w-full p-2.5 text-xs bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F]"
          />
        </div>
      </ConfirmationModal>
    </div>
  );
};
