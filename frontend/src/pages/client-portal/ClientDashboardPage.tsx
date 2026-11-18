import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStoredAuthSession } from '../../services/auth';
import { fetchProjects, ProjectApiRecord } from '../../services/projectsApi';

export const ClientDashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const clientName = getStoredAuthSession()?.user.name || 'Client';

  useEffect(() => {
    let active = true;
    void fetchProjects()
      .then((records) => { if (active) setProjects(records); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load your projects.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const inProgress = projects.filter((project) => project.status === 'IN_PROGRESS').length;
  const completed = projects.filter((project) => project.status === 'COMPLETED').length;
  const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0;

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading your dashboard...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-300">Client dashboard</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Welcome back, {clientName}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Here is a simple view of the construction projects connected to your account.</p>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'My projects', value: projects.length, icon: Building2, tone: 'bg-blue-50 text-blue-700' },
          { label: 'In progress', value: inProgress, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Completed', value: completed, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p></div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">Overall progress</h3><p className="mt-1 text-xs text-slate-500">Average progress across your linked projects.</p></div><strong className="text-lg text-brand-700">{averageProgress}%</strong></div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${averageProgress}%` }} /></div>
      </section>

      {projects.length === 0 && !error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No projects are linked to your client account yet.</div> : <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Recent projects</h3><Link to="/projects" className="flex items-center gap-1 text-xs font-bold text-brand-700">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="grid gap-4 lg:grid-cols-2">{projects.slice(0, 4).map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{project.projectCode}</p><h4 className="mt-1 font-bold text-slate-900">{project.name}</h4></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{project.status.replace('_', ' ')}</span></div><p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{project.location}</p><div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>Progress</span><span>{project.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(project.progress, 100)}%` }} /></div></Link>)}</div></section>}
    </div>
  );
};

export default ClientDashboardPage;
