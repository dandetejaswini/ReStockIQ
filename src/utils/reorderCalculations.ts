import { 
  InventoryItem, 
  Supplier, 
  IncomingOrder, 
  StockStatus, 
  CalculationBreakdown, 
  BudgetStatus 
} from '../types';

/**
 * Forecast demand during supplier lead time
 * Formula: Daily Sales * Lead Time (days)
 */
export function forecastDemandDuringLeadTime(dailySales: number, leadTimeDays: number): number {
  return Math.round(dailySales * leadTimeDays);
}

/**
 * Projected days until stockout
 * Formula: Effective Stock / Daily Sales
 */
export function calculateDaysUntilStockout(effectiveStock: number, dailySales: number): number | null {
  if (dailySales <= 0) return null;
  const days = effectiveStock / dailySales;
  return Math.max(0, parseFloat(days.toFixed(1)));
}

/**
 * Assess stock health status accurately without confusing low stock with full stockout
 */
export function assessStockStatus(
  currentStock: number, 
  reservedStock: number, 
  dailySales: number, 
  leadTimeDays: number, 
  safetyStock: number,
  incomingOpenOrders: number
): StockStatus {
  const effectiveStock = Math.max(0, currentStock - reservedStock);
  
  if (effectiveStock <= 0 && incomingOpenOrders <= 0) {
    return 'Out of Stock';
  }

  const demandDuringLeadTime = dailySales * leadTimeDays;
  const targetStock = demandDuringLeadTime + safetyStock;
  const totalAvailableAndInbound = effectiveStock + incomingOpenOrders;

  // 1. Critical: Even with eligible inbound orders, supply cannot meet demand during lead time
  if (totalAvailableAndInbound < demandDuringLeadTime) {
    return 'Critical';
  }

  // 2. Stockout Risk: Total position falls short of the target stock (lead demand + safety buffer)
  if (totalAvailableAndInbound < targetStock) {
    return 'Stockout Risk';
  }

  // 3. Inbound covered: Effective stock is low but active pipeline delivery covers the requirement
  if (effectiveStock < targetStock && totalAvailableAndInbound >= targetStock) {
    return 'Healthy';
  }

  // 4. Low stock: Effective stock alone is below safety buffer + immediate threshold
  if (effectiveStock <= safetyStock + (dailySales * 2)) {
    return 'Low Stock';
  }

  return 'Healthy';
}

/**
 * Check if supplier unit price has increased by 20% or more
 */
export function checkSupplierPriceChange(currentUnitPrice: number, previousUnitPrice: number): {
  isPriceJumped: boolean;
  percentageChange: number;
} {
  if (!previousUnitPrice || previousUnitPrice <= 0) {
    return { isPriceJumped: false, percentageChange: 0 };
  }

  const diff = currentUnitPrice - previousUnitPrice;
  const percentage = (diff / previousUnitPrice) * 100;
  const isJumped = percentage >= 20;

  return {
    isPriceJumped: isJumped,
    percentageChange: parseFloat(percentage.toFixed(1))
  };
}

/**
 * Round raw units requirement to supplier pack size (cases)
 * Formula: ceil(rawUnits / packSize) * packSize
 */
export function roundToSupplierPackSize(rawUnits: number, packSize: number, minOrderQty: number = 0): {
  recommendedCases: number;
  finalUnits: number;
} {
  if (rawUnits <= 0) {
    return { recommendedCases: 0, finalUnits: 0 };
  }

  const effectivePackSize = Math.max(1, packSize);
  let cases = Math.ceil(rawUnits / effectivePackSize);
  let totalUnits = cases * effectivePackSize;

  if (minOrderQty > 0 && totalUnits < minOrderQty) {
    cases = Math.ceil(minOrderQty / effectivePackSize);
    totalUnits = cases * effectivePackSize;
  }

  return {
    recommendedCases: cases,
    finalUnits: totalUnits
  };
}

/**
 * Generate reproducible idempotency key to prevent duplicate reorders for the same item/cycle
 */
export function generateIdempotencyKey(sku: string, supplierId: string, cycleDate: string): string {
  const cleanDate = cycleDate.split('T')[0];
  return `ORD-${sku}-${supplierId}-${cleanDate}`;
}

/**
 * Full explainable reorder calculation engine
 */
export function calculateReorderPlan(
  item: InventoryItem,
  supplier: Supplier,
  openOrders: IncomingOrder[] = [],
  availableBudget: number = 250000
): CalculationBreakdown {
  const effectiveStock = Math.max(0, item.currentStock - item.reservedStock);
  const forecastDemand = forecastDemandDuringLeadTime(item.averageDailySales, item.leadTimeDays);
  
  // Sum open incoming orders that are NOT yet received or cancelled
  const incomingOpenOrders = openOrders
    .filter(o => o.sku === item.sku && o.status !== 'Received' && o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.remainingOpenQuantity, 0);

  const stockStatus = assessStockStatus(
    item.currentStock,
    item.reservedStock,
    item.averageDailySales,
    item.leadTimeDays,
    item.safetyStock,
    incomingOpenOrders
  );

  const daysUntilStockout = calculateDaysUntilStockout(effectiveStock, item.averageDailySales);

  // Raw replenishment required:
  // Target Stock = (Forecast Demand during Lead Time) + Safety Stock
  // Available Stock Position = Effective Stock + Incoming Open Orders
  // Net Requirement = Max(0, Target Stock - Available Stock Position)
  const targetStock = forecastDemand + item.safetyStock;
  const currentPosition = effectiveStock + incomingOpenOrders;
  const rawNetRequirement = Math.max(0, targetStock - currentPosition);

  // Pack size conversion
  const packSize = supplier.packSize || 1;
  const { recommendedCases, finalUnits } = roundToSupplierPackSize(
    rawNetRequirement,
    packSize,
    supplier.minimumOrderQuantity
  );

  const unitPrice = supplier.currentUnitPrice || item.unitPrice;
  const totalCost = finalUnits * unitPrice;

  // Price jump check
  const priceCheck = checkSupplierPriceChange(supplier.currentUnitPrice, supplier.previousUnitPrice);
  const requiresBudgetReview = priceCheck.isPriceJumped || totalCost > availableBudget;

  const formulaSteps = [
    {
      step: '1. Effective Stock Available',
      formula: 'Current Stock - Reserved Stock',
      values: `${item.currentStock} - ${item.reservedStock}`,
      result: `${effectiveStock} units`
    },
    {
      step: '2. Forecast Lead-Time Demand',
      formula: 'Average Daily Sales × Supplier Lead Time',
      values: `${item.averageDailySales} units/day × ${item.leadTimeDays} days`,
      result: `${forecastDemand} units`
    },
    {
      step: '3. Inbound Pipeline Credit',
      formula: 'Sum of Active Incoming Orders (Open Qty)',
      values: openOrders.filter(o => o.sku === item.sku && o.status !== 'Received' && o.status !== 'Cancelled').map(o => `${o.id}: ${o.remainingOpenQuantity}u`).join(', ') || 'None',
      result: `${incomingOpenOrders} units`
    },
    {
      step: '4. Raw Net Requirement',
      formula: 'Max(0, (Forecast Demand + Safety Stock) - (Effective Stock + Inbound))',
      values: `Max(0, (${forecastDemand} + ${item.safetyStock}) - (${effectiveStock} + ${incomingOpenOrders})) = Max(0, ${targetStock} - ${currentPosition})`,
      result: `${rawNetRequirement} units`
    },
    {
      step: '5. Pack-Size Alignment',
      formula: 'Ceil(Raw Requirement / Supplier Pack Size) × Pack Size',
      values: `Ceil(${rawNetRequirement} / ${packSize}) × ${packSize}`,
      result: `${recommendedCases} cases (${finalUnits} units)`
    },
    {
      step: '6. Financial & Budget Validation',
      formula: 'Final Units × Current Supplier Unit Price',
      values: `${finalUnits} units × ₹${unitPrice}${priceCheck.isPriceJumped ? ` (+${priceCheck.percentageChange}% jump over ₹${supplier.previousUnitPrice})` : ''}`,
      result: `₹${totalCost.toLocaleString('en-IN')}`
    }
  ];

  return {
    sku: item.sku,
    productName: item.name,
    currentStock: item.currentStock,
    reservedStock: item.reservedStock,
    effectiveStock,
    dailySales: item.averageDailySales,
    leadTimeDays: item.leadTimeDays,
    forecastDemand,
    safetyStock: item.safetyStock,
    reorderThreshold: item.reorderThreshold,
    incomingOpenOrders,
    netRequirement: rawNetRequirement,
    packSize,
    recommendedCases,
    finalOrderUnits: finalUnits,
    unitPrice,
    totalCost,
    isPriceJumped: priceCheck.isPriceJumped,
    priceJumpPercent: priceCheck.percentageChange,
    requiresBudgetReview,
    projectedStockoutDays: daysUntilStockout,
    stockStatus,
    formulaSteps
  };
}
