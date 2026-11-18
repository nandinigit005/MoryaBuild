import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import { fetchProjects, ProjectApiRecord } from '../../services/projectsApi';
import { fetchMilestones, MilestoneApiRecord } from '../../services/operationsApi';

export const ClientPortalPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [milestones, setMilestones] = useState<MilestoneApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([fetchProjects(), fetchMilestones()])
      .then(([projectRecords, milestoneData]) => {
        if (active) {
          setProjects(projectRecords);
          setMilestones(milestoneData.milestones);
        }
      })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load portal updates.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading your portal...</div>;

  return (
    <div className="space-y-6">
      <div><p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Client portal</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Project updates</h2><p className="mt-1 text-sm text-slate-500">A focused view of progress updates shared for your construction projects.</p></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}
      {projects.length === 0 && !error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No project updates are available for your account.</div> : <div className="space-y-4">{projects.map((project) => { const projectMilestones = milestones.filter((milestone) => milestone.projectId === project.id); return <section key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{project.projectCode}</p><h3 className="mt-1 text-base font-bold text-slate-900">{project.name}</h3><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{project.location}</p></div><span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{project.status.replace('_', ' ')}</span></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><div className="flex justify-between text-xs font-bold text-slate-600"><span>Overall progress</span><span className="text-brand-700">{project.progress}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(project.progress, 100)}%` }} /></div></div><div className="text-xs text-slate-500">Expected completion<br /><strong className="text-slate-800">{project.expectedCompletionDate || 'Not available'}</strong></div></div><div className="mt-5 border-t border-slate-100 pt-4"><h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><BellRing className="h-3.5 w-3.5 text-brand-600" />Latest milestone updates</h4>{projectMilestones.length === 0 ? <p className="mt-3 text-sm text-slate-500">No milestone updates are available yet.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{projectMilestones.slice(0, 4).map((milestone) => <div key={milestone.id} className="rounded-lg bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-slate-700">{milestone.name}</span><Clock3 className="h-4 w-4 flex-shrink-0 text-brand-600" /></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(milestone.progressPercentage, 100)}%` }} /></div><p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><CheckCircle2 className="h-3 w-3" />{milestone.status.replace(/_/g, ' ')}</p></div>)}</div>}</div></section>; })}</div>}
    </div>
  );
};

export default ClientPortalPage;
