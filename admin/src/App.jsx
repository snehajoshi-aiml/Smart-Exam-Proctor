import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { CustomThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';
import StudentDetailPage from './pages/StudentDetailPage';
import ViolationsPage from './pages/ViolationsPage';
import TerminatedStudentsPage from './pages/TerminatedStudentsPage';
import FinishedStudentsPage from './pages/FinishedStudentsPage';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <CustomThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Admin Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Admin Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/live" element={<LiveMonitoringPage />} />
                <Route path="/student/:id" element={<StudentDetailPage />} />
                <Route path="/violations" element={<ViolationsPage />} />
                <Route path="/terminated" element={<TerminatedStudentsPage />} />
                <Route path="/finished" element={<FinishedStudentsPage />} />
                <Route path="/history" element={<ActivityHistoryPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </CustomThemeProvider>
  );
};

export default App;
