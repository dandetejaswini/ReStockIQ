import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  Clock, 
  User, 
  X, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuditEvent } from '../types';
import { formatDateTime, formatDate } from '../utils/formatters';

export const AuditPage: React.FC = () => {
  const { auditEvents } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredEvents = auditEvents.filter(event => {
    const matchesSearch = 
      event.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.actor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === 'ALL' || event.entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCsv = () => {
    const headers = ['EventID', 'Timestamp', 'Actor', 'Action', 'EntityType', 'EntityID', 'PreviousState', 'NewState', 'Reason', 'EvidenceIDs', 'ExecutionMode'];
    const rows = filteredEvents.map(e => [
      e.id,
      e.timestamp,
      `"${e.actor}"`,
      e.action,
      e.entityType,
      e.entityId,
      `"${e.previousState.replace(/"/g, '""')}"`,
      `"${e.newState.replace(/"/g, '""')}"`,
      `"${e.reason.replace(/"/g, '""')}"`,
      `"${e.evidenceIds.join(';')}"`,
      e.executionMode
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ReStockIQ_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Audit Trail & Compliance
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
              Append-Only Ledger
            </span>
          </div>
          <p className="text-xs text-[#716A72] mt-0.5">
            Cryptographic and procedural traceability of all calculations, rule triggers, proposals, and human approvals.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#261E27] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-[#6F4E37]" />
          <span>Export Audit Log (CSV)</span>
        </button>
      </div>

      <div className="p-3.5 bg-white border border-[#E8E3E9] rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77717D]" />
          <input
            type="text"
            placeholder="Search by Event ID, Action, Entity, or Actor..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#29232D]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D]"
          >
            <option value="ALL">All Entity Types</option>
            <option value="INVENTORY">Inventory</option>
            <option value="REORDER_REQUEST">Purchase Requests</option>
            <option value="APPROVAL">Approvals</option>
            <option value="ORDER">Orders</option>
            <option value="TEST_RUN">Test Runs</option>
          </select>

          <span className="text-xs text-[#77717D]">
            Total Events: <strong>{filteredEvents.length}</strong>
          </span>
        </div>
      </div>

      <div className="bg-white border border-[#E8E3E9] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F5F2F6] border-b border-[#E8E3E9] text-[#77717D] font-semibold">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity Type</th>
                <th className="py-3 px-3">Target ID</th>
                <th className="py-3 px-3">State Transition</th>
                <th className="py-3 px-4">Reason & Justification</th>
                <th className="py-3 px-3 text-center">Execution Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3E9]">
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-[#77717D]">
                    {auditEvents.length === 0 ? 'No audit events recorded yet.' : 'No audit events match your search.'}
                  </td>
                </tr>
              ) : (
                paginatedEvents.map(event => (
                  <tr 
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="hover:bg-[#F5F2F6] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#29232D]">
                      {event.id}
                    </td>
                    <td className="py-3.5 px-3 text-[#77717D]">
                      {formatDateTime(event.timestamp)}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[#29232D]">
                      {event.actor}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-[#46362F]">
                      {event.action}
                    </td>
                    <td className="py-3.5 px-3 text-[#77717D]">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#E5E4E2]/50 font-bold text-[#29232D]">
                        {event.entityType}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#29232D]">
                      {event.entityId}
                    </td>
                    <td className="py-3.5 px-3 text-[#77717D]">
                      <span className="line-through mr-1 opacity-75">{event.previousState}</span>
                      <span className="text-[#36765A] font-bold">→ {event.newState}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#77717D] max-w-xs truncate">
                      {event.reason}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="text-[10px] font-bold text-[#36765A] bg-[#EBF7F0] px-2 py-0.5 rounded border border-[#BCE8D3]">
                        {event.executionMode}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3.5 border-t border-[#E8E3E9] text-xs text-[#77717D] bg-white">
          <span>
            Page {currentPage} of {totalPages} ({filteredEvents.length} total events)
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

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md h-full bg-white shadow-2xl border-l border-[#E8E3E9] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#E8E3E9] bg-[#F5F2F6]">
              <div>
                <h3 className="text-sm font-bold text-[#46362F]">Audit Event Inspector</h3>
                <span className="text-[10px] font-mono text-[#77717D]">{selectedEvent.id}</span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 text-[#77717D] hover:text-[#29232D]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs flex-1">
              <div className="p-3.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#77717D]">Action:</span>
                  <span className="font-extrabold text-[#46362F]">{selectedEvent.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#77717D]">Actor:</span>
                  <span className="font-semibold text-[#29232D]">{selectedEvent.actor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#77717D]">Timestamp:</span>
                  <span className="font-medium text-[#29232D]">{formatDateTime(selectedEvent.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#77717D]">Entity:</span>
                  <span className="font-mono text-[#29232D]">{selectedEvent.entityType} ({selectedEvent.entityId})</span>
                </div>
              </div>

              <div>
                <p className="font-bold text-[#46362F] mb-1">State Transition</p>
                <div className="p-3 border border-[#E8E3E9] rounded-xl space-y-1">
                  <p className="text-[#77717D]">
                    <strong>Previous:</strong> {selectedEvent.previousState}
                  </p>
                  <p className="text-[#36765A] font-bold">
                    <strong>New:</strong> {selectedEvent.newState}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-bold text-[#46362F] mb-1">Reason & Context</p>
                <div className="p-3 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-[#29232D] leading-relaxed">
                  {selectedEvent.reason}
                </div>
              </div>

              <div>
                <p className="font-bold text-[#46362F] mb-1">Evidence Keys</p>
                <div className="p-3 bg-[#29232D] text-emerald-400 font-mono text-[11px] rounded-xl">
                  {selectedEvent.evidenceIds.join(' · ')}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-[#E8E3E9] bg-[#F5F2F6] flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#46362F] hover:bg-[#4E1546] rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
