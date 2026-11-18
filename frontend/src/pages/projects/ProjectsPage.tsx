import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  MapPin,
  User,
  IndianRupee,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  HardHat,
  ArrowUpDown
} from 'lucide-react';
import {
  Project,
  ConstructionType,
  ProjectStatus,
  ProjectFormData,
} from '../../types';
import { formatINR, formatFullINR } from '../../services/storage';
import { assignProjectClient, ClientAccountRecord, createProjectRecord, deleteProjectRecord, fetchClientAccounts, fetchProjects, ProjectsApiError, updateProjectRecord } from '../../services/projectsApi';
import { getStoredAuthSession } from '../../services/auth';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // Form State
  const initialFormState: ProjectFormData = {
    projectCode: '',
    clientId: '',
    name: '',
    description: '',
    constructionType: 'COMMERCIAL',
    location: '',
    clientName: '',
    clientEmail: '',
    contractAmount: 2500000,
    approvedBudget: 2125000,
    amountPaid: 500000,
    plannedStartDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'PLANNING',
    progress: 0,
    projectManager: 'Er. Sachin More',
    contractorName: 'Aniket Desai',
  };

  const [formData, setFormData] = useState<ProjectFormData>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountRecord[]>([]);
  const isAdmin = getStoredAuthSession()?.user.role === 'ADMIN';

  // Load projects from storage
  const loadProjects = async () => {
    const session = getStoredAuthSession();
    if (!session?.token) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const records = await fetchProjects();
      setProjects(
        records.map((project) => ({
          ...project,
          constructionType: project.constructionType as Project['constructionType'],
          status: project.status as Project['status'],
          actualExpenses: project.actualExpenses ?? 0,
          amountPaid: project.amountPaid ?? 0,
          outstandingAmount: project.outstandingAmount ?? Math.max(0, project.contractAmount - (project.amountPaid ?? 0)),
          projectManager: project.projectManager || 'Unassigned',
          contractorName: project.contractorName || 'Aniket Desai',
          costRiskTier: project.costRiskTier || 'LOW',
          scheduleRiskTier: project.scheduleRiskTier || 'LOW',
          isDemoData: false,
        } as Project))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load projects.';
      setLoadError(message);
      if (error instanceof ProjectsApiError && (error.status === 401 || error.status === 403)) {
        setProjects([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    const statusParam = searchParams.get('status');
    const validStatuses = ['ALL', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'DELAYED'];
    setSelectedStatus(statusParam && validStatuses.includes(statusParam) ? statusParam : 'ALL');
    if (searchParams.get('create') === 'true') {
      setIsCreateModalOpen(true);
      // Clean query parameter
      setSearchParams(statusParam ? { status: statusParam } : {});
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchClientAccounts()
      .then(setClientAccounts)
      .catch((error) => setFormError(error instanceof Error ? error.message : 'Unable to load client accounts.'));
  }, [isAdmin]);

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === 'ALL' || selectedStatus === 'DELAYED'
      ? selectedStatus === 'ALL' || (p.status !== 'COMPLETED' && p.expectedCompletionDate < new Date().toISOString().split('T')[0])
      : p.status === selectedStatus;
    const matchesType = selectedType === 'ALL' || p.constructionType === selectedType;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Handle Form Change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'contractAmount' || name === 'approvedBudget' || name === 'progress'
          ? Number(value)
          : value,
    }));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      projectCode: project.projectCode,
      clientId: project.clientId || '',
      name: project.name,
      description: project.description,
      constructionType: project.constructionType,
      location: project.location,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      contractAmount: project.contractAmount,
      approvedBudget: project.approvedBudget,
      amountPaid: project.amountPaid || 0,
      plannedStartDate: project.plannedStartDate,
      expectedCompletionDate: project.expectedCompletionDate,
      status: project.status,
      progress: project.progress,
      projectManager: project.projectManager,
      contractorName: project.contractorName || 'Aniket Desai',
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    if (!formData.clientName.trim()) {
      setFormError('Client name is required.');
      return;
    }
    if (formData.contractAmount <= 0) {
      setFormError('Contract amount must be greater than zero.');
      return;
    }
    if (formData.approvedBudget > formData.contractAmount) {
      setFormError('Approved budget cannot exceed the total contracted amount.');
      return;
    }

    try {
      const payload = {
        projectCode: formData.projectCode || undefined,
        clientId: formData.clientId || undefined,
        name: formData.name,
        description: formData.description,
        constructionType: formData.constructionType,
        location: formData.location,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        contractAmount: formData.contractAmount,
        approvedBudget: formData.approvedBudget,
        plannedStartDate: formData.plannedStartDate,
        expectedCompletionDate: formData.expectedCompletionDate,
        actualCompletionDate: formData.expectedCompletionDate,
        status: formData.status,
        progress: formData.progress,
        projectManager: formData.projectManager,
        contractorName: formData.contractorName || 'Aniket Desai',
      };

      if (editingProject) {
        const { clientId, ...projectPayload } = payload;
        await updateProjectRecord(editingProject.id, projectPayload);
        if (isAdmin && clientId && clientId !== editingProject.clientId) {
          await assignProjectClient(editingProject.id, clientId);
        }
      } else {
        await createProjectRecord(payload);
      }

      setIsCreateModalOpen(false);
      await loadProjects();
    } catch (err: any) {
      setFormError(err.message || 'Error saving project.');
    }
  };

  // Handle Delete Project
  const handleConfirmDelete = async () => {
    if (deletingProject) {
      try {
        await deleteProjectRecord(deletingProject.id);
        setDeletingProject(null);
        await loadProjects();
      } catch (err: any) {
        setFormError(err.message || 'Error deleting project.');
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Construction Projects Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full project lifecycle tracking from quotation conversion to site execution and completion.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (window.confirm('Reset project data back to realistic initial contractor samples?')) {
                setProjects([]);
                void loadProjects();
              }
            }}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Reset Sample Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset Data</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-brand-600/30 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, code (e.g. PRJ-2026), location, or client..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-brand-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Statuses ({projects.length})</option>
            <option value="PLANNING">Planning ({projects.filter((project) => project.status === 'PLANNING').length})</option>
            <option value="IN_PROGRESS">In Progress ({projects.filter((project) => project.status === 'IN_PROGRESS').length})</option>
            <option value="ON_HOLD">On Hold ({projects.filter((project) => project.status === 'ON_HOLD').length})</option>
            <option value="COMPLETED">Completed ({projects.filter((project) => project.status === 'COMPLETED').length})</option>
            <option value="DELAYED">Delayed ({projects.filter((project) => project.status !== 'COMPLETED' && project.expectedCompletionDate < new Date().toISOString().split('T')[0]).length})</option>
          </select>

          {/* Construction Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Project Types</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="RENOVATION">Renovation</option>
          </select>

          {/* Grid/Table view toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <span>{loadError}</span>
          <button onClick={() => void loadProjects()} className="font-bold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {!loadError && projects.length > 0 && (
        <p className="text-xs text-slate-500">
          Showing {filteredProjects.length} of {projects.length} projects
        </p>
      )}

      {/* Projects Display: Table or Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">
            {loadError ? 'Projects Could Not Be Loaded' : projects.length > 0 ? 'No Projects Match These Filters' : 'No Projects Found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {loadError
              ? 'Check your session and backend connection, then retry.'
              : projects.length > 0
              ? 'No projects matched your search query or selected filters. Try clearing the filters.'
              : 'No projects are assigned to this account.'}
          </p>
          {projects.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('ALL');
                setSelectedType('ALL');
              }}
              className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Code & Project</th>
                  <th className="py-3.5 px-4">Client & Location</th>
                  <th className="py-3.5 px-4">Financials (INR)</th>
                  <th className="py-3.5 px-4">Timeline & PM</th>
                  <th className="py-3.5 px-4">Status & Progress</th>
                  <th className="py-3.5 px-4">Risk Flag</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Code & Project */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded font-bold border border-brand-200">
                          {project.projectCode}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.2 bg-slate-100 rounded">
                          {project.constructionType}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-xs mt-1 max-w-xs leading-snug">
                        {project.name}
                      </p>
                    </td>

                    {/* Client & Location */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800 text-xs">{project.clientName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{project.location}</span>
                      </p>
                    </td>

                    {/* Financials */}
                    <td className="py-3.5 px-4 font-medium">
                      <div className="text-slate-900 font-bold">{formatINR(project.contractAmount)}</div>
                      <div className="text-[11px] text-slate-500">
                        Budget: {formatINR(project.approvedBudget)}
                      </div>
                      <div className="text-[11px] text-brand-700 font-semibold">
                        Spent: {formatINR(project.actualExpenses)}
                      </div>
                    </td>

                    {/* Timeline & PM */}
                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{project.plannedStartDate} to {project.expectedCompletionDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>PM: {project.projectManager}</span>
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="py-3.5 px-4 min-w-[140px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-slate-800">{project.progress}%</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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

                    {/* Risk Tier */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
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
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingProject(project)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(project)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingProject(project)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded font-bold border border-brand-200">
                    {project.projectCode}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      project.costRiskTier === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : project.costRiskTier === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {project.costRiskTier} RISK
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-2 leading-snug line-clamp-1">
                  {project.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{project.clientName}</p>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{project.location}</span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contract Value:</span>
                    <strong className="text-slate-900">{formatINR(project.contractAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Approved Budget:</span>
                    <span className="font-semibold text-slate-800">{formatINR(project.approvedBudget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expenses Spent:</span>
                    <span className="font-bold text-brand-700">{formatINR(project.actualExpenses)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-600">Physical Progress</span>
                    <span className="font-bold text-slate-900">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">PM: {project.projectManager}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewingProject(project)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                    title="View"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(project)}
                    className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingProject(project)}
                    className="p-1.5 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: Create / Edit Project Modal
      ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingProject ? 'Edit Construction Project' : 'Create New Construction Project'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Morya Enterprises — Master Project Registration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Oberoi Splendor Residential Complex - Phase 2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Construction Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Construction Type
                  </label>
                  <select
                    name="constructionType"
                    value={formData.constructionType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="INFRASTRUCTURE">Infrastructure</option>
                    <option value="INDUSTRIAL">Industrial</option>
                    <option value="RENOVATION">Renovation</option>
                  </select>
                </div>

                {/* Project Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Code (Auto or Custom)
                  </label>
                  <input
                    type="text"
                    name="projectCode"
                    value={formData.projectCode}
                    onChange={handleInputChange}
                    placeholder="e.g. MORYA-PRJ-2026-007"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Location */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Site Location & Address *
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. Plot 42, Hinjewadi Phase 1, Pune, Maharashtra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client / Organization Name *
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    required
                    value={formData.clientName}
                    onChange={handleInputChange}
                    placeholder="e.g. Tata Housing Development Co."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Client Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client Email
                  </label>
                  <input
                    type="email"
                    name="clientEmail"
                    value={formData.clientEmail}
                    onChange={handleInputChange}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {isAdmin && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assign existing client account
                    </label>
                    <select
                      name="clientId"
                      value={formData.clientId || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">Use client details above</option>
                      {clientAccounts.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email}){client.userId ? ' — account linked' : ' — no login account'}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Select a client account to make this existing project visible in that client&apos;s portal.
                    </span>
                  </div>
                )}

                {/* Contract Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Contract Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    name="contractAmount"
                    required
                    min="1"
                    value={formData.contractAmount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Equivalent: {formatINR(formData.contractAmount)}
                  </span>
                </div>

                {/* Approved Budget */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Approved Contractor Budget (₹ INR) *
                  </label>
                  <input
                    type="number"
                    name="approvedBudget"
                    required
                    min="1"
                    value={formData.approvedBudget}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Planned Margin: {formatINR(Math.max(0, formData.contractAmount - formData.approvedBudget))}
                  </span>
                </div>

                {/* Amount Paid by Client */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client Payments Received (₹ INR)
                  </label>
                  <input
                    type="number"
                    name="amountPaid"
                    min="0"
                    value={formData.amountPaid || 0}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none font-semibold text-emerald-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Pending Due: {formatINR(Math.max(0, formData.contractAmount - (formData.amountPaid || 0)))}
                  </span>
                </div>

                {/* Planned Start Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Planned Start Date
                  </label>
                  <input
                    type="date"
                    name="plannedStartDate"
                    value={formData.plannedStartDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Expected Completion Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expected Completion Date
                  </label>
                  <input
                    type="date"
                    name="expectedCompletionDate"
                    value={formData.expectedCompletionDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Assigned Project Manager */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Project Manager
                  </label>
                  <select
                    name="projectManager"
                    value={formData.projectManager}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="Er. Sachin More">Er. Sachin More (Senior Project Manager)</option>
                    <option value="Er. Nikhil Jagtap">Er. Nikhil Jagtap (Finishing & Interiors)</option>
                    <option value="Er. Rajesh Morya">Er. Rajesh Morya (Chief Structural Engineer)</option>
                    <option value="Er. Amit Kulkarni">Er. Amit Kulkarni (Civil Works Lead)</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                {/* Progress % */}
                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Physical Milestone Completion Progress: {formData.progress}%
                    </label>
                  </div>
                  <input
                    type="range"
                    name="progress"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={handleInputChange}
                    className="w-full accent-brand-600"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scope of Work & Engineering Notes
                  </label>
                  <textarea
                    rows={2}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Structural description, milestones, floor configurations, foundation specifications..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-brand-600/30 transition-all"
                >
                  {editingProject ? 'Save Changes' : 'Create Construction Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: View Project Details Modal
      ========================================================================= */}
      {viewingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div>
                <span className="font-mono text-xs bg-brand-600/30 text-brand-400 border border-brand-500/40 px-2 py-0.5 rounded font-bold">
                  {viewingProject.projectCode}
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5">{viewingProject.name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{viewingProject.location}</p>
              </div>
              <button
                onClick={() => setViewingProject(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-semibold block text-[11px]">Contract Value</span>
                  <strong className="text-sm text-slate-900 block mt-1">{formatFullINR(viewingProject.contractAmount)}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-semibold block text-[11px]">Approved Budget</span>
                  <strong className="text-sm text-slate-900 block mt-1">{formatFullINR(viewingProject.approvedBudget)}</strong>
                </div>
                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200">
                  <span className="text-brand-800 font-semibold block text-[11px]">Actual Expenses</span>
                  <strong className="text-sm text-brand-700 block mt-1">{formatFullINR(viewingProject.actualExpenses)}</strong>
                </div>
              </div>

              {/* Progress & Risk */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">Physical Milestone Progress</span>
                  <span className="font-extrabold text-slate-900 text-sm">{viewingProject.progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-600 h-full rounded-full"
                    style={{ width: `${viewingProject.progress}%` }}
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <div>
                    <span className="text-slate-500">AI Cost Overrun Risk: </span>
                    <strong className="text-rose-600 font-bold">{viewingProject.costRiskTier} ({viewingProject.costRiskScore}/100)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Status: </span>
                    <strong className="text-slate-800 font-bold uppercase">{viewingProject.status}</strong>
                  </div>
                </div>
              </div>

              {/* Scope & Details */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800">Project Scope & Engineering Brief:</h4>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {viewingProject.description || 'No engineering brief specified.'}
                </p>
              </div>

              {/* Client & PM info */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client Details</span>
                  <p className="font-semibold text-slate-800">{viewingProject.clientName}</p>
                  <p className="text-slate-500 text-[11px]">{viewingProject.clientEmail}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Project Manager</span>
                  <p className="font-semibold text-slate-800">{viewingProject.projectManager}</p>
                  <p className="text-slate-500 text-[11px]">Timeline: {viewingProject.plannedStartDate} - {viewingProject.expectedCompletionDate}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setViewingProject(null);
                  handleOpenEdit(viewingProject);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </button>
              <button
                onClick={() => setViewingProject(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: Confirm Delete Modal
      ========================================================================= */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-slate-900 text-base">Delete Construction Project?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-800 font-semibold">{deletingProject.name}</strong> (
                {deletingProject.projectCode})?
              </p>
              <p className="text-[11px] text-rose-600 mt-2 font-medium bg-rose-50 p-2 rounded border border-rose-100">
                Warning: This project will be removed from all active budgets, expenses, and AI tracking.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-rose-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
