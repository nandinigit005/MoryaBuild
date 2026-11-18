import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  Flag,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Project } from '../../types';
import { fetchProjects } from '../../services/projectsApi';
import { createMilestone, deleteMilestone as deleteMilestoneApi, fetchMilestones, updateMilestone } from '../../services/operationsApi';

type MilestoneStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
type MilestonePriority = 'Low' | 'Medium' | 'High' | 'Critical';

interface Milestone {
  id: string;
  title: string;
  projectId: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: MilestoneStatus;
  progress: number;
  priority: MilestonePriority;
}

interface MilestoneFormData {
  title: string;
  projectId: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: MilestoneStatus;
  progress: string;
  priority: MilestonePriority;
}

const statuses: MilestoneStatus[] = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const priorities: MilestonePriority[] = ['Low', 'Medium', 'High', 'Critical'];

const today = () => new Date().toISOString().split('T')[0];

const emptyForm = (projectId = ''): MilestoneFormData => ({
  title: '',
  projectId,
  description: '',
  startDate: today(),
  dueDate: today(),
  status: 'Not Started',
  progress: '0',
  priority: 'Medium',
});

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

const isOverdue = (milestone: Milestone) => milestone.status !== 'Completed' && milestone.dueDate < today();
const isUpcoming = (milestone: Milestone) => {
  if (milestone.status === 'Completed' || isOverdue(milestone)) return false;
  const deadline = new Date(`${milestone.dueDate}T00:00:00`).getTime();
  const weekFromNow = new Date(`${today()}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000;
  return deadline <= weekFromNow;
};

const statusClass = (status: MilestoneStatus) => {
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (status === 'On Hold') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

const priorityClass = (priority: MilestonePriority) => {
  if (priority === 'Critical') return 'bg-rose-100 text-rose-700';
  if (priority === 'High') return 'bg-orange-100 text-orange-700';
  if (priority === 'Medium') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
};

export const MilestonesPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [formData, setFormData] = useState<MilestoneFormData>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMilestone, setViewingMilestone] = useState<Milestone | null>(null);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([fetchProjects(), fetchMilestones()]).then(([projectRecords, milestoneData]) => {
      const currentProjects = projectRecords as Project[];
      setProjects(currentProjects);
      const { milestones: records } = milestoneData;
      setMilestones(records.map((m) => ({ id: m.id, title: m.name, projectId: m.projectId, description: m.description || '', startDate: m.plannedStartDate, dueDate: m.plannedEndDate, status: ({ NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', SUBMITTED_FOR_APPROVAL: 'In Progress', APPROVED: 'Completed', COMPLETED: 'Completed', DELAYED: 'On Hold' } as Record<string, MilestoneStatus>)[m.status], progress: m.progressPercentage, priority: m.weightagePercentage >= 30 ? 'Critical' : m.weightagePercentage >= 20 ? 'High' : m.weightagePercentage >= 10 ? 'Medium' : 'Low' })));
      setFormData(emptyForm(currentProjects[0]?.id || ''));
    }).catch((error: Error) => setLoadError(error.message)).finally(() => setLoading(false));
  }, []);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const completedCount = milestones.filter((milestone) => milestone.status === 'Completed').length;
  const inProgressCount = milestones.filter((milestone) => milestone.status === 'In Progress').length;
  const overdueMilestones = milestones.filter(isOverdue);
  const upcomingMilestones = milestones.filter(isUpcoming);

  const filteredMilestones = milestones.filter((milestone) => {
    const matchesSearch = [milestone.title, milestone.description, projectNames.get(milestone.projectId) || '']
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch &&
      (projectFilter === 'ALL' || milestone.projectId === projectFilter) &&
      (statusFilter === 'ALL' || milestone.status === statusFilter) &&
      (priorityFilter === 'ALL' || milestone.priority === priorityFilter);
  });

  const updateForm = (name: keyof MilestoneFormData, value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const progress = Number(formData.progress);
    if (!formData.title.trim() || !formData.projectId || !formData.description.trim()) {
      setFormError('Title, project, and description are required.');
      return;
    }
    if (!formData.startDate || !formData.dueDate || formData.startDate > formData.dueDate) {
      setFormError('Due date must be on or after the start date.');
      return;
    }
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setFormError('Progress must be a whole number between 0 and 100.');
      return;
    }
    const normalizedProgress = formData.status === 'Completed' ? 100 : progress;
    try {
      const payload = { projectId: formData.projectId, name: formData.title.trim(), description: formData.description.trim(), plannedStartDate: formData.startDate, plannedEndDate: formData.dueDate, status: ({ 'Not Started': 'NOT_STARTED', 'In Progress': 'IN_PROGRESS', Completed: 'COMPLETED', 'On Hold': 'DELAYED' } as Record<string, string>)[formData.status], progressPercentage: normalizedProgress, weightagePercentage: ({ Low: 5, Medium: 10, High: 20, Critical: 30 } as Record<string, number>)[formData.priority], clientApprovalRequired: true };
      const result = editingId ? await updateMilestone(editingId, payload) : await createMilestone(payload);
      const m = result.milestone;
      const milestone: Milestone = { id: m.id, title: m.name, projectId: m.projectId, description: m.description || '', startDate: m.plannedStartDate, dueDate: m.plannedEndDate, status: ({ NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', SUBMITTED_FOR_APPROVAL: 'In Progress', APPROVED: 'Completed', COMPLETED: 'Completed', DELAYED: 'On Hold' } as Record<string, MilestoneStatus>)[m.status], progress: m.progressPercentage, priority: formData.priority };
      setMilestones((current) => editingId ? current.map((item) => item.id === milestone.id ? milestone : item) : [milestone, ...current]);
    } catch (error) { setFormError((error as Error).message); return; }
    setFormData(emptyForm(formData.projectId));
    setEditingId(null);
    setFormError('');
  };

  const startEditing = (milestone: Milestone) => {
    setEditingId(milestone.id);
    setFormData({ ...milestone, progress: String(milestone.progress) });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMilestone = async (milestone: Milestone) => {
    if (window.confirm(`Delete ${milestone.title}?`)) {
      try { await deleteMilestoneApi(milestone.id); } catch (error) { setFormError((error as Error).message); return; }
      setMilestones((current) => current.filter((item) => item.id !== milestone.id));
      if (editingId === milestone.id) {
        setEditingId(null);
        setFormData(emptyForm(projects[0]?.id || ''));
      }
      if (viewingMilestone?.id === milestone.id) setViewingMilestone(null);
    }
  };

  const summaryCards = [
    { label: 'Total Milestones', value: milestones.length, icon: Flag, color: 'text-blue-600 bg-blue-50' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'In Progress', value: inProgressCount, icon: Clock3, color: 'text-brand-600 bg-amber-50' },
    { label: 'Overdue', value: overdueMilestones.length, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><Flag className="w-3.5 h-3.5" /> Execution control</div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Milestones & Execution Tracking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Plan delivery dates, monitor progress, and surface schedule risks across projects.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected to API</span>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading milestones…</p>}
      {loadError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Unable to load milestones: {loadError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div></div><p className="text-xl font-extrabold text-slate-900 mt-2.5">{value}</p></div>)}
      </div>

      {(overdueMilestones.length > 0 || upcomingMilestones.length > 0) && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">{overdueMilestones.length > 0 && <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-5"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-600" /><h3 className="text-xs font-bold text-rose-950 uppercase tracking-wide">Overdue milestones</h3></div><div className="space-y-2">{overdueMilestones.slice(0, 3).map((milestone) => <div key={milestone.id} className="flex items-center justify-between gap-3 bg-white/70 border border-rose-100 rounded-lg px-3 py-2.5"><div><strong className="text-xs text-slate-800 block">{milestone.title}</strong><span className="text-[11px] text-slate-500">{projectNames.get(milestone.projectId) || 'Unassigned'}</span></div><span className="text-[11px] font-bold text-rose-700 whitespace-nowrap">Due {formatDate(milestone.dueDate)}</span></div>)}</div></div>}{upcomingMilestones.length > 0 && <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5"><div className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-blue-600" /><h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide">Upcoming deadlines</h3></div><div className="space-y-2">{upcomingMilestones.slice(0, 3).map((milestone) => <div key={milestone.id} className="flex items-center justify-between gap-3 bg-white/70 border border-blue-100 rounded-lg px-3 py-2.5"><div><strong className="text-xs text-slate-800 block">{milestone.title}</strong><span className="text-[11px] text-slate-500">{projectNames.get(milestone.projectId) || 'Unassigned'}</span></div><span className="text-[11px] font-bold text-blue-700 whitespace-nowrap">Due {formatDate(milestone.dueDate)}</span></div>)}</div></div>}</section>}

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit milestone' : 'Add milestone'}</h3><p className="text-xs text-slate-500 mt-1">Capture the delivery scope, dates, owner project, and execution priority.</p></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setFormData(emptyForm(projects[0]?.id || '')); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>}</div>
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5" onSubmit={handleSubmit}>
          <label className="text-xs font-bold text-slate-600 lg:col-span-2">Milestone title<input className="mt-1" value={formData.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="e.g. Foundation completion" /></label>
          <label className="text-xs font-bold text-slate-600 lg:col-span-2">Assigned project<select className="mt-1" value={formData.projectId} onChange={(event) => updateForm('projectId', event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-4">Description<textarea className="mt-1 min-h-20" value={formData.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Describe the work that defines completion" /></label>
          <label className="text-xs font-bold text-slate-600">Start date<input className="mt-1" type="date" value={formData.startDate} onChange={(event) => updateForm('startDate', event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-600">Due date<input className="mt-1" type="date" value={formData.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-600">Status<select className="mt-1" value={formData.status} onChange={(event) => updateForm('status', event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">Progress (%)<input className="mt-1" type="number" min="0" max="100" step="1" value={formData.progress} onChange={(event) => updateForm('progress', event.target.value)} /></label>
          <label className="text-xs font-bold text-slate-600">Priority<select className="mt-1" value={formData.priority} onChange={(event) => updateForm('priority', event.target.value)}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingId ? 'Update milestone' : 'Add milestone'}</button>{formError && <p className="text-xs font-semibold text-rose-600" role="alert">{formError}</p>}</div>
        </form>
      </section>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5"><div><h3 className="text-sm font-bold text-slate-900">Milestone register</h3><p className="text-xs text-slate-500 mt-1">{filteredMilestones.length} of {milestones.length} milestones shown.</p></div><div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto"><div className="relative sm:w-64"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input className="!pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search milestones..." /></div><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="ALL">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select><div className="flex border border-slate-200 rounded-lg overflow-hidden self-start"><button type="button" onClick={() => setViewMode('table')} className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutList className="w-3.5 h-3.5" /> Table</button><button type="button" onClick={() => setViewMode('timeline')} className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${viewMode === 'timeline' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><CalendarDays className="w-3.5 h-3.5" /> Timeline</button></div></div></div>
        {viewMode === 'table' ? <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Milestone</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Timeline</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filteredMilestones.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-500">No milestones match the current filters.</td></tr> : filteredMilestones.map((milestone) => <tr key={milestone.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{milestone.title}</strong><small className="text-[11px] text-slate-500">{milestone.description}</small></td><td className="px-3 py-4 text-xs text-slate-600">{projectNames.get(milestone.projectId) || 'Unassigned'}</td><td className="px-3 py-4 text-xs"><span className={isOverdue(milestone) ? 'font-bold text-rose-600' : isUpcoming(milestone) ? 'font-bold text-blue-600' : 'text-slate-600'}>{formatDate(milestone.startDate)} - {formatDate(milestone.dueDate)}</span>{isOverdue(milestone) && <small className="block text-[10px] text-rose-600 mt-1">Overdue</small>}{isUpcoming(milestone) && <small className="block text-[10px] text-blue-600 mt-1">Due within 7 days</small>}</td><td className="px-3 py-4 min-w-36"><div className="flex items-center gap-2"><div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${milestone.status === 'Completed' ? 'bg-emerald-600' : 'bg-brand-600'}`} style={{ width: `${milestone.progress}%` }} /></div><span className="text-xs font-semibold text-slate-700">{milestone.progress}%</span></div></td><td className="px-3 py-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${statusClass(milestone.status)}`}>{milestone.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}{milestone.status}</span></td><td className="px-3 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${priorityClass(milestone.priority)}`}>{milestone.priority}</span></td><td className="px-3 py-4"><div className="flex items-center gap-3"><button type="button" onClick={() => setViewingMilestone(milestone)} className="text-xs font-semibold text-slate-600 hover:text-slate-900" title="View milestone"><Eye className="w-3.5 h-3.5 inline mr-1" />View</button><button type="button" onClick={() => startEditing(milestone)} className="text-xs font-semibold text-blue-600 hover:text-blue-800" title="Edit milestone"><Pencil className="w-3.5 h-3.5 inline mr-1" />Edit</button><button type="button" onClick={() => deleteMilestone(milestone)} className="text-xs font-semibold text-rose-600 hover:text-rose-800" title="Delete milestone"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button></div></td></tr>)}</tbody></table></div> : <div className="relative ml-3 border-l-2 border-slate-200 pl-6 space-y-4">{filteredMilestones.length === 0 ? <p className="text-xs text-slate-500 py-5">No milestones match the current filters.</p> : filteredMilestones.slice().sort((a, b) => a.startDate.localeCompare(b.startDate)).map((milestone) => <div key={milestone.id} className="relative border border-slate-200 rounded-lg p-4 hover:border-brand-300 transition-colors"><span className={`absolute -left-[33px] top-5 w-3 h-3 rounded-full ring-4 ring-white ${milestone.status === 'Completed' ? 'bg-emerald-500' : isOverdue(milestone) ? 'bg-rose-500' : 'bg-brand-500'}`} /><div className="flex flex-col md:flex-row md:items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-slate-900">{milestone.title}</h4><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${priorityClass(milestone.priority)}`}>{milestone.priority}</span></div><p className="text-xs text-slate-500 mt-1">{projectNames.get(milestone.projectId) || 'Unassigned'} · {formatDate(milestone.startDate)} to {formatDate(milestone.dueDate)}</p><p className="text-xs text-slate-600 mt-3 max-w-3xl">{milestone.description}</p></div><div className="flex items-center gap-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${statusClass(milestone.status)}`}>{milestone.status}</span><strong className="text-sm text-slate-800">{milestone.progress}%</strong></div></div><div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${milestone.status === 'Completed' ? 'bg-emerald-600' : 'bg-brand-600'}`} style={{ width: `${milestone.progress}%` }} /></div></div>)}</div>}
      </section>

      {viewingMilestone && <div className="fixed inset-0 z-40 bg-slate-950/30 p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl"><div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusClass(viewingMilestone.status)}`}>{viewingMilestone.status}</span><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${priorityClass(viewingMilestone.priority)}`}>{viewingMilestone.priority} priority</span></div><h3 className="text-base font-bold text-slate-900 mt-2">{viewingMilestone.title}</h3><p className="text-xs text-slate-500 mt-1">{projectNames.get(viewingMilestone.projectId) || 'Unassigned'}</p></div><button type="button" onClick={() => setViewingMilestone(null)} className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Close milestone details"><X className="w-4 h-4" /></button></div><div className="p-5 space-y-5"><p className="text-sm text-slate-600 leading-relaxed">{viewingMilestone.description}</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><div><span className="text-[11px] text-slate-500 block">Start date</span><strong className="text-xs text-slate-800">{formatDate(viewingMilestone.startDate)}</strong></div><div><span className="text-[11px] text-slate-500 block">Due date</span><strong className={`text-xs ${isOverdue(viewingMilestone) ? 'text-rose-600' : 'text-slate-800'}`}>{formatDate(viewingMilestone.dueDate)}</strong></div><div><span className="text-[11px] text-slate-500 block">Progress</span><strong className="text-xs text-slate-800">{viewingMilestone.progress}%</strong></div><div><span className="text-[11px] text-slate-500 block">Schedule</span><strong className={`text-xs ${isOverdue(viewingMilestone) ? 'text-rose-600' : 'text-emerald-700'}`}>{isOverdue(viewingMilestone) ? 'Overdue' : isUpcoming(viewingMilestone) ? 'Upcoming' : 'On track'}</strong></div></div><div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-brand-600 h-full rounded-full" style={{ width: `${viewingMilestone.progress}%` }} /></div></div></div></div>}
    </div>
  );
};

export default MilestonesPage;