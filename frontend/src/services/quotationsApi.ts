import { getStoredAuthSession } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') as string;
const headers = (): HeadersInit => {
  const token = getStoredAuthSession()?.token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) }, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Quotation API request failed.');
  return data;
};
export const fetchQuotations = async () => (await request('/quotations')).quotations;
export const createQuotation = async (payload: Record<string, unknown>) => (await request('/quotations', { method: 'POST', body: JSON.stringify(payload) })).quotation;
export const updateQuotation = async (id: string, payload: Record<string, unknown>) => (await request(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) })).quotation;
export const deleteQuotation = async (id: string) => request(`/quotations/${id}`, { method: 'DELETE' });
export const convertQuotation = async (id: string, payload: Record<string, unknown>) => (await request(`/quotations/${id}/convert`, { method: 'POST', body: JSON.stringify(payload) })).project;
