import React, { useEffect, useState } from 'react';
import { Building2, CalendarDays, MapPin, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchProjects, ProjectApiRecord } from '../../services/projectsApi';

export const ClientProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchProjects()
      .then((records) => { if (active) setProjects(records); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load your projects.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredProjects = projects.filter((project) => [project.name, project.location, project.projectCode].join(' ').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading your projects...</div>;

  return (
    <div className="space-y-6">
      <div><p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Client workspace</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">My Projects</h2><p className="mt-1 text-sm text-slate-500">View progress and key dates for projects linked to your account.</p></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your projects..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-500" /></div>
      {filteredProjects.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><Building2 className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 text-sm font-bold text-slate-700">{projects.length ? 'No projects match your search' : 'No projects are linked to your account'}</h3><p className="mt-1 text-xs text-slate-500">Only projects authorized for your client profile appear here.</p></div> : <div className="grid gap-5 lg:grid-cols-2">{filteredProjects.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{project.projectCode}</p><h3 className="mt-1 text-lg font-extrabold text-slate-900 group-hover:text-brand-700">{project.name}</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{project.status.replace('_', ' ')}</span></div><div className="mt-5 grid gap-3 text-xs text-slate-500 sm:grid-cols-2"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" />{project.location}</span><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-600" />Expected {project.expectedCompletionDate || 'Not available'}</span></div><div className="mt-6"><div className="flex items-center justify-between text-xs font-bold text-slate-600"><span>Current progress</span><span className="text-brand-700">{project.progress}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(project.progress, 100)}%` }} /></div></div><p className="mt-5 text-xs font-bold text-brand-700">Open project details</p></Link>)}</div>}
    </div>
  );
};

export default ClientProjectsPage;
