import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute, RoleProtectedRoute, RoleSwitch } from './components/ProtectedRoute';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { BudgetExpenses } from './pages/financials/BudgetExpenses';
import { MaterialsInventoryPage } from './pages/inventory/MaterialsInventoryPage';
import { WorkforcePage } from './pages/workforce/WorkforcePage';
import { MilestonesPage } from './pages/milestones/MilestonesPage';
import { InvoicesPage } from './pages/invoices/InvoicesPage';
import { QuotationsPage } from './pages/quotations/QuotationsPage';
import { AIRiskPage } from './pages/ai-risk/AIRiskPage';
import ReportsAnalyticsPage from './pages/reports/ReportsAnalyticsPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ClientPortalPage } from './pages/client-portal/ClientPortalPage';
import { ClientDashboardPage } from './pages/client-portal/ClientDashboardPage';
import { ClientProjectsPage } from './pages/client-portal/ClientProjectsPage';
import { ClientProjectDetailPage } from './pages/client-portal/ClientProjectDetailPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleSwitch client={<RoleProtectedRoute allowedRoles={['CLIENT']}><ClientDashboardPage /></RoleProtectedRoute>} contractor={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><DashboardPage /></RoleProtectedRoute>} />} />
          <Route path="projects" element={<RoleSwitch client={<RoleProtectedRoute allowedRoles={['CLIENT']}><ClientProjectsPage /></RoleProtectedRoute>} contractor={<ProjectsPage />} />} />
          <Route path="projects/:id" element={<RoleSwitch client={<RoleProtectedRoute allowedRoles={['CLIENT']}><ClientProjectDetailPage /></RoleProtectedRoute>} contractor={<ProjectDetailPage />} />} />
          <Route path="quotations" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><QuotationsPage /></RoleProtectedRoute>} />
          <Route path="financials" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><BudgetExpenses /></RoleProtectedRoute>} />
          <Route path="inventory" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><MaterialsInventoryPage /></RoleProtectedRoute>} />
          <Route path="workforce" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><WorkforcePage /></RoleProtectedRoute>} />
          <Route path="milestones" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><MilestonesPage /></RoleProtectedRoute>} />
          <Route path="invoices" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><InvoicesPage /></RoleProtectedRoute>} />
          <Route path="ai-risk" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><AIRiskPage /></RoleProtectedRoute>} />
          <Route path="reports-analytics" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><ReportsAnalyticsPage /></RoleProtectedRoute>} />
          <Route path="notifications" element={<RoleProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}><NotificationsPage /></RoleProtectedRoute>} />
          <Route path="client-portal" element={<RoleProtectedRoute allowedRoles={['CLIENT']}><ClientPortalPage /></RoleProtectedRoute>} />
          <Route path="reports" element={<Navigate to="/reports-analytics" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
