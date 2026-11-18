import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  HardHat,
  ChevronRight,
  Calendar,
  Briefcase,
  Layers,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatINR, formatFullINR } from '../../services/storage';
import { fetchProjects, ProjectApiRecord } from '../../services/projectsApi';
import { getStoredAuthSession } from '../../services/auth';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    setLoading(true);
    void fetchProjects()
      .then((records) => {
        setProjects(records);
        setLoadError('');
      })
      .catch((error) => {
        setProjects([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const userName = getStoredAuthSession()?.user.name || 'Contractor';

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading live dashboard data...</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-3 text-sm font-bold text-rose-800">Dashboard data is unavailable</h2>
        <p className="mt-1 text-xs text-rose-700">{loadError}</p>
        <button onClick={loadDashboard} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">Retry</button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 text-base font-bold text-slate-800">Welcome, {userName}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">No projects are currently assigned to your account, so live dashboard metrics are not available yet.</p>
        <button onClick={() => navigate('/projects')} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">Open Projects</button>
      </div>
    );
  }

  const metrics = (() => {
    const totalContractValue = projects.reduce((sum, project) => sum + project.contractAmount, 0);
    const totalApprovedBudget = projects.reduce((sum, project) => sum + project.approvedBudget, 0);
    const totalActualExpenses = projects.reduce((sum, project) => sum + project.actualExpenses, 0);
    const totalPaymentsReceived = projects.reduce((sum, project) => sum + project.amountPaid, 0);
    const totalProjects = projects.length;

    return {
      totalProjects,
      activeProjects: projects.filter((project) => project.status === 'IN_PROGRESS').length,
      planningProjects: projects.filter((project) => project.status === 'PLANNING').length,
      onHoldProjects: projects.filter((project) => project.status === 'ON_HOLD').length,
      completedProjects: projects.filter((project) => project.status === 'COMPLETED').length,
      atRiskProjects: projects.filter((project) => project.costRiskTier === 'HIGH' || project.scheduleRiskTier === 'HIGH').length,
      totalContractValue,
      totalApprovedBudget,
      totalActualExpenses,
      totalRemainingBudget: Math.max(0, totalApprovedBudget - totalActualExpenses),
      totalPaymentsReceived,
      totalOutstandingPayments: projects.reduce((sum, project) => sum + project.outstandingAmount, 0),
      overallCompletionProgress: totalProjects
        ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / totalProjects)
        : 0,
      budgetUtilizationPct: totalApprovedBudget > 0 ? Math.round((totalActualExpenses / totalApprovedBudget) * 100) : 0,
      upcomingMilestones: 0,
      overdueMilestones: 0,
    };
  })();

  // Chart data: Budget vs Actual for projects in ₹ Lakhs
  const budgetVsActualData = projects.map((p) => ({
    name: p.name.length > 20 ? p.name.substring(0, 18) + '...' : p.name,
    code: p.projectCode.replace('MORYA-PRJ-2026-', 'PRJ-'),
    budget: Math.round((p.approvedBudget / 100000) * 10) / 10, // ₹ in Lakhs
    expenses: Math.round((p.actualExpenses / 100000) * 10) / 10,
    contract: Math.round((p.contractAmount / 100000) * 10) / 10,
    paid: Math.round((p.amountPaid / 100000) * 10) / 10,
    outstanding: Math.round((p.outstandingAmount / 100000) * 10) / 10,
  }));

  // Chart data: Construction Type Breakdown
  const typeCounts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.constructionType] = (acc[p.constructionType] || 0) + 1;
    return acc;
  }, {});

  const typeChartData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.charAt(0) + type.slice(1).toLowerCase(),
    value: count,
  }));

  const TYPE_COLORS = ['#ea580c', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

  // High Risk Projects flagged by AI
  const highRiskProjects = projects.filter(
    (p) => p.costRiskTier === 'HIGH' || p.scheduleRiskTier === 'HIGH'
  );

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700" role="alert">
          {loadError}
        </div>
      )}
      {/* Top Welcome Banner with Aniket Desai & Morya Enterprises */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-navy-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/60">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold uppercase tracking-wider mb-2">
            <HardHat className="w-3.5 h-3.5 text-brand-400" />
            <span>Morya Enterprises — Contractor Command Center</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Welcome back,</span>
            <span className="text-brand-400">{userName}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Managing <strong className="text-white font-bold">{metrics.totalProjects} construction projects</strong> for Morya Enterprises with total contracted portfolio of <strong className="text-brand-400 font-bold">{formatFullINR(metrics.totalContractValue)}</strong> ({formatINR(metrics.totalContractValue)}).
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => navigate('/projects?create=true')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5"
          >
            <span>+ Create Project</span>
          </button>
          <button
            onClick={() => navigate('/ai-risk')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Risk Matrix</span>
          </button>
        </div>

        {/* Decorative corner glow */}
        <div className="absolute right-0 top-0 bottom-0 w-72 bg-gradient-to-l from-brand-600/15 to-transparent pointer-events-none" />
      </div>

      {/* Row 1: Key Performance Metrics Cards (Dynamic Calculated Totals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Total Contracted Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contract Portfolio</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block truncate" title={formatFullINR(metrics.totalContractValue)}>
              {formatFullINR(metrics.totalContractValue)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
              {metrics.totalProjects} Projects Total ({formatINR(metrics.totalContractValue)})
            </span>
          </div>
        </div>

        {/* 2. Total Approved Budget */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved Budget</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-slate-900 block truncate" title={formatFullINR(metrics.totalApprovedBudget)}>
              {formatFullINR(metrics.totalApprovedBudget)}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 block">
              Planned Margin: {formatINR(Math.max(0, metrics.totalContractValue - metrics.totalApprovedBudget))}
            </span>
          </div>
        </div>

        {/* 3. Actual Expenses to Date */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actual Expenses</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-brand-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-brand-600 block truncate" title={formatFullINR(metrics.totalActualExpenses)}>
              {formatFullINR(metrics.totalActualExpenses)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
              {metrics.budgetUtilizationPct}% of approved budget
            </span>
          </div>
        </div>

        {/* 4. Payments Received */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payments Received</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-emerald-700 block truncate" title={formatFullINR(metrics.totalPaymentsReceived)}>
              {formatFullINR(metrics.totalPaymentsReceived)}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 block">
              Client cash collected
            </span>
          </div>
        </div>

        {/* 5. Outstanding Payments */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Due</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl font-extrabold text-rose-600 block truncate" title={formatFullINR(metrics.totalOutstandingPayments)}>
              {formatFullINR(metrics.totalOutstandingPayments)}
            </span>
            <span className="text-[10px] font-semibold text-rose-500 mt-0.5 block">
              Pending client balance
            </span>
          </div>
        </div>

        {/* 6. Active Projects & Progress */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Site Execution</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900">{metrics.activeProjects}</span>
              <span className="text-xs font-bold text-slate-500">Active</span>
              <span className="text-xs text-slate-400">/ {metrics.totalProjects}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-brand-600 h-full rounded-full"
                style={{ width: `${metrics.overallCompletionProgress}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 mt-1 block">
              {metrics.overallCompletionProgress}% avg progress
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: AI Early Warning Center & Alerts */}
      {highRiskProjects.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                AI Early-Warning Alert: Cost Overrun & Schedule Delay Flagged
              </h3>
            </div>
            <button
              onClick={() => navigate('/ai-risk')}
              className="text-xs font-semibold text-amber-900 hover:text-amber-700 flex items-center gap-1"
            >
              <span>View AI Risk Matrix</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highRiskProjects.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-lg p-4 border border-amber-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200">
                          {p.projectCode}
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                          Demo Project
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight mt-1">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.location} • Client: {p.clientName}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                      HIGH RISK
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-500 text-[11px]">Cost Overrun Score:</span>
                      <p className="font-extrabold text-rose-600 text-sm">{p.costRiskScore}/100</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Schedule Slippage Score:</span>
                      <p className="font-extrabold text-amber-600 text-sm">{p.scheduleRiskScore}/100</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-normal">
                    <strong className="text-slate-800">AI Diagnosis:</strong> Budget burn ({Math.round((p.actualExpenses / p.approvedBudget) * 100)}%) is currently outpacing physical completion ({p.progress}%). Material cost growth detected in acoustic ceilings & HVAC ducting rework.
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Contractor: <strong className="text-slate-700">{p.contractorName}</strong></span>
                  <button
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <span>View Project</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Charts (Budget vs Actual in Lakhs & Client Receivables Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget vs Actual Spending Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Project Budget vs. Actual Expenses</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial comparison in ₹ Lakhs for database-backed construction projects
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Calculated
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActualData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₹${val}L`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `₹${value.toLocaleString()} Lakhs`,
                    name === 'budget' ? 'Approved Budget' : name === 'expenses' ? 'Actual Spent' : 'Contract Value',
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="contract" name="Contract Value" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="budget" name="Approved Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Actual Spent" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Type Distribution Donut Chart */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-900">Project Classification</h3>
            </div>
            <p className="text-xs text-slate-500">Distribution across construction categories</p>

            <div className="h-56 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {typeChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            {typeChartData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length] }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-900">{item.value} Projects</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Projects Directory Table with Demo Data Labeling */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Morya Enterprises Construction Portfolio</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Fictional / Demo Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Database-backed construction sites managed by <strong>Aniket Desai</strong>
            </p>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open Projects Directory</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Project & Client</th>
                <th className="py-3 px-4">Location & PM</th>
                <th className="py-3 px-4">Contract / Budget</th>
                <th className="py-3 px-4">Expenses Spent</th>
                <th className="py-3 px-4">Paid / Due</th>
                <th className="py-3 px-4">Progress & Status</th>
                <th className="py-3 px-4">AI Risk</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Code & Project */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded font-bold border border-brand-200">
                        {project.projectCode}
                      </span>
                      {project.isDemoData && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          DEMO
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-xs mt-1 max-w-xs truncate">
                      {project.name}
                    </p>
                    <p className="text-[11px] text-slate-500">Client: {project.clientName}</p>
                  </td>

                  {/* Location & PM */}
                  <td className="py-3 px-4">
                    <p className="text-[11px] text-slate-700 truncate max-w-[170px]">
                      {project.location}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PM: {project.projectManager}</p>
                  </td>

                  {/* Contract / Budget */}
                  <td className="py-3 px-4 font-medium">
                    <div className="text-slate-900 font-bold">{formatFullINR(project.contractAmount)}</div>
                    <div className="text-[11px] text-slate-500">
                      Budget: {formatFullINR(project.approvedBudget)}
                    </div>
                  </td>

                  {/* Expenses Spent */}
                  <td className="py-3 px-4">
                    <div className="text-brand-700 font-bold">{formatFullINR(project.actualExpenses)}</div>
                    <div className="text-[10px] text-slate-500">
                      {Math.round((project.actualExpenses / project.approvedBudget) * 100)}% budget utilized
                    </div>
                  </td>

                  {/* Paid / Due */}
                  <td className="py-3 px-4">
                    <div className="text-emerald-700 font-semibold">{formatFullINR(project.amountPaid)} paid</div>
                    <div className={`text-[10px] font-bold ${project.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {project.outstandingAmount > 0 ? `Due: ${formatFullINR(project.outstandingAmount)}` : 'Cleared'}
                    </div>
                  </td>

                  {/* Progress & Status */}
                  <td className="py-3 px-4 min-w-[130px]">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-slate-800">{project.progress}%</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          project.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : project.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          project.progress >= 90
                            ? 'bg-emerald-500'
                            : project.progress >= 50
                            ? 'bg-brand-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </td>

                  {/* AI Risk */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        project.costRiskTier === 'HIGH'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : project.costRiskTier === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {project.costRiskTier} RISK
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
