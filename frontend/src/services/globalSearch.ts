import { projectStorage } from './storage';

export type SearchResultType = 'Project' | 'Quotation' | 'Invoice' | 'Material' | 'Workforce' | 'Milestone';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  route: string;
}

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

interface Quotation { id: string; quotationNumber: string; clientName: string; projectId: string; status: string; }
interface Invoice { id: string; invoiceNumber: string; clientName: string; projectId: string; baseStatus?: string; status?: string; }
interface Material { id: string; name: string; category: string; }
interface Worker { id: string; name: string; trade: string; projectId: string; }
interface Milestone { id: string; title: string; projectId: string; }

const projectNames = () => new Map(projectStorage.getAll().map((project) => [project.id, project.name]));
const normalize = (value: string) => value.trim().toLowerCase();
const matches = (query: string, values: string[]) => values.some((value) => normalize(value).includes(query));

export const searchRecords = (rawQuery: string): SearchResult[] => {
  const query = normalize(rawQuery);
  if (!query) return [];
  const names = projectNames();
  const results: SearchResult[] = [];

  projectStorage.getAll().forEach((project) => {
    if (matches(query, [project.name, project.id, project.projectCode, project.location, project.contractorName])) {
      results.push({ id: project.id, type: 'Project', title: project.name, subtitle: `${project.projectCode} · ${project.location}`, route: `/projects/${project.id}` });
    }
  });

  readArray<Quotation>('morya_contractor_quotations_v1').forEach((quotation) => {
    const projectName = names.get(quotation.projectId) || 'Unassigned project';
    if (matches(query, [quotation.quotationNumber, quotation.clientName, quotation.status, projectName])) {
      results.push({ id: quotation.id, type: 'Quotation', title: quotation.quotationNumber, subtitle: `${quotation.clientName} · ${quotation.status}`, route: '/quotations' });
    }
  });

  readArray<Invoice>('morya_contractor_invoices_v1').forEach((invoice) => {
    const projectName = names.get(invoice.projectId) || 'Unassigned project';
    const status = invoice.baseStatus || invoice.status || 'Draft';
    if (matches(query, [invoice.invoiceNumber, invoice.clientName, projectName, status])) {
      results.push({ id: invoice.id, type: 'Invoice', title: invoice.invoiceNumber, subtitle: `${invoice.clientName} · ${status}`, route: '/invoices' });
    }
  });

  readArray<Material>('morya_contractor_materials_v1').forEach((material) => {
    if (matches(query, [material.name, material.category])) results.push({ id: material.id, type: 'Material', title: material.name, subtitle: `${material.category} · Materials & Stock`, route: '/inventory' });
  });

  readArray<Worker>('morya_contractor_workers_v1').forEach((worker) => {
    const projectName = names.get(worker.projectId) || 'Unassigned project';
    if (matches(query, [worker.name, worker.trade, projectName])) results.push({ id: worker.id, type: 'Workforce', title: worker.name, subtitle: `${worker.trade} · ${projectName}`, route: '/workforce' });
  });

  readArray<Milestone>('morya_contractor_milestones_v1').forEach((milestone) => {
    const projectName = names.get(milestone.projectId) || 'Unassigned project';
    if (matches(query, [milestone.title, projectName])) results.push({ id: milestone.id, type: 'Milestone', title: milestone.title, subtitle: `${projectName} · Milestones & Tracking`, route: '/milestones' });
  });

  return results;
};
