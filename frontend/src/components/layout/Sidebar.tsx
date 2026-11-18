import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  Receipt,
  Boxes,
  Users2,
  CheckSquare,
  FileCheck2,
  BrainCircuit,
  BarChart3,
  HardHat,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { getStoredAuthSession } from '../../services/auth';

interface SidebarProps {
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const session = getStoredAuthSession();
  const isClient = session?.user.role === 'CLIENT';
  const navItems = isClient
    ? [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/projects', label: 'My Projects', icon: Building2 },
        { to: '/client-portal', label: 'Client Portal', icon: ShieldCheck },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/projects', label: 'Projects', icon: Building2 },
        { to: '/quotations', label: 'Quotations', icon: FileSpreadsheet },
        { to: '/financials', label: 'Budget & Expenses', icon: Receipt },
        { to: '/inventory', label: 'Materials & Stock', icon: Boxes },
        { to: '/workforce', label: 'Workforce & Labour', icon: Users2 },
        { to: '/milestones', label: 'Milestones & Tracking', icon: CheckSquare },
        { to: '/invoices', label: 'Invoices & Payments', icon: FileCheck2 },
        { to: '/ai-risk', label: 'AI Risk Analysis', icon: BrainCircuit, badge: 'AI' },
        { to: '/reports-analytics', label: 'Reports & Analytics', icon: BarChart3 },
      ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0 border-r border-slate-800 select-none min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
            <HardHat className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-base tracking-tight text-white leading-tight uppercase">
              Morya Enterprises
            </h1>
            <p className="text-[11px] text-brand-500 font-medium tracking-wide">
              Building Smarter. Managing Better.
            </p>
          </div>
        </div>
      </div>

      {/* Role / Context Badge */}
      <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
          {isClient ? 'Client Account' : 'Contractor Admin'}
        </span>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">
          Live System
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Operations & Control
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span className="text-[10px] bg-brand-500/20 text-brand-400 border border-brand-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-800">
          <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs border border-brand-500 shadow-sm">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{session?.user.name || 'Morya User'}</p>
            <p className="text-[10px] text-slate-400 truncate">{isClient ? 'Client Portal' : 'Contractor, Morya Enterprises'}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
        </div>
      </div>
    </aside>
  );
};
