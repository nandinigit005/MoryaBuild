import { getStoredAuthSession } from './auth';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';

export class OperationsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OperationsApiError';
    this.status = status;
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const session = getStoredAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new OperationsApiError(data?.error || 'Request failed.', response.status);
  return data as T;
};

export interface MaterialApiRecord {
  id: string; code: string; name: string; category: string; unit: string;
  currentStock: number; minimumThreshold: number; unitPrice: number;
  supplier?: { name?: string } | null;
}
export interface MovementApiRecord {
  id: string; materialId: string; movementType: 'PURCHASE_RECEIPT' | 'PROJECT_CONSUMPTION' | 'RETURN_TO_SUPPLIER' | 'WASTAGE_ADJUSTMENT';
  quantity: number; createdAt: string; notes?: string | null;
}
export interface WorkerApiRecord {
  id: string; employeeCode: string; fullName: string; tradeSkill: string; phone?: string | null;
  dailyWageRate: number; hourlyOvertimeRate: number; isActive: boolean;
}
export interface AttendanceApiRecord {
  id: string; workerId: string; projectId: string; date: string;
  status: 'PRESENT' | 'HALF_DAY' | 'OVERTIME' | 'ABSENT'; notes?: string | null;
  calculatedCost: number;
}
export interface MilestoneApiRecord {
  id: string; projectId: string; name: string; description?: string | null;
  plannedStartDate: string; plannedEndDate: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED_FOR_APPROVAL' | 'APPROVED' | 'REJECTED';
  progressPercentage: number; weightagePercentage: number;
}

export const fetchInventory = async () => {
  const [materials, movements] = await Promise.all([
    request<{ materials: MaterialApiRecord[] }>('/inventory/materials'),
    request<{ movements: MovementApiRecord[] }>('/inventory/movements'),
  ]);
  return { materials: materials.materials, movements: movements.movements };
};
export const createMaterial = (payload: Record<string, unknown>) =>
  request<{ material: MaterialApiRecord }>('/inventory/materials', { method: 'POST', body: JSON.stringify(payload) });
export const updateMaterial = (id: string, payload: Record<string, unknown>) =>
  request<{ material: MaterialApiRecord }>(`/inventory/materials/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteMaterial = (id: string) => request<void>(`/inventory/materials/${id}`, { method: 'DELETE' });
export const createMovement = (payload: Record<string, unknown>) =>
  request<{ movement: MovementApiRecord }>('/inventory/movements', { method: 'POST', body: JSON.stringify(payload) });

export const fetchWorkforce = async () => {
  const [workers, attendance] = await Promise.all([
    request<{ workers: WorkerApiRecord[] }>('/workforce/workers'),
    request<{ attendance: AttendanceApiRecord[] }>('/workforce/attendance'),
  ]);
  return { workers: workers.workers, attendance: attendance.attendance };
};
export const createWorker = (payload: Record<string, unknown>) =>
  request<{ worker: WorkerApiRecord }>('/workforce/workers', { method: 'POST', body: JSON.stringify(payload) });
export const updateWorker = (id: string, payload: Record<string, unknown>) =>
  request<{ worker: WorkerApiRecord }>(`/workforce/workers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteWorker = (id: string) => request<void>(`/workforce/workers/${id}`, { method: 'DELETE' });
export const createAttendance = (payload: Record<string, unknown>) =>
  request<{ attendance: AttendanceApiRecord }>('/workforce/attendance', { method: 'POST', body: JSON.stringify(payload) });
export const updateAttendance = (id: string, payload: Record<string, unknown>) =>
  request<{ attendance: AttendanceApiRecord }>(`/workforce/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const fetchMilestones = () => request<{ milestones: MilestoneApiRecord[] }>('/milestones');
export const createMilestone = (payload: Record<string, unknown>) =>
  request<{ milestone: MilestoneApiRecord }>('/milestones', { method: 'POST', body: JSON.stringify(payload) });
export const updateMilestone = (id: string, payload: Record<string, unknown>) =>
  request<{ milestone: MilestoneApiRecord }>(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteMilestone = (id: string) => request<void>(`/milestones/${id}`, { method: 'DELETE' });
