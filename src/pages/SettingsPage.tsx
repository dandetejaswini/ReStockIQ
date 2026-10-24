import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings, 
  User, 
  Sliders, 
  Bell, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  Database, 
  Bot, 
  Key, 
  Lock,
  Layers,
  Server,
  AlertTriangle,
  Mail,
  Clock,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { getBackendConfig, CANONICAL_SUPABASE_URL } from '../services/config';
import { 
  fetchUserEmailPreferences, 
  saveUserEmailPreferences, 
  retryWelcomeEmail,
  fetchEmailAutomationStatus,
  EmailAutomationStatusResponse,
  EmailDeliveryLogItem, 
  EmailQueueItem 
} from '../services/emailAutomationService';

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    currentUser, 
    resetAllSeedData, 
    clearChat, 
    inventory, 
    suppliers, 
    orders, 
    requests,
    isSupabaseLiveConnected,
    supabaseConnectionStatus,
    supabaseVerifiedAt,
    supabaseConfigError,
    recheckSupabaseConnection
  } = useApp();

  const { firebaseUser, userProfile } = useAuth();
  const backendConfig = getBackendConfig();

  const initialTabParam = searchParams.get('tab');
  const validTabs = ['profile', 'inventory', 'notifications', 'supabase'] as const;
  const [activeTab, setActiveTab] = useState<'profile' | 'inventory' | 'notifications' | 'supabase' | 'demo'>(
    validTabs.includes(initialTabParam as any) ? (initialTabParam as any) : 'inventory'
  );
  const [isRecheckingSupabase, setIsRecheckingSupabase] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam as any) && tabParam !== activeTab) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: 'profile' | 'inventory' | 'notifications' | 'supabase') => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const handleRecheckConnection = async () => {
    setIsRecheckingSupabase(true);
    try {
      await recheckSupabaseConnection();
    } finally {
      setIsRecheckingSupabase(false);
    }
  };

  const [forecastHorizon, setForecastHorizon] = useState('7');
  const [pageSize, setPageSize] = useState('8');
  const [currency, setCurrency] = useState('INR');
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [priceChangeAlerts, setPriceChangeAlerts] = useState(true);
  const [approvalAlerts, setApprovalAlerts] = useState(true);
  const [dailyInventoryAlerts, setDailyInventoryAlerts] = useState(true);
  const [weeklyBriefing, setWeeklyBriefing] = useState(true);
  const [alertFrequency, setAlertFrequency] = useState<'INSTANT' | 'DAILY_DIGEST' | 'WEEKLY'>('INSTANT');
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isRetryingWelcome, setIsRetryingWelcome] = useState(false);
  const [notificationSyncMessage, setNotificationSyncMessage] = useState<string | null>(null);
  const [notificationSyncError, setNotificationSyncError] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<EmailDeliveryLogItem[]>([]);
  const [emailQueueItems, setEmailQueueItems] = useState<EmailQueueItem[]>([]);
  const [emailAutomationStatus, setEmailAutomationStatus] = useState<EmailAutomationStatusResponse | null>(null);

  const [isConfirmingSeedReset, setIsConfirmingSeedReset] = useState(false);
  const [isConfirmingChatReset, setIsConfirmingChatReset] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const loadEmailPreferencesAndQueue = async () => {
    if (!firebaseUser) return;
    const [res, statusRes] = await Promise.all([
      fetchUserEmailPreferences(firebaseUser),
      fetchEmailAutomationStatus(false),
    ]);
    if (statusRes) {
      setEmailAutomationStatus(statusRes);
    }
    if (res.success && res.preferences) {
      setLowStockAlerts(res.preferences.stockout_alerts);
      setPriceChangeAlerts(res.preferences.price_change_alerts);
      setApprovalAlerts(res.preferences.pending_approval_digest);
      setDailyInventoryAlerts(res.preferences.daily_inventory_alerts ?? true);
      setWeeklyBriefing(res.preferences.weekly_briefing ?? true);
      setAlertFrequency(res.preferences.frequency || 'INSTANT');
      setNotificationSyncError(null);
    } else if (res.migrationRequired && res.error) {
      setNotificationSyncError(res.error);
    }
    if (res.deliveryLogs) setDeliveryLogs(res.deliveryLogs);
    if (res.emailQueue) setEmailQueueItems(res.emailQueue);
  };

  useEffect(() => {
    let isMounted = true;
    if (firebaseUser) {
      loadEmailPreferencesAndQueue().catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [firebaseUser]);

  const handleRetryWelcomeEmail = async () => {
    if (!firebaseUser || isRetryingWelcome) return;
    setIsRetryingWelcome(true);
    setNotificationSyncMessage(null);
    setNotificationSyncError(null);
    try {
      const res = await retryWelcomeEmail(firebaseUser, {
        fullName: userProfile?.displayName || firebaseUser.displayName || undefined,
        storeName: userProfile?.storeName || undefined,
      });
      await loadEmailPreferencesAndQueue();
      const dispatch = res.welcomeEmail?.webhookDispatch;
      if (dispatch?.status === 'SENT') {
        setNotificationSyncMessage('Welcome email dispatched and verified via Google Apps Script.');
      } else if (dispatch?.status === 'SKIPPED') {
        setNotificationSyncMessage(dispatch.reason || 'Welcome email was already delivered to this account.');
      } else if (dispatch?.status === 'PENDING_POLLER') {
        setNotificationSyncMessage(
          dispatch.reason ||
            'Welcome email is queued in Supabase (PENDING). Configure STOCKPILOT_APPS_SCRIPT_URL and STOCKPILOT_APPS_SCRIPT_SECRET in Vercel for instant webhook dispatch, or wait for the 5-minute Apps Script queue trigger.'
        );
      } else if (dispatch?.status === 'FAILED') {
        setNotificationSyncError(
          dispatch.reason || 'Welcome email webhook dispatch failed. Check Apps Script configuration.'
        );
      } else if (res.success) {
        setNotificationSyncMessage('Welcome email queue synchronized.');
      } else {
        setNotificationSyncError(res.error || 'Could not retry welcome email.');
      }
    } finally {
      setIsRetryingWelcome(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleSaveEmailNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotifications(true);
    setNotificationSyncMessage(null);
    setNotificationSyncError(null);

    const res = await saveUserEmailPreferences(firebaseUser, {
      stockout_alerts: lowStockAlerts,
      price_change_alerts: priceChangeAlerts,
      pending_approval_digest: approvalAlerts,
      daily_inventory_alerts: dailyInventoryAlerts,
      weekly_briefing: weeklyBriefing,
      frequency: alertFrequency,
    });

    setIsSavingNotifications(false);
    if (res.success) {
      setSaveToast(true);
      setNotificationSyncMessage('Email notification preferences saved to Supabase (user_email_preferences).');
      setTimeout(() => setSaveToast(false), 2500);
    } else {
      setNotificationSyncError(res.error || 'Could not persist email preferences to Supabase.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl w-full min-w-0 mx-auto py-2 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E7E0D8]">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-normal tracking-tight text-[#46362F]">
            Workspace Settings
          </h1>
          <p className="text-xs text-[#6B625B] mt-0.5">
            Configure local inventory thresholds, currency formatting, alert preferences, and Supabase backend.
          </p>
        </div>

        {saveToast && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#8A9A83] bg-[#8A9A83]/10 border border-[#8A9A83]/30 rounded w-fit">
            <CheckCircle2 className="w-4 h-4 text-[#8A9A83]" />
            <span>Preferences Saved</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg w-full sm:w-fit">
        <button
          type="button"
          onClick={() => handleSelectTab('inventory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'inventory' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inventory Rules</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('notifications')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'notifications' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Alerts</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('supabase')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'supabase' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Supabase & RLS</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('profile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'bg-[#46362F] text-white shadow-2xs' : 'text-[#6B625B] hover:text-[#46362F]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>
      </div>

      {activeTab === 'inventory' && (
        <form onSubmit={handleSavePreferences} className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-[#46362F]">Replenishment & Forecasting Preferences</h2>
            <p className="text-[11px] text-[#6B625B] mt-0.5">Parameters controlling how lead-time formulas and tables display.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Forecast Horizon Window</label>
              <select
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(e.target.value)}
                className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
              >
                <option value="7">7 Days (Weekly Standard Cycle)</option>
                <option value="14">14 Days (Bi-weekly Horizon)</option>
                <option value="30">30 Days (Monthly Run-rate)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#46362F] mb-1">Active Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
              >
                <option value="INR">Indian Rupee (₹ INR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#46362F] mb-1">Table Page Size</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
              >
                <option value="8">8 rows per page</option>
                <option value="15">15 rows per page</option>
                <option value="25">25 rows per page</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#46362F] mb-1">Supplier Price Jump Trigger</label>
              <input
                type="text"
                disabled
                value="20.0% (Safety Invariant)"
                className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#6B625B] cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#E7E0D8] flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-xs transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </form>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6 text-xs">
          <form onSubmit={handleSaveEmailNotifications} className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#46362F]">Notification & Automated Email Rules</h2>
                <p className="text-[11px] text-[#6B625B] mt-0.5">
                  Persisted in Supabase (<code className="font-mono text-[#46362F]">user_email_preferences</code>) and evaluated by the 10:00 AM IST daily automation.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F8F6F2] border border-[#E7E0D8] text-[10px] font-semibold text-[#46362F] w-fit">
                <Clock className="w-3.5 h-3.5 text-[#8A9A83]" />
                <span>Daily Alert Schedule: 10:00 AM IST (Asia/Kolkata)</span>
              </span>
            </div>

            {notificationSyncMessage && (
              <div className="p-3 bg-[#EBF7F0] border border-[#BCE8D3] rounded-lg text-[#324536] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8A9A83]" />
                <span>{notificationSyncMessage}</span>
              </div>
            )}

            {notificationSyncError && (
              <div className="p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-lg text-[#B42335] text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{notificationSyncError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 border border-[#E7E0D8] rounded-lg">
                <div>
                  <p className="font-medium text-[#46362F]">Daily Inventory Briefing (10:00 AM IST)</p>
                  <p className="text-[11px] text-[#6B625B]">Receive at most one daily email summarizing real stockout risks and reorder needs</p>
                </div>
                <input
                  type="checkbox"
                  checked={dailyInventoryAlerts}
                  onChange={(e) => setDailyInventoryAlerts(e.target.checked)}
                  className="w-4 h-4 text-[#46362F] rounded accent-[#46362F]"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 border border-[#E7E0D8] rounded-lg">
                <div>
                  <p className="font-medium text-[#46362F]">Lead-Time Stockout Risk Alerts</p>
                  <p className="text-[11px] text-[#6B625B]">Alert when effective inventory dips below lead-time demand</p>
                </div>
                <input
                  type="checkbox"
                  checked={lowStockAlerts}
                  onChange={(e) => setLowStockAlerts(e.target.checked)}
                  className="w-4 h-4 text-[#46362F] rounded accent-[#46362F]"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 border border-[#E7E0D8] rounded-lg">
                <div>
                  <p className="font-medium text-[#46362F]">Supplier Price Increase Warnings (≥ 20%)</p>
                  <p className="text-[11px] text-[#6B625B]">Mandatory budget review escalation notice</p>
                </div>
                <input
                  type="checkbox"
                  checked={priceChangeAlerts}
                  onChange={(e) => setPriceChangeAlerts(e.target.checked)}
                  className="w-4 h-4 text-[#46362F] rounded accent-[#46362F]"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 border border-[#E7E0D8] rounded-lg">
                <div>
                  <p className="font-medium text-[#46362F]">Purchase Authorization Reminders</p>
                  <p className="text-[11px] text-[#6B625B]">Notify when purchase proposals await manager approval</p>
                </div>
                <input
                  type="checkbox"
                  checked={approvalAlerts}
                  onChange={(e) => setApprovalAlerts(e.target.checked)}
                  className="w-4 h-4 text-[#46362F] rounded accent-[#46362F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-medium text-[#46362F] mb-1">Email Delivery Cadence</label>
                  <select
                    value={alertFrequency}
                    onChange={(e) => setAlertFrequency(e.target.value as 'INSTANT' | 'DAILY_DIGEST' | 'WEEKLY')}
                    className="w-full p-2.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#46362F]"
                  >
                    <option value="INSTANT">Instant + Daily 10:00 AM IST Briefing</option>
                    <option value="DAILY_DIGEST">Daily 10:00 AM IST Digest Only</option>
                    <option value="WEEKLY">Weekly Summary Only (Pause Daily Alerts)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E7E0D8] flex justify-end">
              <button
                type="submit"
                disabled={isSavingNotifications}
                className="px-4 py-2 text-xs font-medium text-white bg-[#46362F] hover:bg-[#382b25] rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {isSavingNotifications ? 'Saving to Supabase...' : 'Save Alert Preferences'}
              </button>
            </div>
          </form>

          {/* Verified Email Queue & Delivery Audit Log */}
          <div className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#46362F]" />
                <div>
                  <h3 className="text-sm font-semibold text-[#46362F]">Workspace Email Queue & Delivery Ledger</h3>
                  <p className="text-[11px] text-[#6B625B]">
                    Live records from <code className="font-mono text-[#46362F]">public.email_queue</code> and <code className="font-mono text-[#46362F]">public.email_delivery_logs</code>
                  </p>
                </div>
              </div>

              {(!emailQueueItems.some((item) => item.template_type === 'WELCOME' && item.status === 'SENT') ||
                emailQueueItems.some(
                  (item) => item.template_type === 'WELCOME' && (item.status === 'PENDING' || item.status === 'FAILED')
                )) && (
                <button
                  type="button"
                  onClick={handleRetryWelcomeEmail}
                  disabled={isRetryingWelcome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E7E0D8] bg-[#F8F6F2] hover:bg-[#E8E2F0]/60 text-[#46362F] transition-colors disabled:opacity-50 w-fit cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetryingWelcome ? 'animate-spin' : ''}`} />
                  <span>{isRetryingWelcome ? 'Dispatching...' : 'Retry Welcome Email'}</span>
                </button>
              )}
            </div>

            {emailAutomationStatus &&
              (!emailAutomationStatus.configured.appsScriptWebhookUrl ||
                !emailAutomationStatus.configured.appsScriptWebhookSecret) && (
                <div className="p-3 bg-[#FFF8EB] border border-[#EAAA00]/40 rounded-lg text-[#9A6700] text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Instant Apps Script Webhook Not Set in Server Environment:</span>{' '}
                    Welcome emails are queued in <code className="font-mono">public.email_queue</code> for the 5-minute Apps Script poller. For instant delivery on signup, set{' '}
                    <code className="font-mono">STOCKPILOT_APPS_SCRIPT_URL</code> and{' '}
                    <code className="font-mono">STOCKPILOT_APPS_SCRIPT_SECRET</code> in Vercel Environment Variables.
                  </div>
                </div>
              )}

            {emailQueueItems.length === 0 && deliveryLogs.length === 0 ? (
              <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg text-[#6B625B] text-[11px]">
                No email queue or delivery log entries recorded for this workspace yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border border-[#E7E0D8] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[#46362F] font-semibold">
                    <tr>
                      <th className="py-2 px-3">Template</th>
                      <th className="py-2 px-3">Recipient</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Idempotency Key / Details</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E0D8] text-[#6B625B]">
                    {emailQueueItems.map((item) => (
                      <tr key={`q-${item.id}`}>
                        <td className="py-2 px-3 font-mono font-medium text-[#46362F]">{item.template_type}</td>
                        <td className="py-2 px-3">{item.recipient_email}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === 'SENT'
                              ? 'bg-[#EBF7F0] text-[#324536]'
                              : item.status === 'PENDING'
                              ? 'bg-[#FFF8EB] text-[#9A6700]'
                              : 'bg-[#FDF0F2] text-[#B42335]'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px]">
                          {item.idempotency_key || '—'}
                          {item.error_message ? ` (${item.error_message})` : ''}
                        </td>
                        <td className="py-2 px-3">
                          {new Date(item.sent_at || item.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'supabase' && (
        <div className="space-y-6 text-xs min-w-0">
          {/* Connection Status & Mode Banner */}
          <div className="bg-white border border-[#E7E0D8] rounded-xl p-5 sm:p-8 shadow-2xs space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E0D8] pb-4">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <Database className="w-5 h-5 text-[#46362F] shrink-0 mt-0.5 sm:mt-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#46362F]">Supabase Connection & Tenant Isolation</h2>
                  <p className="text-[11px] text-[#6B625B] mt-0.5">
                    PostgreSQL database, Row Level Security (RLS) & live API key verification
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Real Live Connection Status Badge */}
                {supabaseConnectionStatus === 'checking' || isRecheckingSupabase ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded border inline-flex items-center gap-1.5 text-[#46362F] bg-[#F8F6F2] border-[#E7E0D8]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8A9A83]" />
                    <span>Checking Connection…</span>
                  </span>
                ) : isSupabaseLiveConnected ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded border inline-flex items-center gap-1.5 text-[#327456] bg-[#EBF7F0] border-[#BCE8D3]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#327456]" />
                    <span>Supabase Live Connected</span>
                  </span>
                ) : supabaseConnectionStatus === 'config_error' ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded border inline-flex items-center gap-1.5 text-[#B42335] bg-[#FDF0F2] border-[#F8C8CE]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B42335]" />
                    <span>Configuration Error (Invalid API Key)</span>
                  </span>
                ) : supabaseConnectionStatus === 'connection_failed' ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded border inline-flex items-center gap-1.5 text-[#B7791F] bg-[#FFF8EB] border-[#EAAA00]/40">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
                    <span>Connection Failed</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded border inline-flex items-center gap-1.5 text-[#6B625B] bg-[#F8F6F2] border-[#E7E0D8]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#8A9A83]" />
                    <span>Not Configured</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleRecheckConnection}
                  disabled={isRecheckingSupabase}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-[#E7E0D8] bg-[#F8F6F2] hover:bg-[#E8E2F0]/50 text-[#46362F] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecheckingSupabase ? 'animate-spin' : ''}`} />
                  <span>Re-verify</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg min-w-0">
                <p className="text-[10px] uppercase font-semibold text-[#6B625B]">Frontend Framework</p>
                <p className="font-medium text-[#46362F] mt-1">Vite + React 19 SPA</p>
                <p className="text-[10px] text-[#6B625B] mt-0.5">VITE_* & NEXT_PUBLIC_* supported</p>
              </div>
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg min-w-0">
                <p className="text-[10px] uppercase font-semibold text-[#6B625B]">Target PostgreSQL Host</p>
                <p className="font-mono text-[11px] text-[#46362F] mt-1 truncate" title={backendConfig.supabaseUrl || CANONICAL_SUPABASE_URL}>
                  {backendConfig.supabaseUrl || CANONICAL_SUPABASE_URL}
                </p>
                <p className="text-[10px] text-[#6B625B] mt-0.5 truncate">
                  {backendConfig.activeKeyVar
                    ? `Key variable: ${backendConfig.activeKeyVar}`
                    : 'Awaiting VITE_SUPABASE_ANON_KEY'}
                </p>
              </div>
              <div className="p-3.5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg min-w-0">
                <p className="text-[10px] uppercase font-semibold text-[#6B625B]">Tenant Isolation Model</p>
                <p className="font-medium text-[#46362F] mt-1">Row Level Security (RLS)</p>
                <p className="text-[10px] text-[#6B625B] mt-0.5">
                  {supabaseVerifiedAt
                    ? `Verified at ${new Date(supabaseVerifiedAt).toLocaleTimeString()}`
                    : 'Enforced via get_user_organization_ids()'}
                </p>
              </div>
            </div>

            {(backendConfig.isMisconfigured || supabaseConfigError) && (
              <div className="p-4 bg-[#FDF0F2] border border-[#F8C8CE] rounded-xl text-[#B42335] text-xs space-y-2">
                <div className="flex items-start gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{supabaseConfigError || backendConfig.configError}</span>
                </div>
                <p className="text-[11px] text-[#46362F] leading-relaxed">
                  <strong>How to resolve on Vercel:</strong> Open <strong>Vercel Project Settings &gt; Environment Variables</strong>, set <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8]">VITE_SUPABASE_URL=https://tewaaznazgsmaherddeu.supabase.co</code> and <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8]">VITE_SUPABASE_ANON_KEY</code> (or <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8]">VITE_SUPABASE_PUBLISHABLE_KEY</code>) to the public anon/publishable key from your Supabase Dashboard (Project <code className="font-mono">tewaaznazgsmaherddeu</code> &gt; Settings &gt; API) for <strong>Production, Preview, and Development</strong>, remove any stale placeholder variables, and trigger a <strong>new deployment</strong>.
                </p>
              </div>
            )}

            <div className="p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#46362F] shrink-0" />
                <p className="font-medium text-[#46362F]">Zero-Secret Exposure Security Rule</p>
              </div>
              <p className="text-[11px] text-[#6B625B] leading-relaxed">
                The client bundle only holds the public anon or publishable key (<code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8] text-[#46362F]">VITE_SUPABASE_ANON_KEY</code> or <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E7E0D8] text-[#46362F]">VITE_SUPABASE_PUBLISHABLE_KEY</code>). All authorization and multi-tenant isolation are strictly evaluated inside PostgreSQL database policies via trusted functions. Privileged service-role keys must NEVER be exposed in client bundles.
              </p>
            </div>
          </div>

          {/* Database Tables & RLS Status */}
          <div className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#46362F]">PostgreSQL Schema & RLS Policy Coverage</h2>
              <p className="text-[11px] text-[#6B625B] mt-0.5">
                Tables configured across Phase 1 baseline and Phase 2 secure extensions. All tables enforce RLS.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border border-[#E7E0D8] rounded-lg overflow-hidden">
                <thead className="bg-[#F8F6F2] border-b border-[#E7E0D8] text-[#46362F] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Table Name</th>
                    <th className="py-2.5 px-3">Domain Entity</th>
                    <th className="py-2.5 px-3">RLS Status</th>
                    <th className="py-2.5 px-3">Isolation Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0D8] text-[#6B625B]">
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">organizations</td>
                    <td className="py-2 px-3">Tenants & Store Accounts</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">Member or Creator</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">profiles</td>
                    <td className="py-2 px-3">Procurement Operators & Managers</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">Same Org Members or Self</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">organization_memberships</td>
                    <td className="py-2 px-3">Role-based Access (Owner, Admin, Member)</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">User & Org Bound</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">inventory_items</td>
                    <td className="py-2 px-3">SKUs, Safety Stock, Reorder Points</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">suppliers & price_history</td>
                    <td className="py-2 px-3">Vendor Catalog, Lead Times, MOQ</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">sales_history</td>
                    <td className="py-2 px-3">Daily Units Demanded & Revenue</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">incoming_orders</td>
                    <td className="py-2 px-3">Inbound Shipments & Receiving Status</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">reorder_requests</td>
                    <td className="py-2 px-3">Proposals, Approvals & Rejections</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">recommendation_runs</td>
                    <td className="py-2 px-3">Copilot Execution Snapshots & Evidence</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">audit_events</td>
                    <td className="py-2 px-3">Immutable Activity Audit Trail</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">user_email_preferences</td>
                    <td className="py-2 px-3">Notification Cadence & Alert Thresholds</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">Own User ID or Org Admin</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-medium text-[#46362F]">email_delivery_logs</td>
                    <td className="py-2 px-3">Outbound Dispatch History & Error Logs</td>
                    <td className="py-2 px-3"><span className="text-[#8A9A83] font-semibold">ENABLED</span></td>
                    <td className="py-2 px-3">get_user_organization_ids()</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Setup Runbook */}
          <div className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#46362F]" />
              <h2 className="text-sm font-semibold text-[#46362F]">Supabase Project Configuration Guide</h2>
            </div>

            <ol className="list-decimal list-inside space-y-2.5 text-[#6B625B] leading-relaxed">
              <li>
                <span className="font-semibold text-[#46362F]">Execute SQL Migrations</span>: Open your Supabase Dashboard &gt; <strong>SQL Editor</strong> &gt; Run <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">20261024_init_stockpilot_schema.sql</code>, <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">20261024_add_recommendations_and_email_preferences.sql</code>, and <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">20261025_firebase_identity_and_email_automation.sql</code>.
              </li>
              <li>
                <span className="font-semibold text-[#46362F]">Automated Auth &amp; Workspace Sync</span>: The migrations create <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">sync_firebase_workspace_and_welcome()</code> and <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">handle_new_user_registration()</code>. When a user registers via Google or Email/Password, their organization, profile, membership, and email preferences are provisioned automatically.
              </li>
              <li>
                <span className="font-semibold text-[#46362F]">Configure Environment Variables</span>: In your Vercel project settings or local <code className="font-mono bg-[#F8F6F2] px-1 py-0.5 rounded text-[#46362F]">.env</code>:
                <pre className="mt-1.5 p-3 bg-[#46362F] text-[#F8F6F2] rounded-lg font-mono text-[10px] overflow-x-auto">
VITE_SUPABASE_URL=https://tewaaznazgsmaherddeu.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key_here
SUPABASE_SECRET_KEY=your_supabase_service_role_or_secret_key_here
                </pre>
              </li>
              <li>
                <span className="font-semibold text-[#46362F]">Email Confirmation & Redirects</span>: In <strong>Authentication &gt; URL Configuration</strong>, ensure your site origin is listed under Site URL and Redirect URLs.
              </li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white border border-[#E7E0D8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#46362F]">Procurement Lead Profile</h2>
              <p className="text-[11px] text-[#6B625B] mt-0.5">Firebase Authentication session and Firestore profile (Project: stockpilotai-2dcae)</p>
            </div>
            <span className="font-mono text-[10px] font-semibold text-[#324536] bg-[#8A9A83]/15 px-2.5 py-1 rounded border border-[#8A9A83]/30 w-fit">
              Project ID: stockpilotai-2dcae • #1025122764341
            </span>
          </div>

          <div className="flex items-center gap-4 p-4 bg-[#F8F6F2] border border-[#E7E0D8] rounded-lg">
            {userProfile?.photoURL || firebaseUser?.photoURL ? (
              <img 
                src={userProfile?.photoURL || firebaseUser?.photoURL || ''} 
                alt="Profile Avatar"
                className="w-12 h-12 rounded-full object-cover border border-[#46362F]/20 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#46362F] text-white flex items-center justify-center font-bold text-base shadow-xs">
                {(userProfile?.displayName || firebaseUser?.displayName || currentUser?.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-[#46362F]">
                {userProfile?.displayName || firebaseUser?.displayName || currentUser?.name || 'Authenticated Operator'}
              </p>
              <p className="text-[#6B625B]">
                {userProfile?.email || firebaseUser?.email || currentUser?.email || ''}
              </p>
              {userProfile?.storeName && (
                <p className="text-[#46362F] font-semibold text-[11px]">
                  Assigned Store: {userProfile.storeName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-block text-[10px] font-medium text-[#8A9A83] bg-[#8A9A83]/15 px-2 py-0.5 rounded border border-[#8A9A83]/30">
                  {firebaseUser?.providerData[0]?.providerId === 'google.com' ? 'Verified Google Operator' : 'Store Procurement Manager'}
                </span>
                {firebaseUser?.uid && (
                  <span className="font-mono text-[10px] text-[#6B625B] bg-white px-2 py-0.5 rounded border border-[#E7E0D8]">
                    UID: {firebaseUser.uid}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E7E0D8] flex justify-end">
            <button
              type="button"
              onClick={() => setIsConfirmingChatReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#46362F] bg-[#F8F6F2] hover:bg-[#E8E2F0]/40 border border-[#E7E0D8] rounded-lg transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Reset Copilot Dialogue</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirmingChatReset}
        title="Reset Copilot Conversation"
        description="Are you sure you want to clear the conversation with the AI Reorder Agent?"
        confirmLabel="Reset Chat"
        variant="primary"
        onConfirm={() => {
          clearChat();
          setIsConfirmingChatReset(false);
        }}
        onClose={() => setIsConfirmingChatReset(false)}
      />
    </div>
  );
};
