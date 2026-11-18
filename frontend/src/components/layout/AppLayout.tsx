import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // Create page title from pathname
  const getPageTitle = (path: string) => {
    if (path === '/') return 'Contractor Executive Dashboard';
    if (path.startsWith('/projects')) return 'Construction Projects Directory';
    if (path.startsWith('/client-portal')) return 'Client Project Updates';
    if (path.startsWith('/quotations')) return 'Client Quotations & Bids';
    if (path.startsWith('/financials')) return 'Project Budgets & Expense Logs';
    if (path.startsWith('/inventory')) return 'Material Stocks & Procurement';
    if (path.startsWith('/workforce')) return 'Workforce, Attendance & Wages';
    if (path.startsWith('/milestones')) return 'Milestones, Gantt & Progress Tracking';
    if (path.startsWith('/invoices')) return 'Client Invoices & Receivables';
    if (path.startsWith('/ai-risk')) return 'AI Cost & Schedule Risk Intelligence';
    if (path.startsWith('/reports')) return 'Business Analytics & Project Reports';
    if (path.startsWith('/notifications')) return 'Notifications & Updates';
    return 'Construction Management';
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Fixed Left Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        {/* Dynamic Page Header & Breadcrumb Bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Morya Enterprises</span>
              <span>/</span>
              <span className="text-slate-800 font-medium capitalize">
                {location.pathname === '/' ? 'Overview' : location.pathname.replace('/', '')}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>FY 2026-27 Active</span>
          </div>
        </div>

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
