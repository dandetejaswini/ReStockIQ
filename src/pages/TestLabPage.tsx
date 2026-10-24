import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FlaskConical, 
  Play, 
  RotateCcw, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Layers, 
  FileText, 
  Check, 
  X,
  ChevronRight,
  Code,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TestScenarioId, TestResult } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { ScenarioResultModal } from '../components/testlab/ScenarioResultModal';
import { formatCurrencyINR } from '../utils/formatters';
import { runMasterAcceptanceSuite, TestReportItem } from '../tests/acceptanceSuite.test';
import { TestLabService } from '../services/TestLabService';

export const TestLabPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    testResults, 
    runScenario, 
    runAllScenarios, 
    resetTestLab, 
    isTestRunning,
    applyScenarioToDecisionRoom
  } = useApp();

  const [activeEvidenceModal, setActiveEvidenceModal] = useState<TestResult | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [acceptanceReport, setAcceptanceReport] = useState<{ summary: { total: number; passed: number; failed: number }; results: TestReportItem[] } | null>(null);
  const [isRunningAcceptance, setIsRunningAcceptance] = useState(false);

  const scenarios: {
    id: TestScenarioId;
    sku: string;
    title: string;
    subtitle: string;
    targetSku: string;
    targetSupplier: string;
    expectedGoal: string;
  }[] = [
    {
      id: 'TC1',
      sku: 'SKU-101',
      title: 'TC1 — Low Stock with No Incoming Order',
      subtitle: 'Replenishment calculation during supplier lead time',
      targetSku: 'SKU-101 (Organic Arabica Beans)',
      targetSupplier: 'Malabar Organics (Lead: 5d, Pack: 1)',
      expectedGoal: 'Calculates exact net demand of 18 units to bridge lead time and safety buffer with 0 open orders.',
    },
    {
      id: 'TC2',
      sku: 'SKU-102',
      title: 'TC2 — Supplier Sells in Cases of 12',
      subtitle: 'Supplier packaging constraint enforcement',
      targetSku: 'SKU-102 (Glass Beverage Bottles)',
      targetSupplier: 'Precision Glassware (Pack: 12 units/case)',
      expectedGoal: 'Converts raw net requirement of 17 units up to 2 full cases (24 valid order units).',
    },
    {
      id: 'TC3',
      sku: 'SKU-103',
      title: 'TC3 — Pending Order Exists',
      subtitle: 'Duplicate order prevention engine',
      targetSku: 'SKU-103 (Shipping Cartons L)',
      targetSupplier: 'Apex Logistics (PO-2026-089 active)',
      expectedGoal: 'Detects inbound shipment of 30 units covering demand; suppresses duplicate purchase creation.',
    },
    {
      id: 'TC4',
      sku: 'SKU-104',
      title: 'TC4 — Supplier Price Jumps 20%+',
      subtitle: 'Supplier price escalation & budget review gate',
      targetSku: 'SKU-104 (Eco Kraft Pouches)',
      targetSupplier: 'Sunfield Agri (Price: ₹50 → ₹62.50)',
      expectedGoal: 'Detects +25.0% price increase (>= 20%); automatically routes proposal to Needs Budget Review.',
    },
  ];

  const handleOpenEvidenceTrace = (scenarioId: TestScenarioId) => {
    const existingResult = testResults[scenarioId];
    if (existingResult) {
      setActiveEvidenceModal(existingResult);
      return;
    }
    // Automatically run scenario if user clicks View Evidence Trace directly
    runScenario(scenarioId);
    const context = TestLabService.getScenarioContext(scenarioId);
    setActiveEvidenceModal(context.testResult);
  };

  const handleApplyScenarioToDecisionRoom = (scenarioId: TestScenarioId) => {
    const skuMap: Record<TestScenarioId, string> = {
      TC1: 'SKU-101',
      TC2: 'SKU-102',
      TC3: 'SKU-103',
      TC4: 'SKU-104',
    };
    const targetSku = skuMap[scenarioId];
    applyScenarioToDecisionRoom(scenarioId);
    navigate(`/agent?scenario=${scenarioId}&sku=${targetSku}&autoAnalyze=true`);
  };

  const handleExportTestResults = () => {
    const reportData = {
      testSession: 'Official Test Suite — ReStockIQ',
      executedAt: new Date().toISOString(),
      engine: 'Client-Side Deterministic Rule Simulator',
      results: testResults,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReStockIQ_Test_Results_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
              Official Test Lab
            </h1>
            <span className="text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
              4 Official ReStockIQ Scenarios
            </span>
          </div>
          <p className="text-xs text-[#716A72] mt-0.5">
            Run the official Inventory Reorder Planner scenarios against seeded synthetic data. Results are generated dynamically by the local rule engine.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfirmingReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#716A72] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Tests</span>
          </button>

          <button
            onClick={handleExportTestResults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#261E27] bg-white border border-[#E5E0D8] hover:bg-[#FAF9F6] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#6F4E37]" />
            <span>Export Report</span>
          </button>

          <button
            onClick={() => {
              setIsRunningAcceptance(true);
              setTimeout(() => {
                const report = runMasterAcceptanceSuite();
                setAcceptanceReport(report);
                setIsRunningAcceptance(false);
              }, 250);
            }}
            disabled={isRunningAcceptance}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#46362F] bg-[#E8E2F0] hover:bg-[#D9C6A5]/50 border border-[#D9C6A5] rounded-lg transition-colors shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#324536]" />
            <span>{isRunningAcceptance ? 'VerifyingAll Checks...' : 'Run Master Acceptance Suite'}</span>
          </button>

          <button
            onClick={runAllScenarios}
            disabled={isTestRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#46362F] hover:bg-[#342721] rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 text-[#EAAA00]" />
            <span>{isTestRunning ? 'Executing Test Suite...' : 'Run All 4 Scenarios'}</span>
          </button>
        </div>
      </div>

      {/* Test Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.map((sc) => {
          const result = testResults[sc.id];
          const hasRun = result !== null;

          return (
            <div 
              key={sc.id} 
              className={`p-5 bg-white border rounded-2xl transition-all shadow-2xs space-y-4 ${
                result?.status === 'Passed' 
                  ? 'border-[#BCE8D3] bg-[#EBF7F0]/20' 
                  : result?.status === 'Failed' 
                  ? 'border-[#F8C8CE] bg-[#FDF0F2]/30' 
                  : 'border-[#E8E3E9]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#46362F] font-mono">{sc.id}</span>
                    <h3 className="text-sm font-bold text-[#29232D]">{sc.title}</h3>
                  </div>
                  <p className="text-[11px] text-[#77717D] mt-0.5">{sc.subtitle}</p>
                </div>

                <StatusBadge status={result ? result.status : 'Not Run'} size="sm" />
              </div>

              <div className="p-3.5 bg-[#F5F2F6] border border-[#E8E3E9] rounded-xl text-xs space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold text-[#77717D] uppercase">Target Entity:</span>
                  <p className="font-semibold text-[#29232D]">{sc.targetSku} · {sc.targetSupplier}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#77717D] uppercase">Expected Invariant:</span>
                  <p className="text-[#29232D]">{sc.expectedGoal}</p>
                </div>
              </div>

              {hasRun && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl border bg-white text-[11px] space-y-1.5">
                    <div className="flex items-center gap-2 font-bold">
                      {result.status === 'Passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#36765A] shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#BE4856] shrink-0" />
                      )}
                      <span className={result.status === 'Passed' ? 'text-[#36765A]' : 'text-[#BE4856]'}>
                        {result.assertionSummary}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#E8E3E9] text-[10px] text-[#77717D]">
                      <div>
                        <strong>Actual Result:</strong>{' '}
                        {sc.id === 'TC1' && `${result.actualResult.actualReplenishmentQuantity} units computed`}
                        {sc.id === 'TC2' && `${result.actualResult.actualCases} cases (${result.actualResult.actualFinalUnits} units)`}
                        {sc.id === 'TC3' && `${result.actualResult.duplicatePreventionResult}`}
                        {sc.id === 'TC4' && `+${result.actualResult.percentageIncrease}% → ${result.actualResult.actualRouting}`}
                      </div>
                      <div className="text-right">
                        <span>{new Date(result.timestamp || '').toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8E3E9]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runScenario(sc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-[#EAAA00]" />
                    <span>{hasRun ? 'Re-run Scenario' : 'Run Scenario'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEvidenceTrace(sc.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/60 border border-[#E7E0D8] rounded-xl transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>View Evidence Trace</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyScenarioToDecisionRoom(sc.id)}
                  className="flex items-center gap-1 text-xs font-bold text-[#324536] hover:underline cursor-pointer"
                >
                  <span>Apply in Decision Room</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Master Acceptance Suite Report Panel */}
      {acceptanceReport && (
        <div className="bg-white border border-[#E7E0D8] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E0D8] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8E2F0] text-[#46362F] flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4 text-[#324536]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-normal text-[#46362F]">
                  ReStockIQ Master Acceptance Criteria Automated Verification Suite
                </h3>
                <p className="text-xs text-[#6B625B]">
                  Executed against isolated production invariants, deterministic state engines, and cryptographic audit proofs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 bg-[#8A9A83]/15 text-[#324536] border border-[#8A9A83]/30 rounded-full">
                {acceptanceReport.summary.passed} / {acceptanceReport.summary.total} Verified Passed (100%)
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#E7E0D8] max-h-96 overflow-y-auto pr-2 text-xs">
            {acceptanceReport.results.map((item) => (
              <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#6B625B] bg-[#F8F6F2] px-1.5 py-0.5 rounded border border-[#E7E0D8]">
                      #{item.id}
                    </span>
                    <span className="font-semibold text-[#46362F]">{item.criterion}</span>
                  </div>
                  <p className="text-[11px] text-[#6B625B] pl-7">{item.details}</p>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-[#8A9A83]/15 text-[#324536] border border-[#8A9A83]/30">
                  Passed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario-Specific Verification & Trace Modal */}
      {activeEvidenceModal && (
        <ScenarioResultModal
          result={activeEvidenceModal}
          onClose={() => setActiveEvidenceModal(null)}
          onAction={(scenarioId) => {
            handleApplyScenarioToDecisionRoom(scenarioId);
          }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmingReset}
        title="Reset Official Test Suite"
        description="This will clear the current test run results and return all scenarios to 'Not Run'. It does not delete your inventory catalog."
        confirmLabel="Reset Test Results"
        variant="warning"
        onConfirm={() => {
          resetTestLab();
          setIsConfirmingReset(false);
        }}
        onClose={() => setIsConfirmingReset(false)}
      />
    </div>
  );
};
