import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare,
  Calculator,
  Compass,
  Plus,
  FlaskConical,
  RotateCcw,
  FileCheck,
  ShieldCheck,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { formatCurrencyINR } from '../utils/formatters';
import { calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';
import { MarkdownMessage } from '../components/common/MarkdownMessage';
import { TestScenarioId, ScenarioAnalysisReport } from '../types';
import { TestLabService } from '../services/TestLabService';
import { AgentService } from '../services/AgentService';
import { BRAND_CONFIG } from '../services/config';

const VALID_SCENARIOS: TestScenarioId[] = ['TC1', 'TC2', 'TC3', 'TC4'];

export const AgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSku = searchParams.get('sku');
  const urlScenarioParam = searchParams.get('scenario');
  const urlScenario: TestScenarioId | null =
    urlScenarioParam && VALID_SCENARIOS.includes(urlScenarioParam as TestScenarioId)
      ? (urlScenarioParam as TestScenarioId)
      : null;
  const autoAnalyze = searchParams.get('autoAnalyze') === 'true';

  const { 
    chatMessages, 
    sendAgentMessage, 
    clearChat, 
    inventory, 
    suppliers, 
    orders, 
    requests,
    selectedSku, 
    setSelectedSku,
    activeScenario,
    setActiveScenario,
    applyScenarioToDecisionRoom,
    testResults,
    createReorderProposal,
    isBackendConfigured
  } = useApp();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isConfirmingProposal, setIsConfirmingProposal] = useState(false);
  const [proposalFeedback, setProposalFeedback] = useState<{ message: string; success: boolean; isBackendConnected?: boolean } | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'decision' | 'evidence'>('decision');
  const [isSending, setIsSending] = useState(false);

  // Scenario Analysis State in Decision Room
  const [scenarioStatus, setScenarioStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
  const [scenarioReport, setScenarioReport] = useState<ScenarioAnalysisReport | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoAnalyzedSkuRef = useRef<string | null>(null);
  const lastAnalyzedScenarioRef = useRef<TestScenarioId | null>(null);

  const effectiveScenarioId: TestScenarioId | null = urlScenario || activeScenario?.scenarioId || null;
  const scenarioContext = effectiveScenarioId
    ? TestLabService.getScenarioContext(effectiveScenarioId)
    : null;

  // Merge scenario fixtures into effective catalog when a scenario is active so TC1-TC4 always work even if workspace inventory is empty
  const effectiveInventory = React.useMemo(() => {
    if (!scenarioContext) return inventory;
    const map = new Map(inventory.map(item => [item.sku, item]));
    for (const scItem of scenarioContext.allScenarioInventory) {
      if (!map.has(scItem.sku)) {
        map.set(scItem.sku, scItem);
      }
    }
    return Array.from(map.values());
  }, [inventory, scenarioContext]);

  const effectiveSuppliers = React.useMemo(() => {
    if (!scenarioContext) return suppliers;
    const map = new Map(suppliers.map(sup => [sup.id, sup]));
    for (const scSup of scenarioContext.allScenarioSuppliers) {
      if (!map.has(scSup.id)) {
        map.set(scSup.id, scSup);
      }
    }
    return Array.from(map.values());
  }, [suppliers, scenarioContext]);

  const effectiveOrders = React.useMemo(() => {
    if (!scenarioContext) return orders;
    const map = new Map(orders.map(ord => [ord.id, ord]));
    for (const scOrd of scenarioContext.allScenarioOrders) {
      if (!map.has(scOrd.id)) {
        map.set(scOrd.id, scOrd);
      }
    }
    return Array.from(map.values());
  }, [orders, scenarioContext]);

  // Execute scenario analysis deterministically
  const executeScenarioAnalysis = useCallback(
    (scenarioId: TestScenarioId, forceRerun = false) => {
      if (scenarioStatus === 'loading' && !forceRerun) return;

      setScenarioStatus('loading');
      setScenarioError(null);

      try {
        const ctx = TestLabService.getScenarioContext(scenarioId);
        if (selectedSku !== ctx.item.sku) {
          setSelectedSku(ctx.item.sku);
        }
        if (activeScenario?.scenarioId !== scenarioId) {
          setActiveScenario(ctx.testResult);
        }

        const analysisTimer = setTimeout(() => {
          try {
            const { report } = AgentService.analyzeScenario(
              scenarioId,
              testResults[scenarioId] || ctx.testResult
            );
            setScenarioReport(report);
            setScenarioStatus('completed');
          } catch (innerErr: any) {
            setScenarioError(
              innerErr?.message || `Failed to analyze scenario ${scenarioId}. Please retry.`
            );
            setScenarioStatus('error');
          }
        }, 180);

        return () => clearTimeout(analysisTimer);
      } catch (err: any) {
        setScenarioError(err?.message || `Unable to initialize scenario ${scenarioId}.`);
        setScenarioStatus('error');
      }
    },
    [scenarioStatus, selectedSku, setSelectedSku, activeScenario, setActiveScenario, testResults]
  );

  // Sync URL scenario -> AppContext & trigger analysis on arrival
  useEffect(() => {
    if (effectiveScenarioId && lastAnalyzedScenarioRef.current !== effectiveScenarioId) {
      lastAnalyzedScenarioRef.current = effectiveScenarioId;
      // Ensure AppContext has the scenario applied and chat message queued if arriving via direct URL
      if (activeScenario?.scenarioId !== effectiveScenarioId) {
        applyScenarioToDecisionRoom(effectiveScenarioId);
      }
      executeScenarioAnalysis(effectiveScenarioId, true);
    }
  }, [effectiveScenarioId, activeScenario, applyScenarioToDecisionRoom, executeScenarioAnalysis]);

  // Sync SKU from URL if provided (when not overridden by scenario arrival)
  useEffect(() => {
    if (urlSku && urlSku !== selectedSku) {
      setSelectedSku(urlSku);
    }
  }, [urlSku, selectedSku, setSelectedSku]);

  // Automatic SKU analysis on arrival when no scenario parameter is present
  useEffect(() => {
    if (!effectiveScenarioId && autoAnalyze && urlSku && autoAnalyzedSkuRef.current !== urlSku) {
      autoAnalyzedSkuRef.current = urlSku;
      const targetItem = effectiveInventory.find(i => i.sku === urlSku);
      if (targetItem) {
        setIsSending(true);
        setMobileTab('chat');
        sendAgentMessage(`Explain the reorder calculation for ${targetItem.sku}`);
        const timer = setTimeout(() => {
          setIsSending(false);
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [effectiveScenarioId, autoAnalyze, urlSku, effectiveInventory, sendAgentMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSending]);

  const handleSwitchScenario = (nextScenarioId: TestScenarioId) => {
    if (scenarioStatus === 'loading') return;
    lastAnalyzedScenarioRef.current = nextScenarioId;
    const ctx = TestLabService.getScenarioContext(nextScenarioId);
    applyScenarioToDecisionRoom(nextScenarioId);
    setSearchParams({ scenario: nextScenarioId, sku: ctx.item.sku, autoAnalyze: 'true' });
    executeScenarioAnalysis(nextScenarioId, true);
  };

  const handleClearScenarioMode = () => {
    lastAnalyzedScenarioRef.current = null;
    setActiveScenario(null);
    setScenarioReport(null);
    setScenarioStatus('idle');
    setScenarioError(null);
    setSearchParams({});
  };

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

  const activeItem =
    effectiveInventory.find(i => i.sku === selectedSku) ||
    scenarioContext?.item ||
    effectiveInventory[0] ||
    null;

  const activeSupplier = activeItem
    ? (effectiveSuppliers.find(s => s.id === activeItem.supplierId) ||
       scenarioContext?.supplier ||
       effectiveSuppliers[0] || {
        ...defaultSupplier,
        id: activeItem.supplierId || 'SUP-DEFAULT',
        leadTimeDays: activeItem.leadTimeDays || 4,
        currentUnitPrice: activeItem.unitPrice || 100,
        previousUnitPrice: activeItem.unitPrice || 100,
      })
    : null;

  const calculation = activeItem && activeSupplier
    ? calculateReorderPlan(activeItem, activeSupplier, effectiveOrders)
    : null;

  const priceCheck = activeSupplier
    ? checkSupplierPriceChange(activeSupplier.currentUnitPrice, activeSupplier.previousUnitPrice)
    : null;

  const skuOrders = activeItem
    ? effectiveOrders.filter(o => o.sku === activeItem.sku && o.status !== 'Received' && o.status !== 'Cancelled')
    : [];

  // Real spend metrics derived from actual requests
  const committedSpend = requests
    .filter(r => r.status === 'Approved' || r.status === 'Verified')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim()) return;
    setIsSending(true);
    sendAgentMessage(text);
    setInputPrompt('');
    setTimeout(() => setIsSending(false), 300);
    setMobileTab('chat');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateProposal = async () => {
    if (!activeItem) return;
    const res = createReorderProposal(activeItem.sku);
    setProposalFeedback({
      ...res,
      isBackendConnected: isBackendConfigured,
    });
    setIsConfirmingProposal(false);
  };

  const suggestedQuestions = activeItem
    ? [
        ...(effectiveScenarioId ? [`Analyze scenario ${effectiveScenarioId}`] : []),
        `Explain the reorder calculation for ${activeItem.sku}`,
        'Which products need replenishment?',
        'Summarize the current low-stock items.',
        'What inventory risks should I review today?',
        'Which incoming orders already cover demand?',
      ]
    : [
        'Analyze scenario TC1',
        'Which products need replenishment?',
        'Summarize the current low-stock items.',
        'What inventory risks should I review today?',
      ];

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Editorial Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[#E7E0D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#46362F]">
              {BRAND_CONFIG.copilotName} · Decision Room
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] rounded-full">
              <Sparkles className="w-3 h-3 text-[#8A9A83]" />
              <span>Deterministic AI Reasoning</span>
            </span>
          </div>
          <p className="text-xs text-[#6B625B] mt-1">
            Meet {BRAND_CONFIG.copilotName} — {BRAND_CONFIG.subtitle} Ask questions about stock levels, replenishment, and scenario evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Quick Scenario Loader Pills (TC1–TC4) */}
          <div className="flex items-center gap-1 bg-white border border-[#E7E0D8] rounded-lg p-1">
            <span className="text-[10px] font-bold text-[#6B625B] px-1.5 flex items-center gap-1">
              <FlaskConical className="w-3 h-3 text-[#8A9A83]" />
              <span>Scenarios:</span>
            </span>
            {VALID_SCENARIOS.map((scId) => (
              <button
                key={scId}
                type="button"
                disabled={scenarioStatus === 'loading'}
                onClick={() => handleSwitchScenario(scId)}
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  effectiveScenarioId === scId
                    ? 'bg-[#46362F] text-[#D9C6A5]'
                    : 'text-[#46362F] hover:bg-[#F8F6F2]'
                }`}
              >
                {scId}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsConfirmingClear(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#6B625B] hover:text-[#B42335] bg-white border border-[#E7E0D8] hover:bg-[#FDF0F2] rounded-lg transition-colors"
            title="Reset conversation dialogue"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset History</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ACTIVE SCENARIO DECISION ROOM ANALYSIS BANNER (TC1–TC4)               */}
      {/* ===================================================================== */}
      {effectiveScenarioId && (
        <div className="bg-white border-2 border-[#46362F]/20 rounded-2xl shadow-sm overflow-hidden">
          {/* Banner Top Bar */}
          <div className="px-5 py-3.5 bg-[#46362F] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 text-xs font-mono font-extrabold bg-[#D9C6A5] text-[#46362F] rounded">
                {effectiveScenarioId}
              </span>
              <div>
                <h2 className="text-sm font-bold text-white leading-tight">
                  {scenarioReport?.title || scenarioContext?.testResult.scenarioTitle || `Scenario ${effectiveScenarioId} Decision Analysis`}
                </h2>
                <p className="text-[11px] text-[#E8E2F0]/80">
                  {scenarioReport?.subtitle || 'Applied from Evidence Trace · Deterministic Decision Room Evaluation'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {scenarioStatus === 'loading' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-[#D9C6A5]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analysing scenario…</span>
                </span>
              ) : scenarioReport ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#8A9A83]/25 text-[#BCE8D3] border border-[#8A9A83]/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#BCE8D3]" />
                  <span>{scenarioReport.status} · {scenarioReport.riskLevel} RISK</span>
                </span>
              ) : null}

              <button
                type="button"
                disabled={scenarioStatus === 'loading'}
                onClick={() => executeScenarioAnalysis(effectiveScenarioId, true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Re-run scenario analysis"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-run Analysis</span>
              </button>

              <button
                type="button"
                onClick={handleClearScenarioMode}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Exit scenario mode"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {scenarioStatus === 'loading' && (
            <div className="p-6 flex items-center justify-center gap-3 text-xs text-[#46362F] bg-[#F8F6F2]">
              <Loader2 className="w-4 h-4 animate-spin text-[#46362F]" />
              <span className="font-semibold">
                Analysing scenario {effectiveScenarioId} against lead-time demand, supplier pack constraints, inbound orders, and price guardrails…
              </span>
            </div>
          )}

          {/* Error State */}
          {scenarioStatus === 'error' && scenarioError && (
            <div className="p-5 bg-[#FDF0F2] border-t border-[#F8C8CE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#B42335]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><strong>Scenario Analysis Failed:</strong> {scenarioError}</span>
              </div>
              <button
                type="button"
                onClick={() => executeScenarioAnalysis(effectiveScenarioId, true)}
                className="px-3 py-1.5 bg-[#B42335] text-white font-semibold rounded-lg hover:bg-[#961b2b] transition-colors self-start sm:self-auto"
              >
                Retry Scenario Analysis
              </button>
            </div>
          )}

          {/* Completed Structured Scenario Analysis Output */}
          {scenarioStatus === 'completed' && scenarioReport && (
            <div className="p-5 bg-[#F8F6F2] space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Key Findings & Formula Breakdown */}
                <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-2.5">
                  <h3 className="font-bold text-[#46362F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-[#8A9A83]" />
                    <span>Key Findings ({scenarioReport.targetSku})</span>
                  </h3>
                  <ul className="space-y-2 text-[11px] text-[#46362F]">
                    {scenarioReport.keyFindings.map((finding, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#327456] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">{finding.label}:</span>{' '}
                          <span className="font-mono font-bold text-[#324536]">{finding.actual}</span>{' '}
                          <span className="text-[10px] text-[#6B625B]">(Expected: {finding.expected})</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. Identified Inventory, Demand & Supply-Chain Risks */}
                <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-2.5">
                  <h3 className="font-bold text-[#46362F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
                    <span>Identified Supply-Chain Risks</span>
                  </h3>
                  <ul className="space-y-1.5 text-[11px] text-[#46362F]">
                    {scenarioReport.identifiedRisks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B7791F] shrink-0 mt-1.5" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3. Recommended Actions & Governance Routing */}
                <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <h3 className="font-bold text-[#46362F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#327456]" />
                      <span>Recommended Actions</span>
                    </h3>
                    <ul className="space-y-1.5 text-[11px] text-[#46362F]">
                      {scenarioReport.recommendedActions.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <ArrowRight className="w-3.5 h-3.5 text-[#46362F] shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-[#E7E0D8] flex items-center justify-between text-[10px]">
                    <span className="text-[#6B625B] font-semibold">Suggested Order:</span>
                    <span className="font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
                      {scenarioReport.recommendedOrderUnits} units ({scenarioReport.recommendedCases} cases) · {formatCurrencyINR(scenarioReport.estimatedTotalCostINR)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evidence & Assumptions Footer Strip */}
              <div className="p-3.5 bg-white border border-[#E7E0D8] rounded-xl grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="font-bold text-[#46362F] uppercase text-[10px] tracking-wider block mb-1">
                    Evidence & Source References Used:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {scenarioReport.evidenceReferences.map((ref) => (
                      <span
                        key={ref.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] text-[10px]"
                      >
                        <strong className="font-mono">{ref.id} ({ref.label}):</strong> {ref.detail}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-[#46362F] uppercase text-[10px] tracking-wider block mb-1">
                    Assumptions & Invariant Constraints:
                  </span>
                  <p className="text-[#6B625B] text-[10.5px] leading-relaxed">
                    {scenarioReport.assumptionsAndConstraints.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile / Tablet Tab Switcher (< lg) */}
      <div className="lg:hidden flex items-center p-1 bg-white border border-[#E7E0D8] rounded-xl shadow-2xs">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === 'chat' ? 'bg-[#46362F] text-white shadow-xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{BRAND_CONFIG.copilotName}</span>
        </button>
        <button
          onClick={() => setMobileTab('decision')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === 'decision' ? 'bg-[#46362F] text-white shadow-xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Replenishment Decision</span>
        </button>
        <button
          onClick={() => setMobileTab('evidence')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            mobileTab === 'evidence' ? 'bg-[#46362F] text-white shadow-xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Signals & Evidence</span>
        </button>
      </div>

      {/* Balanced 3-Column Desktop Grid: 4 cols Left, 5 cols Center, 3 cols Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* ======================================================== */}
        {/* PANEL 1 (LEFT): RESTOCKIQ COPILOT CONVERSATION (4 cols)  */}
        {/* ======================================================== */}
        <div className={`lg:col-span-4 bg-white border border-[#E7E0D8] rounded-2xl flex flex-col h-[820px] overflow-hidden shadow-xs ${
          mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Aligned Header */}
          <div className="h-14 px-4 bg-[#F8F6F2] border-b border-[#E7E0D8] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#46362F] text-[#D9C6A5] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#46362F] leading-tight">{BRAND_CONFIG.copilotName}</h3>
                <p className="text-[10px] text-[#6B625B]">{effectiveInventory.length} SKUs · {effectiveSuppliers.length} Suppliers Grounded</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8A9A83] animate-pulse" />
              <span>Deterministic Active</span>
            </span>
          </div>

          {/* Conversation Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-lg bg-[#E8E2F0] text-[#46362F] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#8A9A83]" />
                  </div>
                )}

                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#46362F] text-white shadow-2xs'
                      : 'bg-[#F8F6F2] text-[#46362F] border border-[#E7E0D8]'
                  }`}
                >
                  <MarkdownMessage content={msg.text} isUser={msg.sender === 'user'} />

                  {/* Suggested Follow-up Action Chips */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E7E0D8] space-y-1.5">
                      <p className="text-[10px] font-bold text-[#6B625B] uppercase tracking-wider">
                        Suggested Follow-ups:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.suggestedActions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(action)}
                            className="px-2 py-1 text-[11px] font-semibold bg-white text-[#46362F] border border-[#E7E0D8] hover:border-[#46362F] hover:bg-[#E8E2F0]/40 rounded-md transition-colors text-left"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className={`block text-[10px] mt-1.5 ${msg.sender === 'user' ? 'text-white/70 text-right' : 'text-[#6B625B]'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 p-3 text-xs text-[#6B625B] bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] w-fit">
                <span className="w-2 h-2 rounded-full bg-[#8A9A83] animate-ping" />
                <span>{BRAND_CONFIG.copilotName} verifying lead-time constraints...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions Strip */}
          <div className="px-3 py-2 bg-[#F8F6F2] border-t border-[#E7E0D8] flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
            <span className="text-[10px] font-bold text-[#6B625B] shrink-0">Prompts:</span>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="shrink-0 px-2.5 py-0.5 text-[11px] font-medium bg-white border border-[#E7E0D8] rounded-md hover:border-[#46362F] hover:bg-[#E8E2F0]/30 text-[#46362F] transition-colors whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>

          {/* User Message Input */}
          <div className="p-3 bg-white border-t border-[#E7E0D8]">
            <div className="relative">
              <textarea
                rows={2}
                placeholder="Ask inventory questions or analyze stockout risks (Enter to send)..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-3 pr-10 py-2 text-xs bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] focus:bg-white resize-none text-[#46362F]"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isSending}
                className="absolute right-2 bottom-3 p-1.5 bg-[#46362F] text-white rounded-lg disabled:opacity-30 hover:bg-[#342721] transition-colors"
                aria-label="Send prompt"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-[#6B625B] mt-1">
              Press <strong>Enter</strong> to send. All responses use deterministic formulas derived from store records.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL 2 (CENTER): REPLENISHMENT DECISION (5 cols)        */}
        {/* ======================================================== */}
        <div className={`lg:col-span-5 bg-white border border-[#E7E0D8] rounded-2xl flex flex-col h-[820px] overflow-hidden shadow-xs ${
          mobileTab !== 'decision' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Aligned Header */}
          <div className="h-14 px-4 bg-[#F8F6F2] border-b border-[#E7E0D8] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#E8E2F0] text-[#46362F] flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#46362F] leading-tight">Replenishment Decision</h3>
                <p className="text-[10px] text-[#6B625B]">Deterministic Packaging & Cost Optimization</p>
              </div>
            </div>
            {calculation && <StatusBadge status={calculation.stockStatus} size="sm" />}
          </div>

          {/* Scrollable Decision Workspace */}
          {!activeItem || !activeSupplier || !calculation ? (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
              <p className="text-sm font-bold text-[#46362F]">No recommendations available yet.</p>
              <p className="text-xs text-[#6B625B] max-w-xs">
                Add inventory items and supplier specifications or select an official test scenario (TC1–TC4) above to calculate replenishment needs.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => navigate('/inventory')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Inventory Items</span>
                </button>
                <button
                  onClick={() => handleSwitchScenario('TC1')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#46362F] bg-[#E8E2F0] hover:bg-[#D9C6A5]/60 rounded-xl transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Load Scenario TC1</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {/* Target SKU Selector */}
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B625B]">
                    Select Target Inventory SKU
                  </label>
                  {effectiveScenarioId && (
                    <span className="text-[10px] font-mono font-bold text-[#46362F] bg-[#E8E2F0] px-2 py-0.5 rounded">
                      Scenario {effectiveScenarioId} Active
                    </span>
                  )}
                </div>
                <select
                  value={activeItem.sku}
                  onChange={(e) => {
                    const nextSku = e.target.value;
                    setSelectedSku(nextSku);
                    if (nextSku === 'SKU-101' && effectiveScenarioId) handleSwitchScenario('TC1');
                    else if (nextSku === 'SKU-102' && effectiveScenarioId) handleSwitchScenario('TC2');
                    else if (nextSku === 'SKU-103' && effectiveScenarioId) handleSwitchScenario('TC3');
                    else if (nextSku === 'SKU-104' && effectiveScenarioId) handleSwitchScenario('TC4');
                  }}
                  className="w-full p-2.5 text-xs font-bold bg-white border border-[#E7E0D8] rounded-lg text-[#46362F] focus:outline-none focus:ring-1 focus:ring-[#46362F]"
                >
                  {effectiveInventory.map(i => (
                    <option key={i.sku} value={i.sku}>
                      {i.sku} — {i.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Calculation Matrix */}
              <div className="p-4 bg-white border border-[#E7E0D8] rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7E0D8]">
                  <h4 className="text-xs font-bold text-[#46362F] uppercase tracking-wider">
                    Live Stock Reconciliation
                  </h4>
                  <span className="text-[10px] font-mono text-[#8A9A83] font-bold">VERIFIED</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[#E7E0D8]/60">
                    <span className="text-[#6B625B]">Effective On-Hand Stock:</span>
                    <span className="font-semibold text-[#46362F]">
                      {calculation.effectiveStock} units 
                      <span className="text-[10px] text-[#6B625B] ml-1">({activeItem.currentStock} gross − {activeItem.reservedStock} res)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#E7E0D8]/60">
                    <span className="text-[#6B625B]">Lead-Time Demand:</span>
                    <span className="font-semibold text-[#46362F]">
                      {calculation.forecastDemand} units 
                      <span className="text-[10px] text-[#6B625B] ml-1">({activeItem.averageDailySales}u/day × {activeSupplier.leadTimeDays}d)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#E7E0D8]/60">
                    <span className="text-[#6B625B]">Safety Buffer:</span>
                    <span className="font-semibold text-[#46362F]">
                      +{activeItem.safetyStock} units
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#E7E0D8]/60">
                    <span className="text-[#6B625B]">Inbound Pipeline Orders:</span>
                    <span className={`font-semibold ${calculation.incomingOpenOrders > 0 ? 'text-[#327456]' : 'text-[#6B625B]'}`}>
                      −{calculation.incomingOpenOrders} units {calculation.incomingOpenOrders > 0 ? '(Offset applied)' : '(None in-transit)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 px-2 bg-[#F8F6F2] rounded-lg border border-[#E7E0D8]/60">
                    <span className="font-bold text-[#46362F]">Net Deficit (Unrounded):</span>
                    <span className="font-extrabold text-[#46362F]">{calculation.netRequirement} units</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#E7E0D8]/60">
                    <span className="text-[#6B625B]">Pack-Size Conversion:</span>
                    <span className="font-semibold text-[#46362F]">
                      Cases of {calculation.packSize} units <span className="text-[10px] text-[#8A9A83] font-bold">(Vendor Packaging)</span>
                    </span>
                  </div>
                </div>

                {/* Final Suggested Order Highlight Card */}
                <div className="p-4 bg-[#E8E2F0]/60 rounded-xl border border-[#E7E0D8] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#46362F]">Final Suggested Order:</span>
                    <span className="font-extrabold text-lg text-[#46362F]">
                      {calculation.finalOrderUnits} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span>Vendor Cases:</span>
                    <span className="font-bold text-[#46362F]">{calculation.recommendedCases} cases ({calculation.packSize} units/case)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6B625B]">
                    <span>Unit Price:</span>
                    <span className="font-semibold text-[#46362F]">{formatCurrencyINR(calculation.unitPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E7E0D8]">
                    <span className="font-bold text-[#46362F]">Estimated Purchase Cost:</span>
                    <span className="font-extrabold text-base text-[#46362F]">{formatCurrencyINR(calculation.totalCost)}</span>
                  </div>
                </div>

                {/* Authorized Spend Summary */}
                <div className="p-3 bg-[#F8F6F2] rounded-xl border border-[#E7E0D8] flex items-center justify-between text-[11px]">
                  <span className="text-[#6B625B]">Authorized Spend to Date:</span>
                  <span className="font-bold text-[#46362F]">{formatCurrencyINR(committedSpend)}</span>
                </div>
              </div>

              {/* Proposal Feedback Alert */}
              {proposalFeedback && (
                <div className={`p-3 rounded-xl text-xs space-y-1 ${
                  proposalFeedback.success 
                    ? 'bg-[#EBF7F0] text-[#327456] border border-[#BCE8D3]' 
                    : 'bg-[#FDF0F2] text-[#B42335] border border-[#F8C8CE]'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {proposalFeedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{proposalFeedback.success ? 'Proposal Queued' : 'Proposal Blocked'}</span>
                  </div>
                  <p>{proposalFeedback.message}</p>
                </div>
              )}

              {/* Primary Action Button */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmingProposal(true)}
                  disabled={calculation.finalOrderUnits <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl shadow-xs transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#D9C6A5]" />
                  <span>
                    {calculation.finalOrderUnits <= 0
                      ? 'Duplicate Order Suppressed (0 Units Needed)'
                      : calculation.requiresBudgetReview
                      ? 'Route to Needs Budget Review'
                      : 'Prepare Request for Approval'}
                  </span>
                </button>
                <p className="text-[10px] text-[#6B625B] text-center">
                  Human-in-the-loop invariant: No purchase order is placed without manager sign-off.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* PANEL 3 (RIGHT): SIGNALS & SOURCE EVIDENCE (3 cols)      */}
        {/* ======================================================== */}
        <div className={`lg:col-span-3 bg-white border border-[#E7E0D8] rounded-2xl flex flex-col h-[820px] overflow-hidden shadow-xs ${
          mobileTab !== 'evidence' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Aligned Header */}
          <div className="h-14 px-4 bg-[#F8F6F2] border-b border-[#E7E0D8] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#F8F6F2] border border-[#E7E0D8] text-[#46362F] flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#46362F] leading-tight">Signals & Evidence</h3>
                <p className="text-[10px] text-[#6B625B]">Audit Trace & Telemetry</p>
              </div>
            </div>
            <span className="text-[9px] font-mono text-[#8A9A83] font-bold">SHA-256</span>
          </div>

          {/* Scrollable Content */}
          {!activeItem || !activeSupplier || !priceCheck ? (
            <div className="flex-1 p-6 flex items-center justify-center text-center text-xs text-[#6B625B]">
              No SKU selected. Add inventory items or select a scenario (TC1–TC4) to inspect source evidence and supplier signals.
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {/* Selected SKU Metadata */}
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B] block">
                  SKU Specification
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Product:</span>
                    <span className="font-bold text-[#46362F] text-right line-clamp-1">{activeItem.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Category:</span>
                    <span className="font-medium text-[#46362F]">{activeItem.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Avg Daily Sales:</span>
                    <span className="font-bold text-[#46362F]">{activeItem.averageDailySales} units/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Reorder Point:</span>
                    <span className="font-bold text-[#46362F]">{activeItem.reorderThreshold} units</span>
                  </div>
                </div>
              </div>

              {/* Supplier & Lead Time Details */}
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B] block">
                  Supplier & Lead Time
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Vendor:</span>
                    <span className="font-bold text-[#46362F]">{activeSupplier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Lead Time:</span>
                    <span className="font-bold text-[#46362F]">{activeSupplier.leadTimeDays} business days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Contract Unit Price:</span>
                    <span className="font-bold text-[#46362F]">{formatCurrencyINR(activeSupplier.currentUnitPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">Previous Price:</span>
                    <span className="font-mono text-[#6B625B]">{formatCurrencyINR(activeSupplier.previousUnitPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B625B]">MOQ:</span>
                    <span className="font-bold text-[#46362F]">{activeSupplier.minimumOrderQuantity} units</span>
                  </div>
                </div>
              </div>

              {/* Incoming Orders in Pipeline for this SKU */}
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B]">
                    Inbound Pipeline Orders
                  </span>
                  <span className="font-bold text-[#46362F]">{skuOrders.length} Active</span>
                </div>

                {skuOrders.length === 0 ? (
                  <p className="text-[11px] text-[#6B625B]">No open shipments scheduled for this SKU.</p>
                ) : (
                  <div className="space-y-1.5">
                    {skuOrders.map(o => (
                      <div key={o.id} className="p-2 bg-white rounded-lg border border-[#E7E0D8] text-[11px] space-y-0.5">
                        <div className="flex justify-between font-mono font-bold text-[#46362F]">
                          <span>{o.id}</span>
                          <span className="text-[#327456]">+{o.remainingOpenQuantity} units</span>
                        </div>
                        <div className="flex justify-between text-[#6B625B] text-[10px]">
                          <span>Status: {o.status}</span>
                          <span>ETA: {o.expectedArrivalDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Quality & Price Surge Warnings */}
              {priceCheck.isPriceJumped && (
                <div className="p-3 bg-[#FFF8E6] border border-[#EAAA00]/40 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#8A5F00] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Price Surge Warning (≥ 20%)</span>
                  </div>
                  <p className="text-[11px] text-[#6B625B]">
                    Unit price surged +{priceCheck.percentageChange.toFixed(1)}%. Reorders are blocked from auto-approval and routed to Budget Review.
                  </p>
                </div>
              )}

              {/* Source Identifiers & Retrieval Timestamps */}
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl space-y-2 text-xs font-mono text-[10px]">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#6B625B] block">
                  Cryptographic Trace & IDs
                </span>
                <div className="space-y-1 text-[#6B625B]">
                  {effectiveScenarioId && (
                    <div className="flex justify-between">
                      <span>Scenario ID:</span>
                      <span className="font-bold text-[#46362F]">{effectiveScenarioId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>SKU Source ID:</span>
                    <span className="font-bold text-[#46362F]">{activeItem.sourceRecordId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendor ID:</span>
                    <span className="font-bold text-[#46362F]">{activeSupplier.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rule Engine:</span>
                    <span className="font-bold text-[#46362F]">DETERMINISTIC_LEAD_V1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timestamp:</span>
                    <span className="text-[#46362F]">{new Date().toISOString().slice(0, 19)}Z</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clearing Chat */}
      <ConfirmationModal
        isOpen={isConfirmingClear}
        title="Reset Copilot Dialogue"
        description="Are you sure you want to clear the conversation history? This will restart the copilot context with default grounding."
        confirmLabel="Reset History"
        variant="warning"
        onConfirm={() => {
          clearChat();
          setIsConfirmingClear(false);
        }}
        onClose={() => setIsConfirmingClear(false)}
      />

      {/* Confirmation Modal for Submitting Proposal */}
      {activeItem && activeSupplier && calculation && (
        <ConfirmationModal
          isOpen={isConfirmingProposal}
          title="Submit Purchase Proposal for Human Sign-off"
          description={`This generates a formal purchase proposal for ${activeItem.sku} (${activeItem.name}) and routes it to the human review queue. Consequential spending is never executed without explicit human authorization.`}
          confirmLabel="Confirm & Route to Approvals"
          variant="primary"
          onConfirm={handleCreateProposal}
          onClose={() => setIsConfirmingProposal(false)}
        >
          <div className="p-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl text-xs space-y-1">
            <p><strong>Target SKU:</strong> {activeItem.sku} ({activeItem.name})</p>
            <p><strong>Supplier:</strong> {activeSupplier.name}</p>
            <p><strong>Recommended Quantity:</strong> {calculation.finalOrderUnits} units ({calculation.recommendedCases} cases)</p>
            <p><strong>Total Value:</strong> {formatCurrencyINR(calculation.totalCost)}</p>
            <p><strong>Queue Destination:</strong> {calculation.requiresBudgetReview ? 'Needs Budget Review' : 'Pending Approval'}</p>
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
};
