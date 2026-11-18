import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchProjectById, ProjectApiRecord } from '../../services/projectsApi';
import { fetchMilestones, MilestoneApiRecord } from '../../services/operationsApi';

export const ClientProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectApiRecord | null>(null);
  const [milestones, setMilestones] = useState<MilestoneApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([fetchProjectById(id), fetchMilestones()])
      .then(([projectRecord, milestoneData]) => {
        if (!active) return;
        setProject(projectRecord);
        setMilestones(milestoneData.milestones.filter((milestone) => milestone.projectId === id));
      })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load project details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading project details...</div>;
  if (!project) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{error || 'Project not found or unavailable.'}</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />Back to My Projects</button>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-300">{project.projectCode}</p><h1 className="mt-2 text-2xl font-extrabold">{project.name}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4" />{project.location}</p></div><span className="self-start rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">{project.status.replace('_', ' ')}</span></div></section>
      <section className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Progress</p><p className="mt-2 text-2xl font-extrabold text-brand-700">{project.progress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(project.progress, 100)}%` }} /></div></div><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Expected completion</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays className="h-4 w-4 text-brand-600" />{project.expectedCompletionDate || 'Not available'}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Project location</p><p className="mt-2 text-sm font-bold text-slate-900">{project.location}</p></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-bold text-slate-900">Project overview</h2><p className="mt-3 text-sm leading-6 text-slate-600">{project.description || 'No project overview is available yet.'}</p></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Milestone progress</h2><p className="mt-1 text-xs text-slate-500">Updates shared for this project.</p></div><Clock3 className="h-5 w-5 text-brand-600" /></div>{milestones.length === 0 ? <p className="mt-5 text-sm text-slate-500">No milestone updates are available yet.</p> : <div className="mt-5 space-y-4">{milestones.map((milestone) => <div key={milestone.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{milestone.name}</span><span className="font-bold text-brand-700">{milestone.progressPercentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(milestone.progressPercentage, 100)}%` }} /></div><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5" />{milestone.status.replace(/_/g, ' ')}</p></div>)}</div>}</section>
    </div>
  );
};

export default ClientProjectDetailPage;
