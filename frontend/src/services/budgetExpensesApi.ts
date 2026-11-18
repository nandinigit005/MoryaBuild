import { getStoredAuthSession } from './auth';

export interface BudgetExpenseApiRecord {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  vendor: string;
  paymentStatus: 'Paid' | 'Pending';
  approvalStatus: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetApiRecord {
  id: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  version: number | null;
  totalBudget: number;
  materialsBudget: number;
  labourBudget: number;
  equipmentBudget: number;
  subcontractorBudget: number;
  transportBudget: number;
  contingencyBudget: number;
  otherBudget: number;
  notes: string | null;
  isFallbackToApprovedBudget: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  pendingPayments: number;
  utilization: number;
}

export interface ProjectBudgetSummary extends BudgetSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
}

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';

export class BudgetExpensesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BudgetExpensesApiError';
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
  if (!response.ok) {
    throw new BudgetExpensesApiError(data?.error || 'Budget and expense request failed.', response.status);
  }

  return data as T;
};

export const fetchBudgetExpenses = async (projectId?: string) => {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const [expenseData, budgetData, summaryData] = await Promise.all([
    request<{ expenses: BudgetExpenseApiRecord[] }>(`/budget-expenses/expenses${query}`),
    request<{ budgets: BudgetApiRecord[] }>(`/budget-expenses/budgets${query}`),
    request<{ summary: BudgetSummary; projects: ProjectBudgetSummary[] }>(`/budget-expenses/summary${query}`),
  ]);

  return {
    expenses: expenseData.expenses,
    budgets: budgetData.budgets,
    summary: summaryData.summary,
    projectSummaries: summaryData.projects,
  };
};

export const createExpenseRecord = (payload: Record<string, unknown>) =>
  request<{ expense: BudgetExpenseApiRecord }>('/budget-expenses/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateExpenseRecord = (id: string, payload: Record<string, unknown>) =>
  request<{ expense: BudgetExpenseApiRecord }>(`/budget-expenses/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteExpenseRecord = (id: string) =>
  request<{ message: string }>(`/budget-expenses/expenses/${id}`, {
    method: 'DELETE',
  });
