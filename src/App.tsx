import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { GoogleOnboardingModal } from './components/onboarding/GoogleOnboardingModal';

import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { AgentPage } from './pages/AgentPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { InsightsPage } from './pages/InsightsPage';
import { TestLabPage } from './pages/TestLabPage';
import { AuditPage } from './pages/AuditPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { SettingsPage } from './pages/SettingsPage';
import { DailyBriefingPage } from './pages/DailyBriefingPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userProfile, isLoading, workspaceError, retryWorkspaceLoad, clearError } = useAuth();
  const { currentUser } = useApp();
  const [isRetrying, setIsRetrying] = React.useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F2] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-[#46362F] border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#46362F]">Verifying authenticated session...</p>
      </div>
    );
  }

  if (!firebaseUser && !currentUser) {
    return <Navigate to="/login" replace />;
  }

  const requiresStoreOnboarding = Boolean(
    firebaseUser && userProfile && (!userProfile.onboardingCompleted || !userProfile.storeName)
  );

  const handleRetry = async () => {
    setIsRetrying(true);
    await retryWorkspaceLoad();
    setIsRetrying(false);
  };

  return (
    <AppLayout>
      {workspaceError && (
        <div className="mb-4 p-3 bg-[#FDF0F2] border border-[#F8C8CE] rounded-xl text-[#B42335] text-xs font-semibold flex flex-wrap items-center justify-between gap-3">
          <span>{workspaceError}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2.5 py-1 rounded-md bg-white border border-[#F8C8CE] text-[#46362F] hover:bg-[#F8F6F2] text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
            <button
              type="button"
              onClick={clearError}
              className="px-2 py-1 text-[11px] text-[#6B625B] hover:text-[#46362F]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {children}
      <GoogleOnboardingModal
        isOpen={requiresStoreOnboarding}
        onComplete={() => {}}
      />
    </AppLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Public Landing & Informational Routes */}
            <Route
              path="/"
              element={
                <AppLayout>
                  <AboutPage />
                </AppLayout>
              }
            />
            <Route
              path="/about"
              element={
                <AppLayout>
                  <AboutPage />
                </AppLayout>
              }
            />
            <Route
              path="/contact"
              element={
                <AppLayout>
                  <ContactPage />
                </AppLayout>
              }
            />

            {/* Protected Operational Application Routes */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/welcome"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/briefing"
              element={
                <ProtectedRoute>
                  <DailyBriefingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/daily-briefing"
              element={
                <ProtectedRoute>
                  <DailyBriefingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent"
              element={
                <ProtectedRoute>
                  <AgentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <ApprovalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <ProtectedRoute>
                  <InsightsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-lab"
              element={
                <ProtectedRoute>
                  <TestLabPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute>
                  <AuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
