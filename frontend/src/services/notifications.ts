import { Project } from '../types';
import { projectStorage } from './storage';

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type NotificationType = 'budget' | 'milestone' | 'material' | 'invoice' | 'ai-risk';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  date?: string;
  targetPath: string;
}

interface ExpenseRecord { projectId: string; amount: number; }
interface MilestoneRecord { id: string; title: string; projectId: string; dueDate: string; status: string; }
interface MaterialRecord { id: string; name: string; category: string; unit: string; quantity: number; minimumStock: number; }
interface InvoiceRecord { invoiceNumber: string; projectId: string; invoiceDate: string; dueDate: string; lineItems?: { quantity: number; unitPrice: number }[]; taxRate?: number; baseStatus?: string; status?: string; payments?: { amount: number }[]; }
interface NotificationState { read: string[]; dismissed: string[]; }

const STATE_KEY = 'morya_contractor_notification_state_v1';
const EXPENSES_KEY = 'morya_contractor_expenses_v1';
const MILESTONES_KEY = 'morya_contractor_milestones_v1';
const MATERIALS_KEY = 'morya_contractor_materials_v1';
const INVOICES_KEY = 'morya_contractor_invoices_v1';

const today = () => new Date().toISOString().split('T')[0];
const daysFromToday = (days: number) => {
  const date = new Date(`${today()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const readArray = <T,>(key: string): T[] => {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const readState = (): NotificationState => {
  try {
    const value = window.localStorage.getItem(STATE_KEY);
    if (!value) return { read: [], dismissed: [] };
    const parsed = JSON.parse(value) as Partial<NotificationState>;
    return { read: Array.isArray(parsed.read) ? parsed.read : [], dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [] };
  } catch {
    return { read: [], dismissed: [] };
  }
};

const writeState = (state: NotificationState) => {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('morya-notifications-updated'));
};

const invoiceTotal = (invoice: InvoiceRecord) => (invoice.lineItems || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) * (1 + Number(invoice.taxRate || 0) / 100);
const invoicePaid = (invoice: InvoiceRecord) => (invoice.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
const formatDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

export const getNotifications = (): AppNotification[] => {
  const projects = projectStorage.getAll();
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const notifications: AppNotification[] = [];
  const add = (notification: AppNotification) => notifications.push(notification);

  projects.forEach((project: Project) => {
    const utilization = project.approvedBudget > 0 ? project.actualExpenses / project.approvedBudget : 0;
    if (utilization >= 1) {
      add({ id: `budget-over:${project.id}`, type: 'budget', severity: 'critical', title: 'Budget exceeded', description: `${project.name} has used ${Math.round(utilization * 100)}% of its approved budget.`, projectId: project.id, projectName: project.name, targetPath: `/projects/${project.id}` });
    } else if (utilization >= 0.8) {
      add({ id: `budget-watch:${project.id}`, type: 'budget', severity: utilization >= 0.9 ? 'high' : 'medium', title: 'Budget utilization alert', description: `${project.name} has used ${Math.round(utilization * 100)}% of its approved budget.`, projectId: project.id, projectName: project.name, targetPath: `/projects/${project.id}` });
    }
    if (project.costRiskTier === 'HIGH' || project.scheduleRiskTier === 'HIGH' || utilization >= 0.9) {
      add({ id: `ai-risk:${project.id}`, type: 'ai-risk', severity: 'high', title: 'High-risk project finding', description: `${project.name} is flagged by the current risk analysis for cost or schedule pressure.`, projectId: project.id, projectName: project.name, targetPath: '/ai-risk' });
    }
  });

  readArray<MilestoneRecord>(MILESTONES_KEY).forEach((milestone) => {
    const projectName = projectNames.get(milestone.projectId);
    if (milestone.status !== 'Completed' && milestone.dueDate < today()) {
      add({ id: `milestone-overdue:${milestone.id}`, type: 'milestone', severity: 'high', title: 'Overdue milestone', description: `${milestone.title} was due on ${formatDate(milestone.dueDate)}.`, projectId: milestone.projectId, projectName, date: milestone.dueDate, targetPath: '/milestones' });
    } else if (milestone.status !== 'Completed' && milestone.dueDate <= daysFromToday(7)) {
      add({ id: `milestone-due:${milestone.id}`, type: 'milestone', severity: 'medium', title: 'Milestone deadline approaching', description: `${milestone.title} is due by ${formatDate(milestone.dueDate)}.`, projectId: milestone.projectId, projectName, date: milestone.dueDate, targetPath: '/milestones' });
    }
  });

  readArray<MaterialRecord>(MATERIALS_KEY).forEach((material) => {
    if (Number(material.quantity) <= Number(material.minimumStock)) {
      add({ id: `material-low:${material.id}`, type: 'material', severity: Number(material.quantity) <= 0 ? 'critical' : 'medium', title: 'Low-stock material', description: `${material.name} has ${material.quantity} ${material.unit} available against a minimum of ${material.minimumStock}.`, targetPath: '/inventory' });
    }
  });

  readArray<InvoiceRecord>(INVOICES_KEY).forEach((invoice) => {
    const balance = invoiceTotal(invoice) - invoicePaid(invoice);
    if (balance > 0 && invoice.dueDate < today() && invoice.baseStatus !== 'Draft') {
      add({ id: `invoice-overdue:${invoice.invoiceNumber}`, type: 'invoice', severity: 'high', title: 'Overdue invoice', description: `${invoice.invoiceNumber} has an outstanding balance of INR ${Math.round(balance).toLocaleString('en-IN')}.`, projectId: invoice.projectId, projectName: projectNames.get(invoice.projectId), date: invoice.dueDate, targetPath: '/invoices' });
    }
  });

  return notifications;
};

export const getNotificationState = () => readState();
export const getActiveNotifications = () => {
  const state = readState();
  return getNotifications().filter((notification) => !state.dismissed.includes(notification.id));
};
export const markNotificationRead = (id: string) => {
  const state = readState();
  if (!state.read.includes(id)) writeState({ ...state, read: [...state.read, id] });
};
export const markAllNotificationsRead = () => {
  const state = readState();
  writeState({ ...state, read: Array.from(new Set([...state.read, ...getActiveNotifications().map((notification) => notification.id)])) });
};
export const dismissNotification = (id: string) => {
  const state = readState();
  writeState({ read: state.read.filter((readId) => readId !== id), dismissed: Array.from(new Set([...state.dismissed, id])) });
};
export const formatNotificationDate = (date?: string) => date ? formatDate(date) : 'Date unavailable';
