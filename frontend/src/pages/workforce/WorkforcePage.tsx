import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  IndianRupee,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { formatFullINR, formatINR } from '../../services/storage';
import { Project } from '../../types';
import { fetchProjects } from '../../services/projectsApi';
import { createAttendance, createWorker, deleteWorker as deleteWorkerApi, fetchWorkforce, updateAttendance, updateWorker } from '../../services/operationsApi';

type WorkerStatus = 'Active' | 'Inactive';
type AttendanceStatus = 'Present' | 'Absent' | 'Half-day' | 'Overtime';

interface Worker {
  id: string;
  name: string;
  phone: string;
  trade: string;
  dailyWage: number;
  projectId: string;
  status: WorkerStatus;
}

interface AttendanceRecord {
  id: string;
  workerId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

interface WorkerFormData {
  name: string;
  phone: string;
  trade: string;
  dailyWage: string;
  projectId: string;
  status: WorkerStatus;
}

interface AttendanceFormData {
  workerId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

const attendanceStatuses: AttendanceStatus[] = ['Present', 'Absent', 'Half-day', 'Overtime'];
const trades = ['Mason', 'Steel Fixer', 'Electrician', 'Carpenter', 'Plumber', 'Painter', 'Helper', 'Other'];

const today = () => new Date().toISOString().split('T')[0];

const emptyWorkerForm = (projectId = ''): WorkerFormData => ({
  name: '',
  phone: '',
  trade: 'Mason',
  dailyWage: '',
  projectId,
  status: 'Active',
});

const emptyAttendanceForm = (workerId = ''): AttendanceFormData => ({
  workerId,
  date: today(),
  status: 'Present',
  note: '',
});

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

const attendanceMultiplier: Record<AttendanceStatus, number> = {
  Present: 1,
  Overtime: 1.5,
  'Half-day': 0.5,
  Absent: 0,
};

const labourCost = (worker: Worker, status: AttendanceStatus) => worker.dailyWage * attendanceMultiplier[status];

export const WorkforcePage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [workerForm, setWorkerForm] = useState<WorkerFormData>(emptyWorkerForm());
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormData>(emptyAttendanceForm());
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [viewingWorker, setViewingWorker] = useState<Worker | null>(null);
  const [workerError, setWorkerError] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([fetchProjects(), fetchWorkforce()]).then(([projectRecords, workforceData]) => {
      const currentProjects = projectRecords as Project[];
      setProjects(currentProjects);
      const { workers: records, attendance: attendanceRecords } = workforceData;
      const nextAttendance = attendanceRecords.map((a) => ({ id: a.id, workerId: a.workerId, date: a.date, status: ({ PRESENT: 'Present', ABSENT: 'Absent', HALF_DAY: 'Half-day', OVERTIME: 'Overtime' } as const)[a.status], note: a.notes || '' }));
      const nextWorkers = records.map((w) => ({ id: w.id, name: w.fullName, phone: w.phone || '', trade: ({ MASON: 'Mason', CARPENTER: 'Carpenter', STEEL_FIXER: 'Steel Fixer', ELECTRICIAN: 'Electrician', PLUMBER: 'Plumber', PAINTER: 'Painter', GENERAL_LABOUR: 'Helper', WELDER: 'Other', HEAVY_OPERATOR: 'Other', SITE_SUPERVISOR: 'Other' } as Record<string, string>)[w.tradeSkill] || 'Other', dailyWage: w.dailyWageRate, projectId: nextAttendance.find((a) => a.workerId === w.id)?.workerId ? (attendanceRecords.find((a) => a.workerId === w.id)?.projectId || '') : '', status: w.isActive ? 'Active' : 'Inactive' }));
      setWorkers(nextWorkers as Worker[]);
      setAttendance(nextAttendance);
      setWorkerForm(emptyWorkerForm(currentProjects[0]?.id || ''));
      setAttendanceForm(emptyAttendanceForm(nextWorkers[0]?.id || ''));
    }).catch((error: Error) => setLoadError(error.message)).finally(() => setLoading(false));
  }, []);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const todayAttendance = useMemo(() => new Map(attendance.filter((record) => record.date === today()).map((record) => [record.workerId, record])), [attendance]);
  const activeWorkers = workers.filter((worker) => worker.status === 'Active');
  const presentToday = activeWorkers.filter((worker) => todayAttendance.get(worker.id)?.status === 'Present').length;
  const absentToday = activeWorkers.filter((worker) => todayAttendance.get(worker.id)?.status === 'Absent').length;
  const todayCost = activeWorkers.reduce((sum, worker) => {
    const record = todayAttendance.get(worker.id);
    return sum + (record ? labourCost(worker, record.status) : 0);
  }, 0);

  const filteredWorkers = workers.filter((worker) => {
    const attendanceStatus = todayAttendance.get(worker.id)?.status || 'Unrecorded';
    const matchesSearch = [worker.name, worker.phone, worker.trade, projectNames.get(worker.projectId) || '']
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return (
      matchesSearch &&
      (tradeFilter === 'ALL' || worker.trade === tradeFilter) &&
      (projectFilter === 'ALL' || worker.projectId === projectFilter) &&
      (attendanceFilter === 'ALL' || attendanceStatus === attendanceFilter)
    );
  });

  const updateWorkerForm = (name: keyof WorkerFormData, value: string) => {
    setWorkerForm((current) => ({ ...current, [name]: value }));
    setWorkerError('');
  };

  const updateAttendanceForm = (name: keyof AttendanceFormData, value: string) => {
    setAttendanceForm((current) => ({ ...current, [name]: value }));
    setAttendanceError('');
  };

  const handleWorkerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const dailyWage = Number(workerForm.dailyWage);
    if (!workerForm.name.trim() || !workerForm.phone.trim() || !workerForm.trade || !workerForm.projectId) {
      setWorkerError('Name, phone, trade, and assigned project are required.');
      return;
    }
    if (!/^\d{10}$/.test(workerForm.phone.trim())) {
      setWorkerError('Enter a valid 10-digit phone number.');
      return;
    }
    if (!Number.isFinite(dailyWage) || dailyWage <= 0) {
      setWorkerError('Daily wage must be greater than zero.');
      return;
    }
    const tradeSkill = ({ Mason: 'MASON', 'Steel Fixer': 'STEEL_FIXER', Electrician: 'ELECTRICIAN', Carpenter: 'CARPENTER', Plumber: 'PLUMBER', Painter: 'PAINTER', Helper: 'GENERAL_LABOUR', Other: 'GENERAL_LABOUR' } as Record<string, string>)[workerForm.trade] || 'GENERAL_LABOUR';
    let savedWorker: Worker;
    try {
      const payload = { employeeCode: editingWorkerId || `EMP-${Date.now()}`, fullName: workerForm.name.trim(), tradeSkill, phone: workerForm.phone.trim(), dailyWageRate: dailyWage, hourlyOvertimeRate: dailyWage / 8, isActive: workerForm.status === 'Active' };
      const result = editingWorkerId ? await updateWorker(editingWorkerId, payload) : await createWorker(payload);
      const w = result.worker;
      savedWorker = { id: w.id, name: w.fullName, phone: w.phone || '', trade: workerForm.trade, dailyWage: w.dailyWageRate, projectId: workerForm.projectId, status: w.isActive ? 'Active' : 'Inactive' };
      setWorkers((current) => editingWorkerId ? current.map((item) => item.id === savedWorker.id ? savedWorker : item) : [savedWorker, ...current]);
    } catch (error) { setWorkerError((error as Error).message); return; }
    setWorkerForm(emptyWorkerForm(savedWorker.projectId));
    setEditingWorkerId(null);
    setWorkerError('');
    setAttendanceForm((current) => ({ ...current, workerId: current.workerId || savedWorker.id }));
  };

  const handleAttendanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attendanceForm.workerId || !attendanceForm.date) {
      setAttendanceError('Select a worker and attendance date.');
      return;
    }
    const existing = attendance.find((record) => record.workerId === attendanceForm.workerId && record.date === attendanceForm.date);
    const worker = workers.find((item) => item.id === attendanceForm.workerId);
    if (!worker?.projectId) { setAttendanceError('Assign the worker to a project before recording attendance.'); return; }
    try {
      const payload = { workerId: worker.id, projectId: worker.projectId, date: attendanceForm.date, status: ({ Present: 'PRESENT', Absent: 'ABSENT', 'Half-day': 'HALF_DAY', Overtime: 'OVERTIME' } as Record<string, string>)[attendanceForm.status], regularHours: attendanceForm.status === 'Absent' ? 0 : attendanceForm.status === 'Half-day' ? 4 : 8, overtimeHours: attendanceForm.status === 'Overtime' ? 4 : 0, notes: attendanceForm.note.trim() || null };
      const result = existing ? await updateAttendance(existing.id, payload) : await createAttendance(payload);
      const nextRecord: AttendanceRecord = { id: result.attendance.id, workerId: result.attendance.workerId, date: result.attendance.date, status: attendanceForm.status, note: result.attendance.notes || '' };
      setAttendance((current) => existing ? current.map((record) => record.id === existing.id ? nextRecord : record) : [nextRecord, ...current]);
    } catch (error) { setAttendanceError((error as Error).message); return; }
    setAttendanceForm(emptyAttendanceForm(attendanceForm.workerId));
    setAttendanceError('');
  };

  const startEditing = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setWorkerForm({ ...worker, dailyWage: String(worker.dailyWage) });
    setWorkerError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteWorker = async (worker: Worker) => {
    if (window.confirm(`Delete ${worker.name}? Their attendance history will also be removed.`)) {
      try { await deleteWorkerApi(worker.id); } catch (error) { setWorkerError((error as Error).message); return; }
      setWorkers((current) => current.filter((item) => item.id !== worker.id));
      setAttendance((current) => current.filter((record) => record.workerId !== worker.id));
      if (editingWorkerId === worker.id) {
        setEditingWorkerId(null);
        setWorkerForm(emptyWorkerForm(projects[0]?.id || ''));
      }
      if (viewingWorker?.id === worker.id) setViewingWorker(null);
      if (attendanceForm.workerId === worker.id) setAttendanceForm(emptyAttendanceForm(workers.find((item) => item.id !== worker.id)?.id || ''));
    }
  };

  const summaryCards = [
    { label: 'Total Workers', value: String(workers.length), icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Present Today', value: String(presentToday), icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Absent Today', value: String(absentToday), icon: AlertCircle, color: 'text-rose-600 bg-rose-50' },
    { label: "Today's Labour Cost", value: formatINR(todayCost), icon: IndianRupee, color: 'text-brand-600 bg-amber-50' },
  ];

  const workerHistory = viewingWorker ? attendance.filter((record) => record.workerId === viewingWorker.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><Users className="w-3.5 h-3.5" /> Site workforce control</div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Workforce & Labour</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage worker assignments, attendance, and daily labour cost across sites.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected to API</span>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading workforce…</p>}
      {loadError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Unable to load workforce: {loadError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div></div><p className="text-xl font-extrabold text-slate-900 mt-2.5 truncate">{value}</p></div>)}
      </div>

      <section className="bg-blue-50/70 border border-blue-200 rounded-xl p-5"><div className="flex items-start gap-3"><Clock3 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /><div><h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide">Daily labour cost rules</h3><p className="text-xs text-blue-900 mt-1 leading-relaxed">Present = 100% of daily wage. Overtime = 150%. Half-day = 50%. Absent = 0%. Today&apos;s total includes active workers with an attendance record for today.</p></div></div></section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">{editingWorkerId ? 'Edit worker' : 'Add worker'}</h3><p className="text-xs text-slate-500 mt-1">Keep worker contact, skill, wage, and project assignment current.</p></div>{editingWorkerId && <button type="button" onClick={() => { setEditingWorkerId(null); setWorkerForm(emptyWorkerForm(projects[0]?.id || '')); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>}</div>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5" onSubmit={handleWorkerSubmit}>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Worker name<input className="mt-1" value={workerForm.name} onChange={(event) => updateWorkerForm('name', event.target.value)} placeholder="e.g. Ramesh Shinde" /></label>
            <label className="text-xs font-bold text-slate-600">Phone number<input className="mt-1" inputMode="numeric" maxLength={10} value={workerForm.phone} onChange={(event) => updateWorkerForm('phone', event.target.value.replace(/\D/g, ''))} placeholder="10-digit number" /></label>
            <label className="text-xs font-bold text-slate-600">Trade / skill<select className="mt-1" value={workerForm.trade} onChange={(event) => updateWorkerForm('trade', event.target.value)}>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Daily wage (₹)<input className="mt-1" type="number" min="1" step="0.01" value={workerForm.dailyWage} onChange={(event) => updateWorkerForm('dailyWage', event.target.value)} placeholder="0" /></label>
            <label className="text-xs font-bold text-slate-600">Assigned project<select className="mt-1" value={workerForm.projectId} onChange={(event) => updateWorkerForm('projectId', event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Worker status<select className="mt-1" value={workerForm.status} onChange={(event) => updateWorkerForm('status', event.target.value)}><option>Active</option><option>Inactive</option></select></label>
            <div className="sm:col-span-2 flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingWorkerId ? 'Update worker' : 'Add worker'}</button>{workerError && <p className="text-xs font-semibold text-rose-600" role="alert">{workerError}</p>}</div>
          </form>
        </section>

        <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div><h3 className="text-sm font-bold text-slate-900">Record attendance</h3><p className="text-xs text-slate-500 mt-1">Save one attendance status per worker and date.</p></div>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5" onSubmit={handleAttendanceSubmit}>
            <label className="text-xs font-bold text-slate-600">Worker<select className="mt-1" value={attendanceForm.workerId} onChange={(event) => updateAttendanceForm('workerId', event.target.value)}><option value="">Select worker</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Attendance status<select className="mt-1" value={attendanceForm.status} onChange={(event) => updateAttendanceForm('status', event.target.value)}>{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Date<input className="mt-1" type="date" value={attendanceForm.date} onChange={(event) => updateAttendanceForm('date', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600">Note<input className="mt-1" value={attendanceForm.note} onChange={(event) => updateAttendanceForm('note', event.target.value)} placeholder="Shift or leave note" /></label>
            <div className="sm:col-span-2 flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Save attendance</button>{attendanceError && <p className="text-xs font-semibold text-rose-600" role="alert">{attendanceError}</p>}</div>
          </form>
        </section>
      </div>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5"><div><h3 className="text-sm font-bold text-slate-900">Worker register</h3><p className="text-xs text-slate-500 mt-1">{filteredWorkers.length} of {workers.length} workers shown.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full lg:w-auto"><div className="relative sm:col-span-2 lg:col-span-1"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input className="!pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search workers..." /></div><select value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}><option value="ALL">All trades</option>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="ALL">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)}><option value="ALL">All attendance</option><option>Present</option><option>Absent</option><option>Half-day</option><option>Overtime</option><option>Unrecorded</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Worker</th><th className="px-3 py-3">Trade</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Daily wage</th><th className="px-3 py-3">Today</th><th className="px-3 py-3">Today&apos;s cost</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filteredWorkers.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-500">No workers match the current filters.</td></tr> : filteredWorkers.map((worker) => { const record = todayAttendance.get(worker.id); const status = record?.status || 'Unrecorded'; return <tr key={worker.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{worker.name}</strong><small className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {worker.phone}</small></td><td className="px-3 py-4 text-xs text-slate-600">{worker.trade}</td><td className="px-3 py-4 text-xs text-slate-600">{projectNames.get(worker.projectId) || 'Unassigned'}</td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{formatFullINR(worker.dailyWage)}</td><td className="px-3 py-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${status === 'Present' ? 'bg-emerald-100 text-emerald-700' : status === 'Overtime' ? 'bg-blue-100 text-blue-700' : status === 'Half-day' ? 'bg-amber-100 text-amber-700' : status === 'Absent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{status === 'Present' && <CheckCircle2 className="w-3 h-3" />}{status}</span></td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{record ? formatFullINR(labourCost(worker, record.status)) : '-'}</td><td className="px-3 py-4"><span className={`text-[10px] font-bold uppercase ${worker.status === 'Active' ? 'text-emerald-700' : 'text-slate-500'}`}>{worker.status}</span></td><td className="px-3 py-4"><div className="flex items-center gap-3"><button type="button" onClick={() => setViewingWorker(worker)} className="text-xs font-semibold text-slate-600 hover:text-slate-900" title="View worker"><Eye className="w-3.5 h-3.5 inline mr-1" />View</button><button type="button" onClick={() => startEditing(worker)} className="text-xs font-semibold text-blue-600 hover:text-blue-800" title="Edit worker"><Pencil className="w-3.5 h-3.5 inline mr-1" />Edit</button><button type="button" onClick={() => deleteWorker(worker)} className="text-xs font-semibold text-rose-600 hover:text-rose-800" title="Delete worker"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button></div></td></tr>; })}</tbody></table></div>
      </section>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><div className="flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-bold text-slate-900">Attendance and labour-cost history</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Date</th><th className="px-3 py-3">Worker</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Attendance</th><th className="px-3 py-3">Daily wage</th><th className="px-3 py-3">Calculated cost</th><th className="px-3 py-3">Note</th></tr></thead><tbody>{attendance.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-500">No attendance history recorded.</td></tr> : attendance.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((record) => { const worker = workers.find((item) => item.id === record.workerId); return <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 text-xs text-slate-600">{formatDate(record.date)}</td><td className="px-3 py-3 text-xs font-semibold text-slate-800">{worker?.name || 'Deleted worker'}</td><td className="px-3 py-3 text-xs text-slate-600">{worker ? projectNames.get(worker.projectId) || 'Unassigned' : '-'}</td><td className="px-3 py-3 text-xs font-semibold text-slate-700">{record.status}</td><td className="px-3 py-3 text-xs text-slate-600">{worker ? formatFullINR(worker.dailyWage) : '-'}</td><td className="px-3 py-3 text-xs font-semibold text-slate-800">{worker ? formatFullINR(labourCost(worker, record.status)) : '-'}</td><td className="px-3 py-3 text-xs text-slate-500">{record.note || '-'}</td></tr>; })}</tbody></table></div><p className="text-[11px] text-slate-400 mt-3">Showing the latest 20 attendance records. History remains stored locally for this prototype.</p></section>

      {viewingWorker && <div className="fixed inset-0 z-40 bg-slate-950/30 p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center"><UserRound className="w-5 h-5" /></div><div><h3 className="text-base font-bold text-slate-900">{viewingWorker.name}</h3><p className="text-xs text-slate-500">{viewingWorker.trade} · {projectNames.get(viewingWorker.projectId) || 'Unassigned'}</p></div></div><button type="button" onClick={() => setViewingWorker(null)} className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Close worker details"><X className="w-4 h-4" /></button></div><div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-100"><div><span className="text-[11px] text-slate-500 block">Phone</span><strong className="text-xs text-slate-800">{viewingWorker.phone}</strong></div><div><span className="text-[11px] text-slate-500 block">Daily wage</span><strong className="text-xs text-slate-800">{formatFullINR(viewingWorker.dailyWage)}</strong></div><div><span className="text-[11px] text-slate-500 block">Status</span><strong className="text-xs text-emerald-700">{viewingWorker.status}</strong></div><div><span className="text-[11px] text-slate-500 block">History rows</span><strong className="text-xs text-slate-800">{workerHistory.length}</strong></div></div><div className="p-5"><h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Attendance history</h4>{workerHistory.length === 0 ? <p className="text-xs text-slate-500">No attendance history for this worker.</p> : <div className="space-y-2">{workerHistory.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2.5"><div><strong className="text-xs text-slate-800 block">{formatDate(record.date)}</strong><span className="text-[11px] text-slate-500">{record.note || 'No note'}</span></div><div className="text-right"><span className="text-xs font-semibold text-slate-700 block">{record.status}</span><span className="text-[11px] text-slate-500">{formatFullINR(labourCost(viewingWorker, record.status))}</span></div></div>)}</div>}</div></div></div>}
    </div>
  );
};

export default WorkforcePage;