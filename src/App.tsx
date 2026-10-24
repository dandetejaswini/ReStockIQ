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
  const { firebaseUser, userProfile, isLoading } = useAuth();
  const { currentUser } = useApp();

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

  return (
    <AppLayout>
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
