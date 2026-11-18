import { getStoredAuthSession } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') as string;
const headers = (): HeadersInit => {
  const token = getStoredAuthSession()?.token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) }, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Invoice API request failed.');
  return data;
};
export const fetchInvoices = async () => (await request('/invoices')).invoices;
export const fetchPaymentConfig = async () => (await request('/invoices/payment-config')) as { payeeName: string; upiId: string | null };
export const createInvoice = async (payload: Record<string, unknown>) => (await request('/invoices', { method: 'POST', body: JSON.stringify(payload) })).invoice;
export const updateInvoice = async (id: string, payload: Record<string, unknown>) => (await request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(payload) })).invoice;
export const deleteInvoice = async (id: string) => request(`/invoices/${id}`, { method: 'DELETE' });
export const createInvoicePayment = async (id: string, payload: Record<string, unknown>) => (await request(`/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) })).payment;
export const fetchPaymentVerifications = async (id: string) => (await request(`/invoices/${id}/payment-verifications`)).verifications;
export const submitPaymentVerification = async (id: string, payload: Record<string, unknown>) => (await request(`/invoices/${id}/payment-verifications`, { method: 'POST', body: JSON.stringify(payload) })).verification;
export const reviewPaymentVerification = async (id: string, verificationId: string, status: 'VERIFIED' | 'REJECTED') => (await request(`/invoices/${id}/payment-verifications/${verificationId}`, { method: 'PATCH', body: JSON.stringify({ status }) })).verification;
