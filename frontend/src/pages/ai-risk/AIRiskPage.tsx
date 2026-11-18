import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Boxes,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  Users,
} from 'lucide-react';
import { formatFullINR, formatINR } from '../../services/storage';
import { Project } from '../../types';
import { fetchProjects } from '../../services/projectsApi';
import { fetchBudgetExpenses } from '../../services/budgetExpensesApi';
import { fetchInventory, fetchMilestones } from '../../services/operationsApi';

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface ExpenseRecord {
  projectId: string;
  amount: number;
  date: string;
}

interface MaterialRecord {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minimumStock: number;
  supplier: string;
}

interface MilestoneRecord {
  id: string;
  title: string;
  projectId: string;
  dueDate: string;
  status: string;
  progress: number;
  priority: string;
}

interface ProjectAnalysis {
  project: Project;
  utilization: number;
  remaining: number;
  variance: number;
  recentIncrease: number | null;
  costLevel: RiskLevel;
  costReasons: string[];
  overdueMilestones: MilestoneRecord[];
  upcomingMilestones: MilestoneRecord[];
  scheduleLevel: RiskLevel;
  scheduleReasons: string[];
  recommendation: string;
}

const riskOrder: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

const today = () => new Date().toISOString().split('T')[0];
const dateDaysFromNow = (days: number) => {
  const date = new Date(`${today()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const riskClass = (level: RiskLevel) => {
  if (level === 'Critical') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (level === 'High') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (level === 'Medium') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
};

const levelFromUtilization = (utilization: number, increase: number | null): RiskLevel => {
  if (utilization >= 100) return 'Critical';
  if (utilization >= 90 || (increase !== null && increase >= 25)) return 'High';
  if (utilization >= 75 || (increase !== null && increase >= 15)) return 'Medium';
  return 'Low';
};

const levelFromSchedule = (project: Project, overdueCount: number, upcomingCount: number): RiskLevel => {
  if (overdueCount >= 2) return 'Critical';
  if (overdueCount === 1 || (project.expectedCompletionDate < today() && project.status !== 'COMPLETED')) return 'High';
  if (upcomingCount > 0) return 'Medium';
  return 'Low';
};

const formatDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

export const AIRiskPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataWarning, setDataWarning] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setDataWarning('');
    try {
      const [projectRecords, financialData, inventoryData, milestoneData] = await Promise.all([
        fetchProjects(),
        fetchBudgetExpenses(),
        fetchInventory(),
        fetchMilestones(),
      ]);
      setProjects(projectRecords.map((project) => ({
        ...project,
        constructionType: project.constructionType as Project['constructionType'],
        status: project.status as Project['status'],
        actualCompletionDate: project.actualCompletionDate ?? undefined,
        projectManager: project.projectManager || 'Unassigned',
        contractorName: project.contractorName || 'Aniket Desai',
      })));
      setExpenses(financialData.expenses.map((expense) => ({ projectId: expense.projectId, amount: expense.amount, date: expense.date })));
      setMaterials(inventoryData.materials.map((material) => ({
        id: material.id,
        name: material.name,
        category: material.category,
        unit: material.unit,
        quantity: material.currentStock,
        minimumStock: material.minimumThreshold,
        supplier: material.supplier?.name || '',
      })));
      setMilestones(milestoneData.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.name,
        projectId: milestone.projectId,
        dueDate: milestone.plannedEndDate,
        status: milestone.status,
        progress: milestone.progressPercentage,
        priority: milestone.weightagePercentage >= 30 ? 'Critical' : milestone.weightagePercentage >= 20 ? 'High' : milestone.weightagePercentage >= 10 ? 'Medium' : 'Low',
      })));
    } catch (error) {
      setDataWarning(error instanceof Error ? error.message : 'Unable to load live risk inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const analyses = useMemo<ProjectAnalysis[]>(() => projects.map((project) => {
    const projectExpenses = expenses.filter((expense) => expense.projectId === project.id && Number.isFinite(Number(expense.amount)));
    const actualExpense = Number(project.actualExpenses) || 0;
    const approvedBudget = Number(project.approvedBudget) || 0;
    const utilization = approvedBudget > 0 ? (actualExpense / approvedBudget) * 100 : 0;
    const variance = actualExpense - approvedBudget;
    const recentCutoff = dateDaysFromNow(-30);
    const previousCutoff = dateDaysFromNow(-60);
    const recentAmount = projectExpenses.filter((expense) => expense.date >= recentCutoff).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const previousAmount = projectExpenses.filter((expense) => expense.date >= previousCutoff && expense.date < recentCutoff).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const recentIncrease = previousAmount > 0 && projectExpenses.length >= 2 ? ((recentAmount - previousAmount) / previousAmount) * 100 : null;
    const costReasons: string[] = [];
    if (approvedBudget <= 0) costReasons.push('Approved budget is missing or zero, so utilization is incomplete.');
    else if (utilization >= 100) costReasons.push(`Recorded expenses exceed the approved budget by ${formatFullINR(Math.max(0, variance))}.`);
    else if (utilization >= 90) costReasons.push(`Budget utilization is ${Math.round(utilization)}%, leaving only ${formatFullINR(Math.max(0, approvedBudget - actualExpense))}.`);
    else if (utilization >= 75) costReasons.push(`Budget utilization has reached ${Math.round(utilization)}%, which needs close review.`);
    if (recentIncrease !== null && recentIncrease >= 15) costReasons.push(`Recent recorded expenses are ${Math.round(recentIncrease)}% higher than the preceding 30-day period.`);
    if (costReasons.length === 0) costReasons.push('Recorded expenses are within the current approved budget range.');
    const projectMilestones = milestones.filter((milestone) => milestone.projectId === project.id);
    const overdueMilestones = projectMilestones.filter((milestone) => milestone.status !== 'Completed' && milestone.dueDate < today());
    const upcomingMilestones = projectMilestones.filter((milestone) => milestone.status !== 'Completed' && milestone.dueDate >= today() && milestone.dueDate <= dateDaysFromNow(14));
    const scheduleReasons: string[] = [];
    if (overdueMilestones.length > 0) scheduleReasons.push(`${overdueMilestones.length} milestone${overdueMilestones.length === 1 ? '' : 's'} past the due date: ${overdueMilestones.map((milestone) => milestone.title).join(', ')}.`);
    if (project.expectedCompletionDate < today() && project.status !== 'COMPLETED') scheduleReasons.push(`The project completion date of ${formatDate(project.expectedCompletionDate)} has passed while the project is not completed.`);
    if (upcomingMilestones.length > 0) scheduleReasons.push(`${upcomingMilestones.length} milestone${upcomingMilestones.length === 1 ? '' : 's'} due within the next 14 days.`);
    if (scheduleReasons.length === 0) scheduleReasons.push('No overdue or near-term milestone warning is present in the available records.');
    const scheduleLevel = levelFromSchedule(project, overdueMilestones.length, upcomingMilestones.length);
    const costLevel = approvedBudget <= 0 ? 'Medium' : levelFromUtilization(utilization, recentIncrease);
    const recommendation = riskOrder[scheduleLevel] >= riskOrder.High ? 'Review delayed milestones with the site team and reset the critical path.' : riskOrder[costLevel] >= riskOrder.High ? 'Review recent expenses and obtain approval before committing additional costs.' : 'Maintain weekly cost, milestone, and procurement reviews.';
    return { project, utilization, remaining: Math.max(0, approvedBudget - actualExpense), variance, recentIncrease, costLevel, costReasons, overdueMilestones, upcomingMilestones, scheduleLevel, scheduleReasons, recommendation };
  }), [projects, expenses, milestones]);

  const lowStockMaterials = materials.filter((material) => Number.isFinite(Number(material.quantity)) && Number.isFinite(Number(material.minimumStock)) && material.quantity <= material.minimumStock);
  const highCostProjects = analyses.filter((analysis) => riskOrder[analysis.costLevel] >= riskOrder.High);
  const delayProjects = analyses.filter((analysis) => riskOrder[analysis.scheduleLevel] >= riskOrder.High);
  const overdueMilestoneCount = analyses.reduce((sum, analysis) => sum + analysis.overdueMilestones.length, 0);
  const budgetOverruns = analyses.filter((analysis) => analysis.variance > 0);
  const hasData = projects.length > 0;

  const summaryCards = [
    { label: 'High cost risk', value: highCostProjects.length, icon: IndianRupee, color: 'text-rose-600 bg-rose-50' },
    { label: 'Potential delays', value: delayProjects.length, icon: Clock3, color: 'text-orange-600 bg-orange-50' },
    { label: 'Budget overruns', value: budgetOverruns.length, icon: TrendingDown, color: 'text-amber-600 bg-amber-50' },
    { label: 'Overdue milestones', value: overdueMilestoneCount, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
    { label: 'Low-stock materials', value: lowStockMaterials.length, icon: Boxes, color: 'text-blue-600 bg-blue-50' },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><BrainCircuit className="w-3.5 h-3.5" /> Decision support</div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">AI Insights & Risk Prediction</h2><p className="text-xs text-slate-500 mt-0.5">Transparent construction risk signals from current project, milestone, expense, and material records.</p></div><button type="button" onClick={loadData} className="self-start sm:self-auto px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh analysis</button></div>
    <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div className="flex items-start gap-3"><BrainCircuit className="w-5 h-5 text-blue-700 mt-0.5" /><div><strong className="text-xs text-blue-950 block">Rule-based analysis active</strong><p className="text-xs text-blue-900 mt-1">No trained model artifacts are checked into this repository. These alerts are calculated from stored project data and are not machine-learning predictions.</p></div></div><span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-300 rounded-full px-2 py-1 whitespace-nowrap">No ML model loaded</span></div>
    {dataWarning && <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {dataWarning}</div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">{summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div></div><p className="text-xl font-extrabold text-slate-900 mt-2.5">{value}</p></div>)}</div>
    {isLoading ? <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">Loading risk analysis...</div> : !hasData ? <div className="bg-white rounded-xl border border-slate-200 p-10 text-center"><ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" /><h3 className="text-sm font-bold text-slate-800">No project data available</h3><p className="text-xs text-slate-500 mt-1">Create a project before running risk analysis.</p></div> : <>
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div className="flex items-center justify-between gap-4 mb-4"><div><h3 className="text-sm font-bold text-slate-900">Project risk matrix</h3><p className="text-xs text-slate-500 mt-1">Each signal includes the data reason behind its level.</p></div><span className="text-[11px] text-slate-500">{analyses.length} projects analyzed</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Project</th><th className="px-3 py-3">Cost risk</th><th className="px-3 py-3">Utilization</th><th className="px-3 py-3">Schedule risk</th><th className="px-3 py-3">Milestones</th><th className="px-3 py-3">Recommendation</th></tr></thead><tbody>{analyses.map((analysis) => <tr key={analysis.project.id} className="border-b border-slate-100 last:border-0 align-top"><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{analysis.project.name}</strong><small className="text-[11px] text-slate-500">{analysis.project.projectCode}</small></td><td className="px-3 py-4"><span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${riskClass(analysis.costLevel)}`}>{analysis.costLevel}</span><p className="text-[11px] text-slate-600 mt-2 max-w-xs">{analysis.costReasons[0]}</p></td><td className="px-3 py-4"><strong className={`text-xs ${analysis.utilization >= 90 ? 'text-rose-600' : 'text-slate-800'}`}>{Math.round(analysis.utilization)}%</strong><span className="block text-[11px] text-slate-500 mt-1">{formatFullINR(analysis.remaining)} remaining</span></td><td className="px-3 py-4"><span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${riskClass(analysis.scheduleLevel)}`}>{analysis.scheduleLevel}</span><p className="text-[11px] text-slate-600 mt-2 max-w-xs">{analysis.scheduleReasons[0]}</p></td><td className="px-3 py-4 text-xs text-slate-600">{analysis.overdueMilestones.length} overdue<span className="block text-[11px] text-slate-500 mt-1">{analysis.upcomingMilestones.length} due soon</span></td><td className="px-3 py-4 text-[11px] text-slate-600 max-w-xs">{analysis.recommendation}</td></tr>)}</tbody></table></div></section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><IndianRupee className="w-4 h-4 text-brand-600" /><div><h3 className="text-sm font-bold text-slate-900">Cost overrun analysis</h3><p className="text-xs text-slate-500 mt-1">Recorded project expenses compared with approved budgets.</p></div></div><div className="space-y-3">{analyses.filter((analysis) => riskOrder[analysis.costLevel] >= riskOrder.Medium || analysis.variance > 0).length === 0 ? <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No project is currently at medium cost risk or above.</p> : analyses.filter((analysis) => riskOrder[analysis.costLevel] >= riskOrder.Medium || analysis.variance > 0).map((analysis) => <div key={analysis.project.id} className="border border-slate-100 rounded-lg p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-slate-800 block">{analysis.project.name}</strong><span className="text-[11px] text-slate-500">Actual {formatFullINR(analysis.project.actualExpenses)} of {formatFullINR(analysis.project.approvedBudget)}</span></div><span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${riskClass(analysis.costLevel)}`}>{analysis.costLevel}</span></div><p className="text-xs text-slate-600 mt-2">{analysis.costReasons.join(' ')}</p></div>)}</div></section><section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Clock3 className="w-4 h-4 text-orange-600" /><div><h3 className="text-sm font-bold text-slate-900">Schedule and delay risk</h3><p className="text-xs text-slate-500 mt-1">Milestone due dates, progress, and project completion dates.</p></div></div><div className="space-y-3">{delayProjects.length === 0 ? <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No high or critical schedule risk found.</p> : delayProjects.map((analysis) => <div key={analysis.project.id} className="border border-slate-100 rounded-lg p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-slate-800 block">{analysis.project.name}</strong><span className="text-[11px] text-slate-500">{analysis.overdueMilestones.length} overdue milestone(s)</span></div><span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${riskClass(analysis.scheduleLevel)}`}>{analysis.scheduleLevel}</span></div><p className="text-xs text-slate-600 mt-2">{analysis.scheduleReasons.join(' ')}</p><p className="text-[11px] text-blue-700 mt-2 font-semibold">Action: {analysis.recommendation}</p></div>)}</div></section></div>
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Boxes className="w-4 h-4 text-blue-600" /><div><h3 className="text-sm font-bold text-slate-900">Materials requiring attention</h3><p className="text-xs text-slate-500 mt-1">Low-stock alerts from the material records currently available.</p></div></div>{lowStockMaterials.length === 0 ? <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No low-stock materials found, or material records are not available.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Material</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Minimum</th><th className="px-3 py-3">Supplier record</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{lowStockMaterials.map((material) => <tr key={material.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 text-xs font-semibold text-slate-800">{material.name}</td><td className="px-3 py-3 text-xs text-slate-600">{material.category}</td><td className="px-3 py-3 text-xs font-bold text-rose-600">{material.quantity} {material.unit}</td><td className="px-3 py-3 text-xs text-slate-600">{material.minimumStock} {material.unit}</td><td className="px-3 py-3 text-xs text-slate-600">{material.supplier || 'Not provided'}</td><td className="px-3 py-3 text-xs text-blue-700 font-semibold">Check availability before next work package.</td></tr>)}</tbody></table></div>}</section>
      <section className="bg-slate-900 text-white rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><Lightbulb className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-bold">Risk rules and recommendations</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><div><strong className="text-slate-200 block mb-2">Risk levels</strong><p className="text-slate-300 leading-relaxed">Low: under 75% budget utilization with no schedule warning. Medium: 75-89% utilization or a milestone due within 14 days. High: 90%+ utilization, a recent expense increase of at least 25%, one overdue milestone, or a missed project completion date. Critical: budget at or above 100% utilization or two or more overdue milestones.</p></div><div><strong className="text-slate-200 block mb-2">Recommended actions</strong><p className="text-slate-300 leading-relaxed">Review flagged expenses and approvals, meet with teams on delayed milestones, check low-stock materials with suppliers, and revise schedules or budgets only after validating the underlying records.</p></div></div></section>
    </>}
  </div>;
};

export default AIRiskPage;