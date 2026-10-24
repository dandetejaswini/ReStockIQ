export type StockStatus = 
  | 'Healthy' 
  | 'Low Stock' 
  | 'Critical' 
  | 'Stockout Risk' 
  | 'Out of Stock' 
  | 'Needs Review';

export interface SalesHistoryPoint {
  date: string;
  units: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplierId: string;
  currentStock: number;
  reservedStock: number;
  averageDailySales: number;
  salesHistory: SalesHistoryPoint[];
  leadTimeDays: number;
  safetyStock: number;
  reorderThreshold: number;
  unitPrice: number; // In INR
  updatedAt: string;
  sourceType: 'MOCK' | 'MANUAL_ENTRY' | 'CSV_IMPORT';
  sourceRecordId: string;
}

export interface SupplierPricePoint {
  date: string;
  price: number;
}

export interface SupplierContact {
  email: string;
  phone: string;
  representative: string;
  address: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactInformation: SupplierContact;
  leadTimeDays: number;
  packSize: number; // e.g., 1 or 12 for cases
  minimumOrderQuantity: number;
  currentUnitPrice: number; // In INR
  previousUnitPrice: number; // In INR
  priceHistory: SupplierPricePoint[];
  status: 'Active' | 'Under Review' | 'Inactive';
}

export type OrderStatus = 'Ordered' | 'In Transit' | 'Delayed' | 'Received' | 'Cancelled';

export interface IncomingOrder {
  id: string;
  sku: string;
  supplierId: string;
  orderedQuantity: number;
  remainingOpenQuantity: number;
  expectedArrivalDate: string;
  status: OrderStatus;
  sourceRecordId: string;
  orderDate: string;
}

export type ReorderRequestStatus = 
  | 'Draft' 
  | 'Pending Approval' 
  | 'Approved' 
  | 'Rejected' 
  | 'Needs Budget Review' 
  | 'Submitted' 
  | 'Verified' 
  | 'Failed' 
  | 'Needs Review';

export type BudgetStatus = 'Normal' | 'Exceeds Budget' | 'Price Increase Review';

export interface ReorderRequest {
  id: string;
  sku: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  proposedQuantity: number; // in units
  caseCount: number; // packSize converted
  unitPrice: number;
  totalCost: number;
  forecastDemand: number;
  incomingQuantityConsidered: number;
  reason: string;
  budgetStatus: BudgetStatus;
  status: ReorderRequestStatus;
  createdAt: string;
  idempotencyKey: string;
  sourceEvidenceIds: string[];
  rejectionReason?: string;
  reviewComment?: string;
}

export interface ApprovalRecord {
  id: string;
  requestId: string;
  reviewer: string;
  decision: 'Approved' | 'Rejected' | 'Needs Budget Review' | 'Returned For Changes';
  comment: string;
  timestamp: string;
  requestVersion: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: 'INVENTORY' | 'SUPPLIER' | 'ORDER' | 'REORDER_REQUEST' | 'APPROVAL' | 'TEST_RUN';
  entityId: string;
  previousState: string;
  newState: string;
  reason: string;
  evidenceIds: string[];
  executionMode: 'SIMULATED_LOCAL' | 'BACKEND_AUTHORITATIVE';
}

export type TestScenarioId = 'TC1' | 'TC2' | 'TC3' | 'TC4';
export type TestStatus = 'Not Run' | 'Running' | 'Passed' | 'Failed' | 'Needs Review';

export interface TestResult {
  id: string;
  scenarioId: TestScenarioId;
  scenarioTitle: string;
  status: TestStatus;
  inputSnapshot: Record<string, any>;
  expectedResult: Record<string, any>;
  actualResult: Record<string, any>;
  evidence: string[];
  timestamp?: string;
  executionLog?: string[];
  assertionSummary?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  isDemoUser: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  structuredData?: {
    type?: 'stockout_summary' | 'reorder_proposal' | 'price_warning' | 'calculation_breakdown';
    sku?: string;
    details?: any;
  };
  suggestedActions?: string[];
}

export interface CalculationBreakdown {
  sku: string;
  productName: string;
  currentStock: number;
  reservedStock: number;
  effectiveStock: number;
  dailySales: number;
  leadTimeDays: number;
  forecastDemand: number;
  safetyStock: number;
  reorderThreshold: number;
  incomingOpenOrders: number;
  netRequirement: number;
  packSize: number;
  recommendedCases: number;
  finalOrderUnits: number;
  unitPrice: number;
  totalCost: number;
  isPriceJumped: boolean;
  priceJumpPercent: number;
  requiresBudgetReview: boolean;
  projectedStockoutDays: number | null;
  stockStatus: StockStatus;
  formulaSteps: {
    step: string;
    formula: string;
    values: string;
    result: string;
  }[];
}

export interface ScenarioAnalysisReport {
  scenarioId: TestScenarioId;
  title: string;
  subtitle: string;
  targetSku: string;
  productName: string;
  supplierName: string;
  status: TestStatus;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summaryVerdict: string;
  evidenceReferences: {
    id: string;
    label: string;
    detail: string;
  }[];
  identifiedRisks: string[];
  keyFindings: {
    label: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
  recommendedActions: string[];
  assumptionsAndConstraints: string[];
  recommendedOrderUnits: number;
  recommendedCases: number;
  estimatedTotalCostINR: number;
  analyzedAt: string;
}

