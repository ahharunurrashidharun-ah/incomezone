/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardLayout from './pages/DashboardLayout';
import FindJobPage from './pages/FindJobPage';
import PostJobPage from './pages/PostJobPage';
import MyJobsPage from './pages/MyJobsPage';
import DepositPage from './pages/DepositPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

import SubmittedJobPage from './pages/SubmittedJobPage';
import PostAdPage from './pages/PostAdPage';
import PostedAdPage from './pages/PostedAdPage';
import WithdrawPage from './pages/WithdrawPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminStatsPage from './pages/admin/AdminStatsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminDepositsPage from './pages/admin/AdminDepositsPage';
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage';
import AdminSubmissionsPage from './pages/admin/AdminSubmissionsPage';
import AdminJobsPage from './pages/admin/AdminJobsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminAdsPage from './pages/admin/AdminAdsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import RefundPage from './pages/RefundPage';
import RulesPage from './pages/RulesPage';
import BlogPage from './pages/BlogPage';
import ScrollToTop from './components/ScrollToTop';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Router>
          <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/register" element={<SignUpPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/blog" element={<BlogPage />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminStatsPage />} />
            <Route path="jobs" element={<AdminJobsPage />} />
            <Route path="ads" element={<AdminAdsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="deposits" element={<AdminDepositsPage />} />
            <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
            <Route path="submissions" element={<AdminSubmissionsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
          
          <Route 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Navigate to="/jobs" replace />} />
            <Route path="/dashboard/find-job" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<FindJobPage />} />
            <Route path="/post-job" element={<PostJobPage />} />
            <Route path="/my-jobs" element={<MyJobsPage />} />
            <Route path="/submitted-jobs" element={<SubmittedJobPage />} />
            <Route path="/post-ad" element={<PostAdPage />} />
            <Route path="/posted-ads" element={<PostedAdPage />} />
            <Route path="/deposit" element={<DepositPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  </ThemeProvider>
  );
}
