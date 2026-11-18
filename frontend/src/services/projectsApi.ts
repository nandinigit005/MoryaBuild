import { getStoredAuthSession } from './auth';

export class ProjectsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProjectsApiError';
    this.status = status;
  }
}

export interface ProjectApiRecord {
  id: string;
  projectCode: string;
  name: string;
  description: string;
  constructionType: string;
  location: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  contractAmount: number;
  approvedBudget: number;
  actualExpenses: number;
  amountPaid: number;
  outstandingAmount: number;
  plannedStartDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string | null;
  status: string;
  progress: number;
  projectManagerId?: string | null;
  projectManager: string;
  contractorName: string;
  costRiskScore?: number;
  costRiskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  scheduleRiskScore?: number;
  scheduleRiskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt?: string;
  isDemoData?: boolean;
}

export interface ClientAccountRecord {
  id: string;
  name: string;
  email: string;
  userId: string | null;
  user?: { name: string; email: string; isActive: boolean } | null;
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';

const getAuthHeaders = (): HeadersInit => {
  const session = getStoredAuthSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
};

export const fetchProjects = async (): Promise<ProjectApiRecord[]> => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProjectsApiError(data?.error || 'Unable to load projects.', response.status);
  }

  if (!Array.isArray(data.projects)) {
    throw new ProjectsApiError('The projects API returned an invalid response.', response.status);
  }

  return data.projects;
};

export const fetchProjectById = async (id: string): Promise<ProjectApiRecord> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProjectsApiError(data?.error || 'Unable to load project.', response.status);
  }

  if (!data.project) {
    throw new ProjectsApiError('The project API returned an invalid response.', response.status);
  }

  return data.project;
};

export const createProjectRecord = async (payload: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to create project.');
  }

  return data.project;
};

export const updateProjectRecord = async (id: string, payload: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to update project.');
  }

  return data.project;
};

export const deleteProjectRecord = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to delete project.');
  }

  return data;
};

export const fetchClientAccounts = async (): Promise<ClientAccountRecord[]> => {
  const response = await fetch(`${API_BASE_URL}/projects/clients`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProjectsApiError(data?.error || 'Unable to load client accounts.', response.status);
  return Array.isArray(data.clients) ? data.clients : [];
};

export const assignProjectClient = async (projectId: string, clientId: string): Promise<ProjectApiRecord> => {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/client`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ clientId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProjectsApiError(data?.error || 'Unable to assign project.', response.status);
  return data.project as ProjectApiRecord;
};