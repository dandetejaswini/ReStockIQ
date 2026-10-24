import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  InventoryItem, 
  Supplier, 
  IncomingOrder, 
  ReorderRequest, 
  AuditEvent, 
  TestResult, 
  User, 
  ChatMessage, 
  TestScenarioId, 
  ReorderRequestStatus 
} from '../types';
import { TestLabService } from '../services/TestLabService';
import { AgentService } from '../services/AgentService';
import { getBackendConfig } from '../services/config';
import { InventoryService } from '../services/InventoryService';
import { SupplierService } from '../services/SupplierService';
import { OrderService } from '../services/OrderService';
import { ApprovalService } from '../services/ApprovalService';
import { AuditService } from '../services/AuditService';
import { generateIdempotencyKey, calculateReorderPlan, checkSupplierPriceChange } from '../utils/reorderCalculations';
import { useAuth } from './AuthContext';
import { 
  getSupabase, 
  isSupabaseReady, 
  getCurrentUserProfile, 
  signOutUser, 
  persistInventoryItem, 
  persistSupplier,
  persistIncomingOrder,
  persistReorderRequest,
  persistRequestStatus, 
  persistAuditEvent, 
  fetchInventoryItems,
  fetchSuppliers,
  fetchIncomingOrders,
  fetchReorderRequests,
  fetchAuditEvents,
  verifySupabaseConnection,
  SupabaseConnectionStatus
} from '../services/supabaseClient';

interface AppContextType {
  currentUser: User | null;
  inventory: InventoryItem[];
  suppliers: Supplier[];
  orders: IncomingOrder[];
  requests: ReorderRequest[];
  auditEvents: AuditEvent[];
  testResults: Record<TestScenarioId, TestResult | null>;
  chatMessages: ChatMessage[];
  selectedSku: string;
  isTestRunning: boolean;
  activeNotificationsCount: number;
  isBackendConfigured: boolean;
  isSupabaseLiveConnected: boolean;
  supabaseConnectionStatus: SupabaseConnectionStatus;
  supabaseVerifiedAt: string | null;
  supabaseConfigError: string | null;
  migrationNotice: string | null;
  isOnboardingPreview: boolean;
  recheckSupabaseConnection: () => Promise<void>;
  // Actions
  setSelectedSku: (sku: string) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  importInventoryCsv: (items: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>[]) => void;
  addSupplier: (supplier: Omit<Supplier, 'id'> & { id?: string }) => void;
  addIncomingOrder: (order: Omit<IncomingOrder, 'id' | 'sourceRecordId'> & { id?: string }) => void;
  createReorderProposal: (sku: string, reason?: string) => { success: boolean; message: string; request?: ReorderRequest };
  updateRequestStatus: (
    requestId: string, 
    newStatus: ReorderRequestStatus, 
    comment?: string
  ) => boolean;
  runScenario: (scenarioId: TestScenarioId) => TestResult;
  runAllScenarios: () => void;
  activeScenario: TestResult | null;
  setActiveScenario: (scenario: TestResult | null) => void;
  applyScenarioToDecisionRoom: (scenarioId: TestScenarioId) => TestResult;
  resetAllSeedData: () => void;
  resetTestLab: () => void;
  sendAgentMessage: (text: string) => void;
  clearChat: () => void;
  loginUser: (email: string, name?: string, startEmpty?: boolean) => void;
  logoutUser: () => void;
  clearInventory: () => void;
  loadDemoBaseline: () => void;
  toggleOnboardingPreview: () => void;
  receiveIncomingOrder: (orderId: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const createInitialMessages = (): ChatMessage[] => [
  {
    id: 'MSG-INIT-1',
    sender: 'agent',
    timestamp: new Date().toISOString(),
    text: `### Meet ReStockIQ Copilot\n\n**Predict Shortages. Prevent Stockouts.** Meet ReStockIQ Copilot — your AI-powered inventory intelligence and supply-chain optimization assistant.\n\nI assess lead-time stockout exposures, convert raw shortages into supplier pack multiples, factor in open pipeline orders, verify budget safety from your real store records, and execute full **TC1–TC4** scenario analyses in the Decision Room.`,
    suggestedActions: [
      'Which products need replenishment?',
      'Summarize the current low-stock items.',
      'What inventory risks should I review today?',
      'Which incoming orders already cover demand?',
    ],
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userProfile } = useAuth();

  // Production state starts strictly empty — zero dummy or demo records
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [requests, setRequests] = useState<ReorderRequest[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [isOnboardingPreview, setIsOnboardingPreview] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<TestResult | null>(null);

  const [testResults, setTestResults] = useState<Record<TestScenarioId, TestResult | null>>({
    TC1: null,
    TC2: null,
    TC3: null,
    TC4: null,
  });

  const priceJumpCount = suppliers.filter(s => checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice).isPriceJumped).length;
  const activeNotificationsCount = requests.filter(r => r.status === 'Pending Approval' || r.status === 'Needs Budget Review').length + priceJumpCount;

  const [supabaseConfigError, setSupabaseConfigError] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [supabaseConnectionStatus, setSupabaseConnectionStatus] = useState<SupabaseConnectionStatus>(() => {
    const cfg = getBackendConfig();
    if (cfg.isMisconfigured) return 'config_error';
    if (!cfg.isSupabaseConfigured) return 'unconfigured';
    return 'checking';
  });
  const [supabaseVerifiedAt, setSupabaseVerifiedAt] = useState<string | null>(null);

  const clearAllSessionData = () => {
    InventoryService.clearState();
    SupplierService.clearState();
    OrderService.clearState();
    ApprovalService.clearState();
    AuditService.clearState();
    setInventory([]);
    setSuppliers([]);
    setOrders([]);
    setRequests([]);
    setAuditEvents([]);
    setSelectedSku('');
    setActiveScenario(null);
    setChatMessages(createInitialMessages());
    setTestResults({ TC1: null, TC2: null, TC3: null, TC4: null });
  };

  const recheckSupabaseConnection = async () => {
    const cfg = getBackendConfig();
    if (cfg.isMisconfigured) {
      setSupabaseConnectionStatus('config_error');
      setSupabaseConfigError(cfg.configError || 'Invalid Supabase configuration.');
      setSupabaseVerifiedAt(new Date().toISOString());
      return;
    }
    if (!cfg.isSupabaseConfigured) {
      setSupabaseConnectionStatus('unconfigured');
      setSupabaseConfigError(null);
      setSupabaseVerifiedAt(new Date().toISOString());
      return;
    }

    setSupabaseConnectionStatus('checking');
    const health = await verifySupabaseConnection();
    setSupabaseConnectionStatus(health.status);
    setSupabaseVerifiedAt(health.verifiedAt);

    if (health.status === 'connected') {
      setSupabaseConfigError(null);
      if (health.migrationRequired) {
        setMigrationNotice(
          'PostgreSQL database tables not detected. Please run the SQL migrations in the Supabase SQL Editor to activate live storage.'
        );
      } else {
        setMigrationNotice(null);
      }
      await loadAuthorizedBackendData();
    } else if (health.error) {
      setSupabaseConfigError(health.error);
    }
  };

  const loadAuthorizedBackendData = async () => {
    const cfg = getBackendConfig();
    if (cfg.isMisconfigured) {
      setSupabaseConnectionStatus('config_error');
      setSupabaseConfigError(cfg.configError);
      return;
    }
    if (!isSupabaseReady()) {
      setSupabaseConnectionStatus('unconfigured');
      setSupabaseConfigError(null);
      return;
    }

    const [invRes, supRes, ordRes, reqRes, audRes] = await Promise.all([
      fetchInventoryItems(),
      fetchSuppliers(),
      fetchIncomingOrders(),
      fetchReorderRequests(),
      fetchAuditEvents(),
    ]);

    if (invRes.error) {
      if (invRes.migrationRequired) {
        setSupabaseConnectionStatus('connected');
        setSupabaseConfigError(null);
        setMigrationNotice(invRes.error);
      } else {
        setSupabaseConnectionStatus('config_error');
        setSupabaseConfigError(invRes.error);
      }
    } else if (invRes.isConnected) {
      setSupabaseConnectionStatus('connected');
      setSupabaseConfigError(null);
      setSupabaseVerifiedAt(new Date().toISOString());
      if (invRes.migrationRequired) {
        setMigrationNotice(
          'PostgreSQL database tables not detected. Please run the SQL migrations in the Supabase SQL Editor to activate live storage.'
        );
      } else {
        setMigrationNotice(null);
      }
      setInventory(invRes.items);
      if (invRes.items.length > 0) {
        setSelectedSku(prev => prev || invRes.items[0].sku);
      }
    }

    if (!supRes.error) setSuppliers(supRes.suppliers);
    if (!ordRes.error) setOrders(ordRes.orders);
    if (!reqRes.error) setRequests(reqRes.requests);
    if (!audRes.error) setAuditEvents(audRes.events);
  };

  // Sync Firebase Auth user & profile to AppContext currentUser
  useEffect(() => {
    if (firebaseUser) {
      const displayName = userProfile?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Store Procurement Lead';
      setCurrentUser({
        id: firebaseUser.uid,
        name: displayName,
        email: userProfile?.email || firebaseUser.email || '',
        role: 'Store Procurement Lead',
        avatar: userProfile?.photoURL || firebaseUser.photoURL || '',
        isDemoUser: false,
      });
      loadAuthorizedBackendData();
    } else if (!isSupabaseReady()) {
      setCurrentUser(null);
      clearAllSessionData();
    }
  }, [firebaseUser, userProfile]);

  // Supabase Session Restoration and Real-Time State Sync
  useEffect(() => {
    const config = getBackendConfig();
    if (config.isMisconfigured && config.configError) {
      setSupabaseConnectionStatus('config_error');
      setSupabaseConfigError(config.configError);
      return;
    }

    if (!config.isSupabaseConfigured) {
      setSupabaseConnectionStatus('unconfigured');
      setSupabaseConfigError(null);
      return;
    }

    if (isSupabaseReady()) {
      verifySupabaseConnection().then((health) => {
        setSupabaseConnectionStatus(health.status);
        setSupabaseVerifiedAt(health.verifiedAt);
        if (health.status === 'connected') {
          setSupabaseConfigError(null);
          if (health.migrationRequired) {
            setMigrationNotice(
              'PostgreSQL database tables not detected. Please run the SQL migrations in the Supabase SQL Editor to activate live storage.'
            );
          }
        } else if (health.error) {
          setSupabaseConfigError(health.error);
        }
      });

      getCurrentUserProfile().then(profile => {
        if (profile) {
          setCurrentUser(profile);
          loadAuthorizedBackendData();
        }
      });

      const client = getSupabase();
      if (client) {
        const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            const profile = await getCurrentUserProfile();
            if (profile) setCurrentUser(profile);
            await loadAuthorizedBackendData();
          } else if (event === 'SIGNED_OUT') {
            if (!firebaseUser) {
              setCurrentUser(null);
              clearAllSessionData();
            }
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    }
  }, []);

  const logAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp' | 'executionMode'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      executionMode: isSupabaseReady() ? 'BACKEND_AUTHORITATIVE' : 'SIMULATED_LOCAL',
    };
    setAuditEvents(prev => [newEvent, ...prev]);

    if (isSupabaseReady()) {
      persistAuditEvent(event).catch(err => {
        console.warn('Could not persist audit event to Supabase:', err);
      });
    }
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `INV-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      sourceType: 'MANUAL_ENTRY',
    };
    setInventory(prev => {
      const next = [newItem, ...prev];
      if (!selectedSku) setSelectedSku(newItem.sku);
      return next;
    });

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'INVENTORY_ITEM_CREATED',
      entityType: 'INVENTORY',
      entityId: newItem.id,
      previousState: 'None',
      newState: `Created SKU ${newItem.sku}`,
      reason: 'Inventory registration in store catalog',
      evidenceIds: [newItem.sourceRecordId],
    });

    if (isSupabaseReady()) {
      persistInventoryItem(itemData).then(res => {
        if (res.success && res.item) {
          setInventory(prev => prev.map(i => i.id === newItem.id ? res.item! : i));
        }
      }).catch(err => console.warn('Supabase inventory insert failed:', err));
    }
  };

  const updateInventoryItem = (updated: InventoryItem) => {
    const oldItem = inventory.find(i => i.id === updated.id);
    setInventory(prev => prev.map(item => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item));

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'INVENTORY_ITEM_UPDATED',
      entityType: 'INVENTORY',
      entityId: updated.id,
      previousState: `Stock: ${oldItem?.currentStock || 0}`,
      newState: `Stock: ${updated.currentStock}`,
      reason: 'Item attribute modification',
      evidenceIds: [updated.sourceRecordId],
    });

    if (isSupabaseReady()) {
      persistInventoryItem(updated).catch(err => console.warn('Supabase inventory update failed:', err));
    }
  };

  const importInventoryCsv = (imported: Omit<InventoryItem, 'id' | 'updatedAt' | 'sourceType'>[]) => {
    const createdItems: InventoryItem[] = imported.map((item, idx) => ({
      ...item,
      id: `INV-${Date.now()}-${idx}`,
      updatedAt: new Date().toISOString(),
      sourceType: 'CSV_IMPORT',
    }));

    setInventory(prev => {
      const next = [...createdItems, ...prev];
      if (!selectedSku && next.length > 0) setSelectedSku(next[0].sku);
      return next;
    });

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'CSV_IMPORT_EXECUTED',
      entityType: 'INVENTORY',
      entityId: `CSV-BATCH-${Date.now()}`,
      previousState: `${inventory.length} items`,
      newState: `${inventory.length + createdItems.length} items`,
      reason: `Imported ${createdItems.length} SKUs from CSV`,
      evidenceIds: createdItems.map(i => i.sourceRecordId),
    });

    if (isSupabaseReady()) {
      createdItems.forEach(item => {
        persistInventoryItem(item).catch(err => console.warn('Supabase CSV item persist warning:', err));
      });
    }
  };

  const addSupplier = (supplierData: Omit<Supplier, 'id'> & { id?: string }) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: supplierData.id || `SUP-${Date.now().toString().slice(-4)}`,
    };
    setSuppliers(prev => [...prev, newSupplier]);

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'SUPPLIER_CREATED',
      entityType: 'INVENTORY',
      entityId: newSupplier.id,
      previousState: 'None',
      newState: `Registered vendor ${newSupplier.name}`,
      reason: 'Vendor contract added to directory',
      evidenceIds: [newSupplier.id],
    });

    if (isSupabaseReady()) {
      persistSupplier(newSupplier).catch(err => console.warn('Supabase supplier persist warning:', err));
    }
  };

  const addIncomingOrder = (orderData: Omit<IncomingOrder, 'id' | 'sourceRecordId'> & { id?: string }) => {
    const orderId = orderData.id || `PO-${Date.now().toString().slice(-6)}`;
    const newOrder: IncomingOrder = {
      ...orderData,
      id: orderId,
      sourceRecordId: `ERP-${orderId}`,
    };
    setOrders(prev => [newOrder, ...prev]);

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'INCOMING_ORDER_CREATED',
      entityType: 'ORDER',
      entityId: newOrder.id,
      previousState: 'None',
      newState: `${newOrder.remainingOpenQuantity} units (${newOrder.status})`,
      reason: `Inbound purchase order registered for ${newOrder.sku}`,
      evidenceIds: [newOrder.id, newOrder.sku],
    });

    if (isSupabaseReady()) {
      persistIncomingOrder(newOrder).catch(err => console.warn('Supabase order persist warning:', err));
    }
  };

  const createReorderProposal = (sku: string, customReason?: string) => {
    let item = inventory.find(i => i.sku === sku);
    let supplier = item ? (suppliers.find(s => s.id === item!.supplierId) || suppliers[0]) : undefined;
    let effectiveOrders = orders;

    // Support creating proposals from an active TC1–TC4 scenario in the Decision Room
    if (!item && activeScenario) {
      const scContext = TestLabService.getScenarioContext(activeScenario.scenarioId);
      if (scContext.item.sku === sku) {
        item = scContext.item;
        supplier = scContext.supplier;
        effectiveOrders = scContext.allScenarioOrders;
      }
    }

    if (!item) {
      return { success: false, message: `SKU ${sku} not found.` };
    }

    if (!supplier) {
      return { success: false, message: `Please add a supplier for SKU ${sku} before creating a reorder proposal.` };
    }

    const today = new Date().toISOString().split('T')[0];
    const key = generateIdempotencyKey(sku, supplier.id, today);
    const existingActive = requests.find(r => 
      r.idempotencyKey === key && 
      (r.status === 'Pending Approval' || r.status === 'Needs Budget Review' || r.status === 'Draft')
    );

    if (existingActive) {
      return { 
        success: false, 
        message: `Duplicate prevented! An active reorder proposal (${existingActive.id}) already exists for ${sku} today.` 
      };
    }

    const plan = calculateReorderPlan(item, supplier, effectiveOrders);

    if (plan.finalOrderUnits <= 0) {
      return {
        success: false,
        message: `No reorder required for ${sku}. Current inventory and inbound orders adequately cover demand.`
      };
    }

    const newRequest: ReorderRequest = {
      id: `REQ-${Date.now().toString().slice(-6)}`,
      sku: item.sku,
      productName: item.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      proposedQuantity: plan.finalOrderUnits,
      caseCount: plan.recommendedCases,
      unitPrice: plan.unitPrice,
      totalCost: plan.totalCost,
      forecastDemand: plan.forecastDemand,
      incomingQuantityConsidered: plan.incomingOpenOrders,
      reason: customReason || `ReStockIQ Copilot generated: ${plan.finalOrderUnits} units required to cover lead time (${plan.leadTimeDays}d) and safety stock.`,
      budgetStatus: plan.requiresBudgetReview ? 'Price Increase Review' : 'Normal',
      status: plan.requiresBudgetReview ? 'Needs Budget Review' : 'Pending Approval',
      createdAt: new Date().toISOString(),
      idempotencyKey: key,
      sourceEvidenceIds: [item.id, item.sourceRecordId, supplier.id],
    };

    setRequests(prev => [newRequest, ...prev]);

    logAuditEvent({
      actor: currentUser?.name || 'ReStockIQ Copilot',
      action: 'REORDER_REQUEST_CREATED',
      entityType: 'REORDER_REQUEST',
      entityId: newRequest.id,
      previousState: 'None',
      newState: newRequest.status,
      reason: newRequest.reason,
      evidenceIds: newRequest.sourceEvidenceIds,
    });

    if (isSupabaseReady()) {
      persistReorderRequest(newRequest).catch(err => console.warn('Could not persist reorder request to Supabase:', err));
    }

    return { 
      success: true, 
      message: `Reorder proposal ${newRequest.id} successfully created and sent for approval!`,
      request: newRequest,
    };
  };

  const updateRequestStatus = (
    requestId: string, 
    newStatus: ReorderRequestStatus, 
    comment?: string
  ): boolean => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return false;

    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          status: newStatus,
          reviewComment: comment || r.reviewComment,
          rejectionReason: newStatus === 'Rejected' ? (comment || 'Declined during human review') : r.rejectionReason,
        };
      }
      return r;
    }));

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Store Manager',
      action: `PURCHASE_REQUEST_${newStatus.toUpperCase().replace(/\s+/g, '_')}`,
      entityType: 'REORDER_REQUEST',
      entityId: requestId,
      previousState: target.status,
      newState: newStatus,
      reason: comment || `Manager transition to ${newStatus}`,
      evidenceIds: target.sourceEvidenceIds,
    });

    if (isSupabaseReady()) {
      persistRequestStatus(requestId, newStatus, comment).catch(err => {
        console.warn('Could not persist request status to Supabase:', err);
      });
    }

    return true;
  };

  const receiveIncomingOrder = (orderId: string): boolean => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === 'Received' || order.status === 'Cancelled') return false;

    const qtyToReceive = order.remainingOpenQuantity;
    const updatedOrder: IncomingOrder = {
      ...order,
      status: 'Received',
      remainingOpenQuantity: 0,
    };

    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

    setInventory(prev => prev.map(item => {
      if (item.sku === order.sku) {
        const nextItem = {
          ...item,
          currentStock: item.currentStock + qtyToReceive,
          updatedAt: new Date().toISOString(),
        };
        if (isSupabaseReady()) {
          persistInventoryItem(nextItem).catch(() => {});
        }
        return nextItem;
      }
      return item;
    }));

    if (isSupabaseReady()) {
      persistIncomingOrder(updatedOrder).catch(() => {});
    }

    logAuditEvent({
      actor: currentUser?.name || currentUser?.email || 'Authenticated User',
      action: 'ORDER_SHIPMENT_RECEIVED',
      entityType: 'ORDER',
      entityId: order.id,
      previousState: order.status,
      newState: 'Received',
      reason: `Shipment received and verified: +${qtyToReceive} units added to SKU ${order.sku} stock`,
      evidenceIds: [order.id, order.sourceRecordId],
    });

    return true;
  };

  const runScenario = (scenarioId: TestScenarioId): TestResult => {
    const result = TestLabService.runIsolatedScenario(scenarioId);
    setTestResults(prev => ({ ...prev, [scenarioId]: result }));

    logAuditEvent({
      actor: 'ReStockIQ Test Lab',
      action: `TEST_SCENARIO_${scenarioId}_EXECUTED`,
      entityType: 'TEST_RUN',
      entityId: result.id,
      previousState: 'Not Run',
      newState: result.status,
      reason: result.assertionSummary || 'Rule engine validation',
      evidenceIds: result.evidence,
    });

    return result;
  };

  const applyScenarioToDecisionRoom = (scenarioId: TestScenarioId): TestResult => {
    const existing = testResults[scenarioId];
    const result = existing || TestLabService.runIsolatedScenario(scenarioId);
    setTestResults(prev => ({ ...prev, [scenarioId]: result }));
    setActiveScenario(result);

    const targetSkuMap: Record<TestScenarioId, string> = {
      TC1: 'SKU-101',
      TC2: 'SKU-102',
      TC3: 'SKU-103',
      TC4: 'SKU-104',
    };
    const sku = result.inputSnapshot?.sku || targetSkuMap[scenarioId];
    setSelectedSku(sku);

    logAuditEvent({
      actor: 'ReStockIQ Copilot',
      action: `SCENARIO_${scenarioId}_APPLIED_IN_DECISION_ROOM`,
      entityType: 'TEST_RUN',
      entityId: result.id,
      previousState: 'Evidence Trace',
      newState: `Decision Room Analysis (${sku})`,
      reason: `Applied ${scenarioId} (${result.scenarioTitle}) to Decision Room for full evidence-backed analysis.`,
      evidenceIds: result.evidence,
    });

    return result;
  };

  const runAllScenarios = () => {
    setIsTestRunning(true);
    setTimeout(() => {
      runScenario('TC1');
      runScenario('TC2');
      runScenario('TC3');
      runScenario('TC4');
      setIsTestRunning(false);
    }, 400);
  };

  const resetAllSeedData = () => {
    clearAllSessionData();
  };

  const resetTestLab = () => {
    setTestResults({ TC1: null, TC2: null, TC3: null, TC4: null });
    setActiveScenario(null);
  };

  const sendAgentMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: `MSG-USER-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const agentMsg = AgentService.processMessage(
        text,
        inventory,
        suppliers,
        orders,
        requests,
        activeScenario?.scenarioId || null
      );
      setChatMessages(prev => [...prev, agentMsg]);
    }, 250);
  };

  const clearChat = () => {
    setChatMessages(createInitialMessages());
  };

  const loginUser = (email: string, name?: string) => {
    setCurrentUser({
      id: firebaseUser?.uid || `USR-${Date.now().toString().slice(-4)}`,
      name: name || email.split('@')[0] || 'Store Procurement Lead',
      email,
      role: 'Store Procurement Lead',
      avatar: userProfile?.photoURL || firebaseUser?.photoURL || '',
      isDemoUser: false,
    });
  };

  const clearInventory = () => {
    clearAllSessionData();
  };

  const loadDemoBaseline = () => {
    // Removed demo data loading from production usage
  };

  const toggleOnboardingPreview = () => {
    setIsOnboardingPreview(prev => !prev);
  };

  const logoutUser = () => {
    if (isSupabaseReady()) {
      signOutUser().catch(() => {});
    }
    setCurrentUser(null);
    clearAllSessionData();
  };

  const isSupabaseLiveConnected = supabaseConnectionStatus === 'connected';
  const isBackendConfigured =
    getBackendConfig().isSupabaseConfigured &&
    supabaseConnectionStatus !== 'config_error' &&
    supabaseConnectionStatus !== 'connection_failed' &&
    !supabaseConfigError;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        inventory,
        suppliers,
        orders,
        requests,
        auditEvents,
        testResults,
        chatMessages,
        selectedSku,
        isTestRunning,
        activeNotificationsCount,
        isBackendConfigured,
        isSupabaseLiveConnected,
        supabaseConnectionStatus,
        supabaseVerifiedAt,
        supabaseConfigError,
        migrationNotice,
        isOnboardingPreview,
        recheckSupabaseConnection,
        setSelectedSku,
        addInventoryItem,
        updateInventoryItem,
        importInventoryCsv,
        addSupplier,
        addIncomingOrder,
        createReorderProposal,
        updateRequestStatus,
        runScenario,
        runAllScenarios,
        activeScenario,
        setActiveScenario,
        applyScenarioToDecisionRoom,
        resetAllSeedData,
        resetTestLab,
        sendAgentMessage,
        clearChat,
        loginUser,
        logoutUser,
        clearInventory,
        loadDemoBaseline,
        toggleOnboardingPreview,
        receiveIncomingOrder,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
