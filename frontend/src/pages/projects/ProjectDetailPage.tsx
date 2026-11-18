import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  User,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Receipt,
  Boxes,
  Users2,
  HardHat,
  TrendingUp,
  BrainCircuit,
  FileText
} from 'lucide-react';
import { formatINR, formatFullINR } from '../../services/storage';
import { fetchProjectById } from '../../services/projectsApi';
import { fetchMilestones } from '../../services/operationsApi';
import { Project } from '../../types';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'milestones' | 'risk'>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Array<{ id: string; name: string; weight: number; progress: number; status: string; date: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProject(null);
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const data = await fetchProjectById(id);
        setProject({
          ...data,
          constructionType: data.constructionType as Project['constructionType'],
          status: data.status as Project['status'],
          actualExpenses: data.actualExpenses ?? 0,
          amountPaid: data.amountPaid ?? 0,
          outstandingAmount: data.outstandingAmount ?? Math.max(0, data.contractAmount - (data.amountPaid ?? 0)),
          projectManager: data.projectManager || 'Unassigned',
          contractorName: data.contractorName || 'Aniket Desai',
          costRiskTier: data.costRiskTier || 'LOW',
          scheduleRiskTier: data.scheduleRiskTier || 'LOW',
          isDemoData: false,
        } as Project);
        try {
          const milestoneData = await fetchMilestones();
          setMilestones(
            milestoneData.milestones
              .filter((milestone) => milestone.projectId === id)
              .map((milestone) => ({
                id: milestone.id,
                name: milestone.name,
                weight: milestone.weightagePercentage,
                progress: milestone.progressPercentage,
                status: milestone.status,
                date: milestone.plannedEndDate,
              })),
          );
        } catch {
          setMilestones([]);
        }
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        Loading project details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Project Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">The requested construction project could not be located.</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold"
        >
          Back to Projects Directory
        </button>
      </div>
    );
  }

  const budgetBurnPct = Math.round((project.actualExpenses / project.approvedBudget) * 100);
  const remainingBudget = Math.max(0, project.approvedBudget - project.actualExpenses);
  const contractorMargin = Math.max(0, project.contractAmount - project.approvedBudget);

  return (
    <div className="space-y-6">
      {/* Back button & Title banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded font-bold border border-brand-200">
                {project.projectCode}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {project.constructionType}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              {project.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              project.costRiskTier === 'HIGH'
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : project.costRiskTier === 'MEDIUM'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            AI RISK: {project.costRiskTier} ({project.costRiskScore}/100)
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'hover:text-slate-900'
          }`}
        >
          Project Overview
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`pb-3 transition-colors ${
            activeTab === 'budget'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'hover:text-slate-900'
          }`}
        >
          Budget & Expenses (₹)
        </button>
        <button
          onClick={() => setActiveTab('milestones')}
          className={`pb-3 transition-colors ${
            activeTab === 'milestones'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'hover:text-slate-900'
          }`}
        >
          Milestones & Execution ({milestones.length})
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`pb-3 transition-colors ${
            activeTab === 'risk'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'hover:text-slate-900'
          }`}
        >
          AI Risk Intelligence
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Contract Value</span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{formatFullINR(project.contractAmount)}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">Contractor Margin: {formatINR(contractorMargin)}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Approved Budget</span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{formatFullINR(project.approvedBudget)}</p>
              <span className="text-[11px] text-emerald-600 mt-1 block font-medium">Remaining: {formatINR(remainingBudget)}</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Actual Site Expenses</span>
              <p className="text-xl font-extrabold text-brand-600 mt-1">{formatFullINR(project.actualExpenses)}</p>
              <span className="text-[11px] text-slate-500 mt-1 block font-medium">{budgetBurnPct}% budget utilized</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Milestone Progress</span>
              <p className="text-xl font-extrabold text-blue-600 mt-1">{project.progress}%</p>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          </div>

          {/* Details & Location */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Engineering Brief & Scope of Work</h3>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                {project.description || 'No specific engineering brief entered.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Site Address & Location</span>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5">{project.location}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lead Contractor</span>
                  <p className="font-bold text-brand-700 text-xs mt-0.5">{project.contractorName || 'Aniket Desai'} (Morya Enterprises)</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned Project Manager</span>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5">{project.projectManager}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Execution Timeline</span>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5">
                    {project.plannedStartDate} to {project.expectedCompletionDate}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Payments Received</span>
                  <p className="font-bold text-emerald-700 text-xs mt-0.5">{formatFullINR(project.amountPaid || 0)}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Outstanding Due</span>
                  <p className="font-bold text-rose-600 text-xs mt-0.5">{formatFullINR(project.outstandingAmount || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Client Details</h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client Name</span>
                  <strong className="text-slate-800 text-xs">{project.clientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Official Email</span>
                  <span className="text-slate-700">{project.clientEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Client Portal Status</span>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                    PORTAL ENABLED
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-slate-400 block text-[11px] mb-1">Quick Links</span>
                <div className="space-y-1">
                  <button
                    onClick={() => navigate('/quotations')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded text-slate-700 font-semibold flex items-center justify-between"
                  >
                    <span>View Quotation & Scope</span>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate('/invoices')}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded text-slate-700 font-semibold flex items-center justify-between"
                  >
                    <span>Client Invoices & Billing</span>
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET & EXPENSES */}
      {activeTab === 'budget' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Cost Categories & Budget Allocations</h3>
              <p className="text-slate-500 text-xs mt-0.5">Approved allocations for Morya Enterprises execution</p>
            </div>
            <button
              onClick={() => navigate('/financials')}
              className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold"
            >
              Manage Expenses
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Cost Category</th>
                  <th className="py-2.5 px-3">Allocation %</th>
                  <th className="py-2.5 px-3">Approved Budget</th>
                  <th className="py-2.5 px-3">Actual Spent</th>
                  <th className="py-2.5 px-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Materials (Cement, Steel, Bricks)', pct: 45, spentPct: 50 },
                  { cat: 'Workforce & Labour Wages', pct: 25, spentPct: 22 },
                  { cat: 'Equipment & Machinery Rental', pct: 10, spentPct: 12 },
                  { cat: 'Subcontractors (MEP, Glazing)', pct: 12, spentPct: 10 },
                  { cat: 'Transport & Site Logistics', pct: 4, spentPct: 3 },
                  { cat: 'Contingency & Permits', pct: 4, spentPct: 3 },
                ].map((item, idx) => {
                  const allocated = (project.approvedBudget * item.pct) / 100;
                  const spent = (project.actualExpenses * item.spentPct) / 100;
                  const diff = allocated - spent;
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.cat}</td>
                      <td className="py-2.5 px-3 text-slate-500">{item.pct}%</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{formatINR(allocated)}</td>
                      <td className="py-2.5 px-3 font-bold text-brand-700">{formatINR(spent)}</td>
                      <td className={`py-2.5 px-3 font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diff >= 0 ? `+${formatINR(diff)}` : `-${formatINR(Math.abs(diff))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MILESTONES */}
      {activeTab === 'milestones' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Milestone Schedule & Physical Execution</h3>
              <p className="text-slate-500 text-xs mt-0.5">Weighted progress milestones and client approval verification</p>
            </div>
            <button
              onClick={() => navigate('/milestones')}
              className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold"
            >
              Full Milestone Tracker
            </button>
          </div>

          <div className="space-y-3">
            {milestones.map((m) => (
              <div key={m.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{m.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200 rounded text-slate-700">
                      Weight: {m.weight}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 max-w-md overflow-hidden">
                    <div className="bg-brand-600 h-full rounded-full" style={{ width: `${m.progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-600">
                  <span className="text-[11px]">{m.date}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : m.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AI RISK INTELLIGENCE */}
      {activeTab === 'risk' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-brand-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Risk Analysis & Early Warnings</h3>
                <p className="text-slate-500 text-xs">Model: GradientBoostingRegressor + RandomForest v1.2.0-morya</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/ai-risk')}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              Open AI Risk Center
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Overrun Risk Score</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-600">{project.costRiskScore || 25}/100</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  {project.costRiskTier || 'LOW'} TIER
                </span>
              </div>
              <p className="text-slate-600 text-xs mt-2">
                Predicted cost variance is currently tracking at approx +{Math.round((project.costRiskScore || 20) * 0.25)}% of approved budget.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule Delay Risk Score</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-600">{project.scheduleRiskScore || 20}/100</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  {project.scheduleRiskTier || 'LOW'} TIER
                </span>
              </div>
              <p className="text-slate-600 text-xs mt-2">
                Projected timeline slippage estimated at {Math.round((project.scheduleRiskScore || 20) * 0.4)} days.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
            <h4 className="font-bold text-amber-900 text-xs">Actionable AI Mitigation Recommendations:</h4>
            <ul className="list-disc list-inside text-amber-800 text-xs space-y-1">
              <li>Lock in procurement contracts for rebar steel and OPC-53 cement to prevent further material cost drift.</li>
              <li>Reallocate 8 site masons from completed structural floors to ongoing brickwork packaging.</li>
              <li>Submit variation order for client-requested structural changes before incurring additional sub-contractor hours.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
