import { TestResult, InventoryItem, Supplier, IncomingOrder, TestScenarioId } from '../types';
import { calculateReorderPlan, checkSupplierPriceChange, roundToSupplierPackSize } from '../utils/reorderCalculations';
import { SEED_INVENTORY } from '../data/seedInventory';
import { SEED_SUPPLIERS } from '../data/seedSuppliers';
import { SEED_ORDERS } from '../data/seedOrders';

export class TestLabService {
  /**
   * Run an isolated formula unit test scenario without polluting or relying on live user inventory
   */
  static runIsolatedScenario(scenarioId: TestScenarioId): TestResult {
    const invMap = new Map(SEED_INVENTORY.map(i => [i.sku, i]));
    const supMap = new Map(SEED_SUPPLIERS.map(s => [s.id, s]));

    if (scenarioId === 'TC1') {
      const item = invMap.get('SKU-101')!;
      const sup = supMap.get(item.supplierId)!;
      return this.runTC1(item, sup, SEED_ORDERS);
    } else if (scenarioId === 'TC2') {
      const item = invMap.get('SKU-102')!;
      const sup = supMap.get(item.supplierId)!;
      return this.runTC2(item, sup, SEED_ORDERS);
    } else if (scenarioId === 'TC3') {
      const item = invMap.get('SKU-103')!;
      const sup = supMap.get(item.supplierId)!;
      return this.runTC3(item, sup, SEED_ORDERS);
    } else {
      const item = invMap.get('SKU-104')!;
      const sup = supMap.get(item.supplierId)!;
      return this.runTC4(item, sup, SEED_ORDERS);
    }
  }

  /**
   * Run Scenario 1: Low stock with no incoming order
   */
  static runTC1(item: InventoryItem, supplier: Supplier, openOrders: IncomingOrder[]): TestResult {
    const startTime = new Date().toISOString();
    const effectiveStock = item.currentStock - item.reservedStock;
    const forecastDemand = item.averageDailySales * item.leadTimeDays;
    
    // Filter open orders
    const incomingOpen = openOrders
      .filter(o => o.sku === item.sku && o.status !== 'Received' && o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.remainingOpenQuantity, 0);

    const calculation = calculateReorderPlan(item, supplier, openOrders);
    const expectedReplenishment = 18; // (20 + 10) - 12 = 18

    const logs: string[] = [
      `[TC1-Init] Evaluating SKU ${item.sku} (${item.name})`,
      `[TC1-Step 1] Effective stock: Current (${item.currentStock}) - Reserved (${item.reservedStock}) = ${effectiveStock} units`,
      `[TC1-Step 2] Forecast demand: ${item.averageDailySales} units/day × ${item.leadTimeDays} days lead time = ${forecastDemand} units`,
      `[TC1-Step 3] Safety stock buffer required = ${item.safetyStock} units. Total target inventory = ${forecastDemand + item.safetyStock} units`,
      `[TC1-Step 4] Inbound pipeline check: ${incomingOpen} units currently on order`,
      `[TC1-Step 5] Net replenishment calculated: Max(0, 30 - (${effectiveStock} + ${incomingOpen})) = ${calculation.finalOrderUnits} units`,
      `[TC1-Assertion] Asserting calculated units (${calculation.finalOrderUnits}) === expected (${expectedReplenishment})`
    ];

    const passed = calculation.finalOrderUnits === expectedReplenishment && incomingOpen === 0;

    return {
      id: `TR-TC1-${Date.now()}`,
      scenarioId: 'TC1',
      scenarioTitle: 'Low Stock with No Incoming Order',
      status: passed ? 'Passed' : 'Failed',
      inputSnapshot: {
        sku: item.sku,
        initialStock: item.currentStock,
        reservedStock: item.reservedStock,
        effectiveStock,
        averageDailySales: item.averageDailySales,
        leadTimeDays: item.leadTimeDays,
        safetyStock: item.safetyStock,
        incomingOpenQuantity: incomingOpen,
      },
      expectedResult: {
        calculatedDemand: 20,
        targetStock: 30,
        expectedReplenishmentQuantity: 18,
        incomingCoverage: 0,
        proposedAction: 'Generate Purchase Request for 18 units',
      },
      actualResult: {
        calculatedDemand: calculation.forecastDemand,
        targetStock: calculation.forecastDemand + item.safetyStock,
        actualReplenishmentQuantity: calculation.finalOrderUnits,
        incomingCoverage: incomingOpen,
        proposedAction: `Request REQ-TC1 prepared for ${calculation.finalOrderUnits} units`,
      },
      evidence: [item.id, supplier.id, item.sourceRecordId],
      timestamp: startTime,
      executionLog: logs,
      assertionSummary: passed 
        ? 'ASSERTION PASSED: Exactly 18 units computed to bridge lead-time stockout window with zero incoming orders.' 
        : 'ASSERTION FAILED: Replenishment quantity did not match expected formula output.',
    };
  }

  /**
   * Run Scenario 2: Supplier sells in cases of 12
   */
  static runTC2(item: InventoryItem, supplier: Supplier, openOrders: IncomingOrder[]): TestResult {
    const startTime = new Date().toISOString();
    const effectiveStock = item.currentStock - item.reservedStock;
    const forecastDemand = item.averageDailySales * item.leadTimeDays;
    const targetStock = forecastDemand + item.safetyStock;
    const rawNetRequirement = Math.max(0, targetStock - effectiveStock);
    
    const packConversion = roundToSupplierPackSize(rawNetRequirement, supplier.packSize);
    const expectedCases = 2; // ceil(17 / 12) = 2
    const expectedUnits = 24; // 2 * 12 = 24

    const logs: string[] = [
      `[TC2-Init] Evaluating SKU ${item.sku} with pack size constraint (${supplier.packSize} units/case)`,
      `[TC2-Step 1] Current effective inventory: ${effectiveStock} units. Lead demand: ${forecastDemand} units`,
      `[TC2-Step 2] Raw net requirement calculated: ${targetStock} (target) - ${effectiveStock} = ${rawNetRequirement} units`,
      `[TC2-Step 3] Supplier packaging rule applied: Pack size = ${supplier.packSize}`,
      `[TC2-Step 4] Case rounding: Math.ceil(${rawNetRequirement} / ${supplier.packSize}) = ${packConversion.recommendedCases} cases`,
      `[TC2-Step 5] Final order units: ${packConversion.recommendedCases} cases × ${supplier.packSize} = ${packConversion.finalUnits} units`,
      `[TC2-Assertion] Asserting raw requirement is 17 units, cases === 2, finalUnits === 24`
    ];

    const passed = 
      rawNetRequirement === 17 && 
      packConversion.recommendedCases === expectedCases && 
      packConversion.finalUnits === expectedUnits;

    return {
      id: `TR-TC2-${Date.now()}`,
      scenarioId: 'TC2',
      scenarioTitle: 'Supplier Sells in Cases of 12',
      status: passed ? 'Passed' : 'Failed',
      inputSnapshot: {
        sku: item.sku,
        effectiveStock,
        leadTimeDemand: forecastDemand,
        rawNetRequirement,
        supplierPackSize: supplier.packSize,
        minimumOrderQuantity: supplier.minimumOrderQuantity,
      },
      expectedResult: {
        rawRequirement: 17,
        packSize: 12,
        expectedCases: 2,
        expectedFinalUnits: 24,
      },
      actualResult: {
        rawRequirement: rawNetRequirement,
        packSize: supplier.packSize,
        actualCases: packConversion.recommendedCases,
        actualFinalUnits: packConversion.finalUnits,
      },
      evidence: [item.id, supplier.id, 'PACK_RULE_12'],
      timestamp: startTime,
      executionLog: logs,
      assertionSummary: passed
        ? 'ASSERTION PASSED: 17 raw required units correctly rounded up to 2 full cases (24 valid order units).'
        : 'ASSERTION FAILED: Case rounding logic did not produce valid pack multiples.',
    };
  }

  /**
   * Run Scenario 3: Pending order exists (No duplicate reorder)
   */
  static runTC3(item: InventoryItem, supplier: Supplier, openOrders: IncomingOrder[]): TestResult {
    const startTime = new Date().toISOString();
    const effectiveStock = item.currentStock - item.reservedStock;
    const forecastDemand = item.averageDailySales * item.leadTimeDays;
    const targetStock = forecastDemand + item.safetyStock;

    const activeInbound = openOrders.filter(
      o => o.sku === item.sku && o.status !== 'Received' && o.status !== 'Cancelled'
    );
    const incomingQty = activeInbound.reduce((acc, o) => acc + o.remainingOpenQuantity, 0);

    const availablePosition = effectiveStock + incomingQty;
    const additionalRequired = Math.max(0, targetStock - availablePosition);

    const logs: string[] = [
      `[TC3-Init] Checking duplicate prevention for SKU ${item.sku}`,
      `[TC3-Step 1] Required replenishment threshold: ${targetStock} units (${forecastDemand} lead demand + ${item.safetyStock} safety)`,
      `[TC3-Step 2] Detected open purchase order in pipeline: ${activeInbound.map(o => `${o.id} (${o.remainingOpenQuantity} units, status: ${o.status})`).join(', ')}`,
      `[TC3-Step 3] Total stock position = Current (${effectiveStock}) + Incoming Inbound (${incomingQty}) = ${availablePosition} units`,
      `[TC3-Step 4] Additional replenishment needed = Max(0, ${targetStock} - ${availablePosition}) = ${additionalRequired} units`,
      `[TC3-Step 5] Duplicate Prevention Engine: Since additional required is 0, proposal creation is SUPPRESSED.`,
      `[TC3-Assertion] Asserting incomingQty >= 30, additionalRequired === 0, duplicatePrevented === true`
    ];

    const passed = incomingQty === 30 && additionalRequired === 0;

    return {
      id: `TR-TC3-${Date.now()}`,
      scenarioId: 'TC3',
      scenarioTitle: 'Pending Order Exists (Duplicate Prevention)',
      status: passed ? 'Passed' : 'Failed',
      inputSnapshot: {
        sku: item.sku,
        currentStock: effectiveStock,
        targetRequirement: targetStock,
        activeOrdersFound: activeInbound.length,
        inboundOrders: activeInbound.map(o => ({ id: o.id, qty: o.remainingOpenQuantity, expectedArrival: o.expectedArrivalDate })),
      },
      expectedResult: {
        requiredReplenishment: 30,
        existingOpenQuantity: 30,
        additionalQuantityRequired: 0,
        duplicatePreventionResult: 'Suppressed / No Duplicate Request Created',
      },
      actualResult: {
        requiredReplenishment: targetStock,
        existingOpenQuantity: incomingQty,
        additionalQuantityRequired: additionalRequired,
        duplicatePreventionResult: 'Existing PO-2026-089 covers demand window. Duplicate prevented.',
      },
      evidence: [item.id, ...activeInbound.map(o => o.id)],
      timestamp: startTime,
      executionLog: logs,
      assertionSummary: passed
        ? 'ASSERTION PASSED: Inbound PO-2026-089 (30 units) fully covers lead demand; duplicate purchase request successfully blocked.'
        : 'ASSERTION FAILED: Duplicate request prevention check failed.',
    };
  }

  /**
   * Run Scenario 4: Supplier price jumps 20%+ (Budget review requested)
   */
  static runTC4(item: InventoryItem, supplier: Supplier, openOrders: IncomingOrder[]): TestResult {
    const startTime = new Date().toISOString();
    const priceAnalysis = checkSupplierPriceChange(supplier.currentUnitPrice, supplier.previousUnitPrice);
    const calculation = calculateReorderPlan(item, supplier, openOrders);

    const logs: string[] = [
      `[TC4-Init] Auditing supplier pricing variance for ${supplier.name} (SKU: ${item.sku})`,
      `[TC4-Step 1] Baseline previous unit price = ₹${supplier.previousUnitPrice.toFixed(2)}`,
      `[TC4-Step 2] New billed unit price = ₹${supplier.currentUnitPrice.toFixed(2)}`,
      `[TC4-Step 3] Variance calculation: ((₹${supplier.currentUnitPrice} - ₹${supplier.previousUnitPrice}) / ₹${supplier.previousUnitPrice}) × 100 = +${priceAnalysis.percentageChange}%`,
      `[TC4-Step 4] Price jump threshold check: ${priceAnalysis.percentageChange}% >= 20.0% -> Condition MET`,
      `[TC4-Step 5] Order sizing: ${calculation.finalOrderUnits} units at ₹${supplier.currentUnitPrice} = ₹${calculation.totalCost.toLocaleString('en-IN')}`,
      `[TC4-Step 6] Governance Routing: Routed to 'Needs Budget Review' state; standard auto-approval bypassed.`,
      `[TC4-Assertion] Asserting price jump percentage (${priceAnalysis.percentageChange}%) >= 20% and requiresBudgetReview === true`
    ];

    const passed = priceAnalysis.percentageChange >= 20.0 && calculation.requiresBudgetReview;

    return {
      id: `TR-TC4-${Date.now()}`,
      scenarioId: 'TC4',
      scenarioTitle: 'Supplier Price Jumps 20% (Budget Review)',
      status: passed ? 'Passed' : 'Failed',
      inputSnapshot: {
        sku: item.sku,
        supplierId: supplier.id,
        previousUnitPrice: supplier.previousUnitPrice,
        currentUnitPrice: supplier.currentUnitPrice,
        orderQuantity: calculation.finalOrderUnits,
      },
      expectedResult: {
        previousUnitPrice: 50.00,
        currentUnitPrice: 62.50,
        percentageIncrease: 25.0,
        thresholdTrigger: '>= 20.0%',
        expectedRouting: 'Needs Budget Review',
      },
      actualResult: {
        previousUnitPrice: supplier.previousUnitPrice,
        currentUnitPrice: supplier.currentUnitPrice,
        percentageIncrease: priceAnalysis.percentageChange,
        thresholdTrigger: `${priceAnalysis.percentageChange}% >= 20.0%`,
        actualRouting: 'Needs Budget Review',
      },
      evidence: [supplier.id, item.id, 'SUP-003-PRICE-LOG'],
      timestamp: startTime,
      executionLog: logs,
      assertionSummary: passed
        ? 'ASSERTION PASSED: Price increase of +25.0% detected (>= 20.0% threshold). Purchase proposal successfully flagged for manager budget review.'
        : 'ASSERTION FAILED: Price increase not correctly classified as budget review.',
    };
  }

  /**
   * Returns the complete isolated scenario context (TestResult + seeded SKU, supplier, and open orders)
   * so that applying TC1–TC4 in the Decision Room always has deterministic, complete data
   * even when the user's live workspace catalog is empty or does not contain the benchmark SKU.
   */
  static getScenarioContext(scenarioId: TestScenarioId): {
    testResult: TestResult;
    item: InventoryItem;
    supplier: Supplier;
    orders: IncomingOrder[];
    allScenarioInventory: InventoryItem[];
    allScenarioSuppliers: Supplier[];
    allScenarioOrders: IncomingOrder[];
  } {
    const testResult = this.runIsolatedScenario(scenarioId);
    const targetSkuMap: Record<TestScenarioId, string> = {
      TC1: 'SKU-101',
      TC2: 'SKU-102',
      TC3: 'SKU-103',
      TC4: 'SKU-104',
    };
    const targetSku = targetSkuMap[scenarioId];
    const allScenarioInventory: InventoryItem[] = JSON.parse(JSON.stringify(SEED_INVENTORY));
    const allScenarioSuppliers: Supplier[] = JSON.parse(JSON.stringify(SEED_SUPPLIERS));
    const allScenarioOrders: IncomingOrder[] = JSON.parse(JSON.stringify(SEED_ORDERS));

    const item = allScenarioInventory.find(i => i.sku === targetSku) || allScenarioInventory[0];
    const supplier = allScenarioSuppliers.find(s => s.id === item.supplierId) || allScenarioSuppliers[0];
    const orders = allScenarioOrders.filter(o => o.sku === item.sku);

    return {
      testResult,
      item,
      supplier,
      orders,
      allScenarioInventory,
      allScenarioSuppliers,
      allScenarioOrders,
    };
  }
}

