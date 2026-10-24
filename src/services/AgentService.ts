import { 
  InventoryItem, 
  Supplier, 
  IncomingOrder, 
  ChatMessage, 
  ReorderRequest,
  TestScenarioId,
  TestResult,
  ScenarioAnalysisReport
} from '../types';
import { calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';
import { TestLabService } from './TestLabService';
import { BRAND_CONFIG } from './config';

export class AgentService {
  /**
   * Executes a deterministic, structured Decision Room analysis for official scenarios TC1–TC4.
   * Returns both a structured ScenarioAnalysisReport for the Decision Room panel and a rich ChatMessage for ReStockIQ Copilot.
   */
  static analyzeScenario(
    scenarioId: TestScenarioId,
    existingTestResult?: TestResult
  ): {
    report: ScenarioAnalysisReport;
    chatMessage: ChatMessage;
    item: InventoryItem;
    supplier: Supplier;
    orders: IncomingOrder[];
    testResult: TestResult;
  } {
    const context = TestLabService.getScenarioContext(scenarioId);
    const testResult = existingTestResult || context.testResult;
    const { item, supplier, allScenarioOrders } = context;
    const plan = calculateReorderPlan(item, supplier, allScenarioOrders);
    const priceCheck = checkSupplierPriceChange(supplier.currentUnitPrice, supplier.previousUnitPrice);
    const activeInbound = allScenarioOrders.filter(
      o => o.sku === item.sku && o.status !== 'Received' && o.status !== 'Cancelled'
    );

    let subtitle = '';
    let riskLevel: ScenarioAnalysisReport['riskLevel'] = 'MEDIUM';
    let identifiedRisks: string[] = [];
    let keyFindings: ScenarioAnalysisReport['keyFindings'] = [];
    let evidenceReferences: ScenarioAnalysisReport['evidenceReferences'] = [];
    let recommendedActions: string[] = [];
    let assumptionsAndConstraints: string[] = [];

    if (scenarioId === 'TC1') {
      subtitle = 'Lead-Time Stockout Depletion with Zero Inbound Pipeline';
      riskLevel = 'CRITICAL';
      identifiedRisks = [
        `Imminent Lead-Time Stockout Risk: Effective stock (${plan.effectiveStock} units) is below the ${plan.leadTimeDays}-day lead-time demand (${plan.forecastDemand} units) plus ${item.safetyStock}-unit safety buffer (${plan.forecastDemand + item.safetyStock} total target units).`,
        `Zero Inbound Coverage: 0 open purchase orders exist in the inbound pipeline to offset daily consumption (${item.averageDailySales} units/day).`,
        `Revenue & Service Exposure: Without an immediate 18-unit replenishment order, SKU-101 (${item.name}) will stock out before supplier delivery.`
      ];
      keyFindings = [
        {
          label: 'Effective Usable Stock (On-Hand − Reserved)',
          expected: '12 units (15 − 3)',
          actual: `${plan.effectiveStock} units`,
          passed: plan.effectiveStock === 12,
        },
        {
          label: 'Lead-Time Demand (4u/day × 5d)',
          expected: '20 units',
          actual: `${plan.forecastDemand} units`,
          passed: plan.forecastDemand === 20,
        },
        {
          label: 'Target Stock Position (Demand + Safety Stock)',
          expected: '30 units (20 + 10)',
          actual: `${plan.forecastDemand + item.safetyStock} units`,
          passed: plan.forecastDemand + item.safetyStock === 30,
        },
        {
          label: 'Net Replenishment Order Quantity',
          expected: '18 units',
          actual: `${plan.finalOrderUnits} units`,
          passed: plan.finalOrderUnits === 18,
        },
      ];
      evidenceReferences = [
        {
          id: item.id,
          label: 'Inventory Ledger Snapshot',
          detail: `${item.sku} (${item.name}): ${item.currentStock} gross, ${item.reservedStock} reserved = ${plan.effectiveStock} usable units [Source: ${item.sourceRecordId}]`,
        },
        {
          id: supplier.id,
          label: 'Contracted Supplier Record',
          detail: `${supplier.name}: ${supplier.leadTimeDays}d lead time, Pack size ${supplier.packSize}, MOQ ${supplier.minimumOrderQuantity}u, ₹${supplier.currentUnitPrice}/u`,
        },
      ];
      recommendedActions = [
        `Generate purchase request for exactly 18 units (18 cases of 1) of ${item.sku} (${item.name}) at ₹${plan.totalCost.toLocaleString('en-IN')}.`,
        `Route proposal REQ-TC1 to Approval Center for immediate manager sign-off.`,
        `Maintain 3-unit reservation lock until shipment from ${supplier.name} arrives.`
      ];
      assumptionsAndConstraints = [
        `Daily sales velocity holds at ${item.averageDailySales} units/day across the ${supplier.leadTimeDays}-day supplier lead time.`,
        `Supplier ${supplier.name} ships in single-unit packs (Pack Size = 1) with no price variance (₹${supplier.currentUnitPrice}/unit).`,
        `Safety buffer requirement is fixed at ${item.safetyStock} units.`
      ];
    } else if (scenarioId === 'TC2') {
      subtitle = 'Supplier Case-Pack Constraint Conversion (Cases of 12)';
      riskLevel = 'HIGH';
      identifiedRisks = [
        `Broken-Case Rejection Risk: Raw net shortage is ${plan.netRequirement} units, which violates ${supplier.name}'s strict 12-unit case packaging rule.`,
        `Lead-Time Deficit: Effective stock (${plan.effectiveStock} units) cannot cover the ${plan.forecastDemand}-unit lead-time demand plus ${item.safetyStock}-unit safety stock (${plan.forecastDemand + item.safetyStock} units).`,
        `Carryover Buffer Accounting: Rounding 17 raw units up to 2 full cases (24 units) creates a predictable +7 unit carryover buffer that must be tracked.`
      ];
      keyFindings = [
        {
          label: 'Effective Usable Stock',
          expected: '8 units',
          actual: `${plan.effectiveStock} units`,
          passed: plan.effectiveStock === 8,
        },
        {
          label: 'Raw Unrounded Net Deficit',
          expected: '17 units (25 target − 8 stock)',
          actual: `${plan.netRequirement} units`,
          passed: plan.netRequirement === 17,
        },
        {
          label: 'Vendor Case Conversion (ceil(17 / 12))',
          expected: '2 full cases',
          actual: `${plan.recommendedCases} cases`,
          passed: plan.recommendedCases === 2,
        },
        {
          label: 'Final Pack-Compliant Order Quantity',
          expected: '24 units (2 × 12)',
          actual: `${plan.finalOrderUnits} units`,
          passed: plan.finalOrderUnits === 24,
        },
      ];
      evidenceReferences = [
        {
          id: item.id,
          label: 'Inventory Ledger Snapshot',
          detail: `${item.sku} (${item.name}): ${plan.effectiveStock} usable units vs. ${plan.forecastDemand + item.safetyStock} target [Source: ${item.sourceRecordId}]`,
        },
        {
          id: supplier.id,
          label: 'Supplier Packaging Rule',
          detail: `${supplier.name}: Enforces Pack Size = ${supplier.packSize} units/case, MOQ = ${supplier.minimumOrderQuantity} units`,
        },
        {
          id: 'PACK_RULE_12',
          label: 'Deterministic Pack Rounding Invariant',
          detail: `Math.ceil(17 / 12) = 2 cases → 24 units (+7 units carryover safety buffer)`,
        },
      ];
      recommendedActions = [
        `Issue purchase proposal for 2 full cases (24 units) of ${item.sku} with ${supplier.name} (Total: ₹${plan.totalCost.toLocaleString('en-IN')}).`,
        `Record the +7 unit case-rounding surplus in inventory projection so future cycles offset the buffer.`,
        `Never submit unrounded 17-unit orders to ${supplier.name} to avoid vendor rejection delays.`
      ];
      assumptionsAndConstraints = [
        `Vendor ${supplier.name} strictly enforces case multiples of ${supplier.packSize} units.`,
        `Lead-time demand is ${item.averageDailySales} units/day × ${supplier.leadTimeDays} days = ${plan.forecastDemand} units.`,
        `Unit price remains stable at ₹${supplier.currentUnitPrice.toFixed(2)} (0% price variance).`
      ];
    } else if (scenarioId === 'TC3') {
      const openOrder = activeInbound[0];
      subtitle = 'Inbound Pipeline Reconciliation & Duplicate Order Prevention';
      riskLevel = 'LOW';
      identifiedRisks = [
        `Duplicate Ordering Risk (Mitigated): Current on-hand stock (${plan.effectiveStock} units) is below the ${plan.forecastDemand + item.safetyStock}-unit target, which would trigger a redundant order in systems that ignore open pipeline POs.`,
        `Inbound Delivery Dependency: Stock continuity depends on active shipment ${openOrder?.id || 'PO-2026-089'} (${openOrder?.remainingOpenQuantity || 30} units) arriving on ${openOrder?.expectedArrivalDate || 'schedule'}.`
      ];
      keyFindings = [
        {
          label: 'Effective On-Hand Stock',
          expected: '5 units',
          actual: `${plan.effectiveStock} units`,
          passed: plan.effectiveStock === 5,
        },
        {
          label: 'Target Stock Requirement (Demand + Safety)',
          expected: '30 units (20 + 10)',
          actual: `${plan.forecastDemand + item.safetyStock} units`,
          passed: plan.forecastDemand + item.safetyStock === 30,
        },
        {
          label: 'Qualifying Open Inbound Supply',
          expected: '30 units (PO-2026-089)',
          actual: `${plan.incomingOpenOrders} units`,
          passed: plan.incomingOpenOrders === 30,
        },
        {
          label: 'Additional Replenishment Needed',
          expected: '0 units (Duplicate Suppressed)',
          actual: `${plan.finalOrderUnits} units`,
          passed: plan.finalOrderUnits === 0,
        },
      ];
      evidenceReferences = [
        {
          id: item.id,
          label: 'Inventory Ledger Snapshot',
          detail: `${item.sku} (${item.name}): ${plan.effectiveStock} usable units on shelf [Source: ${item.sourceRecordId}]`,
        },
        {
          id: openOrder?.id || 'PO-2026-089',
          label: 'Active Inbound Purchase Order',
          detail: `${openOrder?.id || 'PO-2026-089'}: ${openOrder?.remainingOpenQuantity || 30} units (${openOrder?.status || 'In Transit'}), ETA ${openOrder?.expectedArrivalDate || '2026-10-28'}`,
        },
        {
          id: supplier.id,
          label: 'Supplier Contract Record',
          detail: `${supplier.name}: ${supplier.leadTimeDays}d lead time, ₹${supplier.currentUnitPrice}/unit`,
        },
      ];
      recommendedActions = [
        `Suppress new purchase request generation for ${item.sku} (Recommended Order = 0 units), saving ₹1,800 in redundant working capital.`,
        `Monitor inbound delivery receipt for ${openOrder?.id || 'PO-2026-089'} (${openOrder?.remainingOpenQuantity || 30} units).`,
        `Automatically transition ${openOrder?.id || 'PO-2026-089'} to Received once shipment arrives at the warehouse dock.`
      ];
      assumptionsAndConstraints = [
        `Open purchase order ${openOrder?.id || 'PO-2026-089'} (${openOrder?.remainingOpenQuantity || 30} units) is confirmed active and not cancelled.`,
        `Total covered position (${plan.effectiveStock} on-hand + ${plan.incomingOpenOrders} inbound = ${plan.effectiveStock + plan.incomingOpenOrders} units) exceeds the 30-unit target.`,
        `Idempotency shield blocks duplicate proposal creation while inbound coverage is sufficient.`
      ];
    } else {
      // TC4
      subtitle = 'Supplier Price Spike (+25.0% ≥ 20% Threshold) & Governance Gate';
      riskLevel = 'HIGH';
      identifiedRisks = [
        `Supplier Price Surge Alert: ${supplier.name} increased unit billing price from ₹${supplier.previousUnitPrice.toFixed(2)} to ₹${supplier.currentUnitPrice.toFixed(2)} (+${priceCheck.percentageChange}%), breaching the strict 20.0% governance threshold.`,
        `Margin Erosion Risk: Ordering ${plan.finalOrderUnits} units at the new price adds ₹${((supplier.currentUnitPrice - supplier.previousUnitPrice) * plan.finalOrderUnits).toLocaleString('en-IN')} in unplanned cost inflation (Total: ₹${plan.totalCost.toLocaleString('en-IN')}).`,
        `Auto-Approval Blocked: Standard procurement issuance is locked until a manager completes a formal Budget Review.`
      ];
      keyFindings = [
        {
          label: 'Previous Verified Unit Price',
          expected: '₹50.00',
          actual: `₹${supplier.previousUnitPrice.toFixed(2)}`,
          passed: supplier.previousUnitPrice === 50,
        },
        {
          label: 'New Billed Supplier Unit Price',
          expected: '₹62.50',
          actual: `₹${supplier.currentUnitPrice.toFixed(2)}`,
          passed: supplier.currentUnitPrice === 62.5,
        },
        {
          label: 'Calculated Price Variance Percentage',
          expected: '+25.0% (≥ 20.0% threshold)',
          actual: `+${priceCheck.percentageChange}%`,
          passed: priceCheck.percentageChange >= 20,
        },
        {
          label: 'Governance Routing Status',
          expected: 'Needs Budget Review (Auto-Approval Blocked)',
          actual: plan.requiresBudgetReview ? 'Needs Budget Review' : 'Pending Approval',
          passed: plan.requiresBudgetReview === true,
        },
      ];
      evidenceReferences = [
        {
          id: supplier.id,
          label: 'Supplier Price History Ledger',
          detail: `${supplier.name}: Unit price jumped from ₹${supplier.previousUnitPrice.toFixed(2)} to ₹${supplier.currentUnitPrice.toFixed(2)} (+${priceCheck.percentageChange}%)`,
        },
        {
          id: item.id,
          label: 'Inventory Replenishment Calculation',
          detail: `${item.sku} (${item.name}): ${plan.finalOrderUnits} units required (${plan.recommendedCases} cases of ${plan.packSize}) = ₹${plan.totalCost.toLocaleString('en-IN')}`,
        },
        {
          id: 'SUP-003-PRICE-LOG',
          label: '20% Price Variance Governance Rule',
          detail: `Variance +${priceCheck.percentageChange}% >= 20.0% invariant → Mandatory escalation to Needs Budget Review`,
        },
      ];
      recommendedActions = [
        `Route ${plan.finalOrderUnits}-unit reorder proposal (₹${plan.totalCost.toLocaleString('en-IN')}) to the 'Needs Budget Review' queue in the Approval Center.`,
        `Block automatic purchase order dispatch until procurement leadership reviews ${supplier.name}'s +${priceCheck.percentageChange}% price hike.`,
        `Evaluate alternate packaging vendors or negotiate volume rebate before releasing funds.`
      ];
      assumptionsAndConstraints = [
        `Store governance policy prohibits automatic approval whenever supplier unit price increases by 20.0% or more.`,
        `Replenishment quantity (${plan.finalOrderUnits} units / ${plan.recommendedCases} cases) is still calculated so operations knows the exact physical requirement.`,
        `Manager sign-off in Approval Center is mandatory to override or approve the price variance.`
      ];
    }

    const report: ScenarioAnalysisReport = {
      scenarioId,
      title: `${scenarioId} — ${testResult.scenarioTitle}`,
      subtitle,
      targetSku: item.sku,
      productName: item.name,
      supplierName: supplier.name,
      status: testResult.status,
      riskLevel,
      summaryVerdict: testResult.assertionSummary || 'Scenario verified against deterministic rule engine.',
      evidenceReferences,
      identifiedRisks,
      keyFindings,
      recommendedActions,
      assumptionsAndConstraints,
      recommendedOrderUnits: plan.finalOrderUnits,
      recommendedCases: plan.recommendedCases,
      estimatedTotalCostINR: plan.totalCost,
      analyzedAt: new Date().toISOString(),
    };

    const markdownText = [
      `### ${BRAND_CONFIG.appName} Scenario Analysis: ${scenarioId} — ${testResult.scenarioTitle}`,
      `**Target SKU:** \`${item.sku}\` (${item.name}) · **Supplier:** ${supplier.name} · **Risk Level:** **${riskLevel}** · **Assertion:** **${testResult.status.toUpperCase()}**`,
      '',
      `#### 1. Evidence & Source References`,
      ...evidenceReferences.map(e => `• **\`[${e.id}]\` ${e.label}:** ${e.detail}`),
      '',
      `#### 2. Key Quantitative Findings`,
      ...keyFindings.map(k => `• **${k.label}:** \`${k.actual}\` *(Expected: ${k.expected})* — ${k.passed ? '✅ Verified' : '❌ Mismatch'}`),
      '',
      `#### 3. Inventory, Demand & Supply-Chain Risks`,
      ...identifiedRisks.map(r => `• ${r}`),
      '',
      `#### 4. Recommended Decision & Actions`,
      ...recommendedActions.map(a => `• ${a}`),
      '',
      `#### 5. Assumptions & Governance Constraints`,
      ...assumptionsAndConstraints.map(c => `• ${c}`),
    ].join('\n');

    const chatMessage: ChatMessage = {
      id: `MSG-SCENARIO-${scenarioId}-${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toISOString(),
      text: markdownText,
      structuredData: {
        type: 'calculation_breakdown',
        sku: item.sku,
        details: plan,
      },
      suggestedActions: [
        `Explain the reorder calculation for ${item.sku}`,
        'Which products need replenishment?',
        'What inventory risks should I review today?',
      ],
    };

    return {
      report,
      chatMessage,
      item,
      supplier,
      orders: context.orders,
      testResult,
    };
  }

  /**
   * Process a user prompt strictly against authorized real user inventory, supplier, and order data,
   * or against an active TC1–TC4 benchmark scenario when invoked from the Verification Lab / Decision Room.
   */
  static processMessage(
    userText: string,
    inventory: InventoryItem[],
    suppliers: Supplier[],
    orders: IncomingOrder[],
    requests: ReorderRequest[],
    activeScenarioId?: TestScenarioId | null
  ): ChatMessage {
    const lower = userText.toLowerCase().trim();
    const timestamp = new Date().toISOString();

    // Check if the query explicitly asks to analyze TC1, TC2, TC3, or TC4
    const scenarioMatch = userText.match(/\b(TC[1-4])\b/i);
    if (scenarioMatch) {
      const scId = scenarioMatch[1].toUpperCase() as TestScenarioId;
      return this.analyzeScenario(scId).chatMessage;
    }

    // If inventory is empty but a benchmark SKU (SKU-101..SKU-104) or activeScenarioId is referenced, use the scenario context
    const skuMatch = lower.match(/sku-10([1-4])/i);
    if (inventory.length === 0 && (skuMatch || activeScenarioId)) {
      const scId: TestScenarioId = skuMatch
        ? (`TC${skuMatch[1]}` as TestScenarioId)
        : (activeScenarioId || 'TC1');
      return this.analyzeScenario(scId).chatMessage;
    }

    if (inventory.length === 0) {
      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Insufficient Data to Generate a Recommendation\n\nYour inventory catalog currently has **0 SKUs** and **${suppliers.length} suppliers**. ${BRAND_CONFIG.copilotName} only calculates replenishment quantities, low-stock summaries, and stockout forecasts from real, verified store records or official **TC1–TC4** verification scenarios.\n\n**How to Begin:**\n1. Add your first SKU or import a CSV in **Inventory Management**.\n2. Register your contracted vendors and pack sizes in **Suppliers & Orders**.\n3. Or click **TC1, TC2, TC3, or TC4** in the Decision Room scenario bar above to inspect deterministic scenario traces.`,
        suggestedActions: [
          'Analyze scenario TC1 (SKU-101)',
          'Analyze scenario TC2 (SKU-102)',
          'Analyze scenario TC3 (SKU-103)',
          'Analyze scenario TC4 (SKU-104)',
        ],
      };
    }

    const defaultSupplier: Supplier = suppliers[0] || {
      id: 'UNASSIGNED',
      name: 'Default Supplier',
      contactInformation: { representative: 'N/A', email: '', phone: '', address: '' },
      leadTimeDays: 5,
      packSize: 1,
      minimumOrderQuantity: 1,
      currentUnitPrice: 0,
      previousUnitPrice: 0,
      status: 'Active',
    };

    // 1. Stockout / Low-stock / Inventory Risks query
    if (
      lower.includes('stock out') ||
      lower.includes('stockout') ||
      lower.includes('low-stock') ||
      lower.includes('low stock') ||
      lower.includes('summarize') ||
      lower.includes('risk') ||
      lower.includes('next seven days') ||
      lower.includes('7 days')
    ) {
      const atRisk = inventory.filter(item => {
        const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
        const plan = calculateReorderPlan(item, sup, orders);
        return plan.stockStatus === 'Critical' || plan.stockStatus === 'Stockout Risk' || plan.stockStatus === 'Low Stock';
      });

      const jumpedSuppliers = suppliers.filter(s => checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice).isPriceJumped);

      const skuList = atRisk.length > 0
        ? atRisk.map(item => {
            const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
            const plan = calculateReorderPlan(item, sup, orders);
            return `• **${item.sku} (${item.name})** — Status: **${plan.stockStatus}** (Effective stock: ${plan.effectiveStock}u, Daily sales: ${item.averageDailySales}u, Lead time: ${sup.leadTimeDays}d, Suggested order: ${plan.finalOrderUnits}u)`;
          }).join('\n')
        : '• All tracked SKUs currently have sufficient stock and inbound coverage for their lead-time windows.';

      const priceNote = jumpedSuppliers.length > 0
        ? `\n\n**Supplier Price Variance Risks:**\n• ${jumpedSuppliers.length} supplier(s) triggered the ≥20% price jump guardrail (${jumpedSuppliers.map(s => s.name).join(', ')}).`
        : '';

      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Inventory Risk & Low-Stock Summary\n\n${BRAND_CONFIG.copilotName} evaluated all **${inventory.length} SKUs** against current daily run-rates, open pipeline shipments, and supplier lead times.\n\n**${atRisk.length} SKUs are currently identified as low-stock or at stockout risk during their replenishment window:**\n\n${skuList}${priceNote}`,
        structuredData: {
          type: 'stockout_summary',
          details: atRisk.map(item => item.sku),
        },
        suggestedActions: [
          'Which products need replenishment?',
          ...(atRisk[0] ? [`Explain the reorder calculation for ${atRisk[0].sku}`] : []),
          'Which incoming orders already cover demand?',
        ],
      };
    }

    // 2. Which products need replenishment? / What should I reorder today?
    if (lower.includes('reorder today') || lower.includes('what should i reorder') || lower.includes('replenish')) {
      const needsOrder = inventory.filter(item => {
        const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
        const plan = calculateReorderPlan(item, sup, orders);
        return plan.finalOrderUnits > 0;
      });

      const breakdownText = needsOrder.length > 0
        ? needsOrder.map(item => {
            const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
            const plan = calculateReorderPlan(item, sup, orders);
            return `• **${item.sku} (${item.name})**:\n  - Net Need: ${plan.netRequirement} units\n  - Pack Adjusted: **${plan.finalOrderUnits} units** (${plan.recommendedCases} cases of ${plan.packSize})\n  - Cost: ₹${plan.totalCost.toLocaleString('en-IN')}\n  - Budget Alert: ${plan.requiresBudgetReview ? '⚠️ Price Jump Review Required' : '✅ Standard'}`;
          }).join('\n\n')
        : 'No SKUs currently require replenishment today. Existing on-hand stock and open inbound shipments satisfy all lead-time demand requirements.';

      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Recommended Replenishment Actions\n\nBased on your active inventory and minimum safety buffers, here are the calculated replenishment requirements:\n\n${breakdownText}`,
        suggestedActions: [
          ...(needsOrder[0] ? [`Explain the reorder calculation for ${needsOrder[0].sku}`] : []),
          'Summarize the current low-stock items.',
          'What inventory risks should I review today?',
        ],
      };
    }

    // 3. Incoming orders covering demand
    if (lower.includes('incoming') || lower.includes('open order') || lower.includes('cover') || lower.includes('pipeline')) {
      const activeOrders = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');
      
      const ordersFormatted = activeOrders.length > 0
        ? activeOrders.map((o, idx) => {
            const item = inventory.find(i => i.sku === o.sku);
            const sup = suppliers.find(s => s.id === item?.supplierId) || defaultSupplier;
            const plan = item ? calculateReorderPlan(item, sup, orders) : null;
            
            let decisionText = 'Evaluate against current lead-time demand and remaining stock.';
            if (item && o.remainingOpenQuantity >= (item.averageDailySales * item.leadTimeDays)) {
              decisionText = `Inbound supply covers the calculated ${item.averageDailySales * item.leadTimeDays}-unit lead-time requirement; duplicate reorder suppressed.`;
            } else if (item) {
              decisionText = `Partial inbound coverage (${o.remainingOpenQuantity} units). Net shortfall remaining after delivery: ${plan ? plan.finalOrderUnits : '0'} units.`;
            }

            return `**${idx + 1}. ${o.id} — \`${o.sku}\` (${item?.name || 'Item'})**\n- **Incoming quantity:** ${o.remainingOpenQuantity} units (${o.status})\n- **Expected arrival:** ${o.expectedArrivalDate}\n- **Decision:** ${decisionText}`;
          }).join('\n\n')
        : 'There are currently **0 open inbound orders** in transit.';

      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Incoming Orders Covering Demand\n\nThe system identified **${activeOrders.length} qualifying open orders** in your active records.\n\n${ordersFormatted}`,
        suggestedActions: [
          'Which products need replenishment?',
          'Summarize the current low-stock items.',
        ],
      };
    }

    // 4. Supplier price increase query
    if (lower.includes('price') || lower.includes('increase') || lower.includes('cost') || lower.includes('jump')) {
      const jumpedSuppliers = suppliers.filter(s => {
        const check = checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice);
        return check.isPriceJumped;
      });

      const list = jumpedSuppliers.map(s => {
        const check = checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice);
        const affectedSkus = inventory.filter(i => i.supplierId === s.id).map(i => i.sku).join(', ') || 'Assigned SKUs';
        return `• **${s.name} (${s.id})**: Unit price increased from **₹${s.previousUnitPrice.toFixed(2)}** to **₹${s.currentUnitPrice.toFixed(2)}** (+${check.percentageChange}% increase).\n  - Affects: ${affectedSkus}\n  - Status: Triggered mandatory 'Needs Budget Review' gate.`;
      }).join('\n');

      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Supplier Price Variance Alert\n\n${jumpedSuppliers.length > 0 ? `I detected ${jumpedSuppliers.length} supplier(s) with a price increase exceeding the **20.0% variance threshold**:\n\n${list}` : 'No supplier price increases ≥ 20.0% were detected across your registered suppliers.'}\n\n**Governance Enforcement:** ${BRAND_CONFIG.appName} will not automatically approve purchase orders from suppliers with price surges above 20%. Any reorders are placed into **Needs Budget Review** status.`,
        suggestedActions: [
          'Review purchase requests needing budget review',
          'Which products need replenishment?',
        ],
      };
    }

    // 5. Budget review query
    if (lower.includes('budget') || lower.includes('review')) {
      const reviewRequests = requests.filter(r => r.status === 'Needs Budget Review');
      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Budget Review Status\n\nThere are currently **${reviewRequests.length} reorder requests** flagged for management budget review:\n\n${reviewRequests.length > 0 ? reviewRequests.map(r => `• **${r.id}** (${r.productName}): ${r.proposedQuantity} units = ₹${r.totalCost.toLocaleString('en-IN')}. Reason: *${r.reason}*`).join('\n') : '• Zero requests are currently awaiting budget review.'}\n\nYou can inspect or review requests directly in the **Approval Center**.`,
        suggestedActions: [
          'Which suppliers increased their prices?',
          'Which products need replenishment?',
        ],
      };
    }

    // 6. Explain reorder calculation for specific SKU
    const anySkuMatch = lower.match(/sku-[a-z0-9-]+/i);
    if (anySkuMatch || lower.includes('explain') || lower.includes('calculation')) {
      const targetSku = anySkuMatch ? anySkuMatch[0].toUpperCase() : inventory[0].sku;
      const item = inventory.find(i => i.sku.toUpperCase() === targetSku) || inventory[0];
      const sup = suppliers.find(s => s.id === item.supplierId) || defaultSupplier;
      const plan = calculateReorderPlan(item, sup, orders);

      const stepsText = plan.formulaSteps.map(s => `**${s.step}**\n- Formula: \`${s.formula}\`\n- Inputs: ${s.values}\n- Result: **${s.result}**`).join('\n\n');

      return {
        id: `MSG-AGENT-${Date.now()}`,
        sender: 'agent',
        timestamp,
        text: `### Explainable Reorder Calculation for ${item.sku} (${item.name})\n\n${stepsText}\n\n**Summary:**\n• Effective Stock: ${plan.effectiveStock} units\n• Forecast Demand: ${plan.forecastDemand} units (${plan.dailySales}/day × ${plan.leadTimeDays}d)\n• Pack Size: ${plan.packSize} units/case\n• Final Order: **${plan.finalOrderUnits} units (${plan.recommendedCases} cases)**\n• Total Cost: **₹${plan.totalCost.toLocaleString('en-IN')}**\n• Status: **${plan.stockStatus}**`,
        structuredData: {
          type: 'calculation_breakdown',
          sku: item.sku,
          details: plan,
        },
        suggestedActions: [
          'Which products need replenishment?',
          'Check incoming orders',
        ],
      };
    }

    // Default response grounded in real inventory counts
    return {
      id: `MSG-AGENT-${Date.now()}`,
      sender: 'agent',
      timestamp,
      text: `### ${BRAND_CONFIG.copilotName}\n\nMeet ${BRAND_CONFIG.copilotName} — ${BRAND_CONFIG.subtitle} (${BRAND_CONFIG.tagline})\n\nI am analyzing your live catalog of **${inventory.length} SKUs** across **${suppliers.length} suppliers**. Try one of these queries:`,
      suggestedActions: [
        'Which products need replenishment?',
        'Summarize the current low-stock items.',
        'What inventory risks should I review today?',
        'Which incoming orders already cover demand?',
        ...(inventory[0] ? [`Explain the reorder calculation for ${inventory[0].sku}`] : []),
      ],
    };
  }
}

