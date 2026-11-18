import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  QrCode,
  Eye,
  FileText,
  IndianRupee,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { formatFullINR, formatINR, projectStorage } from '../../services/storage';
import { createInvoice, updateInvoice, deleteInvoice as deleteInvoiceApi, fetchInvoices, createInvoicePayment, fetchPaymentConfig, fetchPaymentVerifications, submitPaymentVerification } from '../../services/invoicesApi';
import { Project } from '../../types';
import { fetchProjects } from '../../services/projectsApi';

type InvoiceBaseStatus = 'Draft' | 'Sent';
type InvoiceStatus = InvoiceBaseStatus | 'Partially Paid' | 'Paid' | 'Overdue';
type PaymentMethod = 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Other';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  clientName: string;
  clientEmail: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: LineItem[];
  taxRate: number;
  paymentTerms: string;
  notes: string;
  baseStatus: InvoiceBaseStatus;
  payments: Payment[];
  createdAt: string;
}

interface InvoiceFormData {
  projectId: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: LineItem[];
  taxRate: string;
  paymentTerms: string;
  notes: string;
  baseStatus: InvoiceBaseStatus;
}

interface PaymentFormData {
  date: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
}

interface PaymentVerification {
  id: string;
  amount: number;
  transactionReference: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
}

const payments: PaymentMethod[] = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Other'];

const today = () => new Date().toISOString().split('T')[0];
const addDays = (date: string, days: number) => { const result = new Date(`${date}T00:00:00`); result.setDate(result.getDate() + days); return result.toISOString().split('T')[0]; };
const emptyLineItem = (): LineItem => ({ id: `line-${Date.now()}-${Math.random()}`, description: '', quantity: 1, unitPrice: 0 });
const emptyPaymentForm = (): PaymentFormData => ({ date: today(), amount: '', method: 'UPI', reference: '' });
const emptyInvoiceForm = (projectId = ''): InvoiceFormData => ({ projectId, invoiceDate: today(), dueDate: addDays(today(), 30), lineItems: [emptyLineItem()], taxRate:'18', paymentTerms:'Payment due within 30 days of invoice date.', notes:'', baseStatus:'Draft' });

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

const lineTotal = (item: LineItem) => item.quantity * item.unitPrice;
const totalsFor = (invoice: Pick<Invoice, 'lineItems' | 'taxRate'>) => {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const taxAmount = subtotal * (invoice.taxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const paidAmount = (invoice: Invoice) => invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
const invoiceStatus = (invoice: Invoice): InvoiceStatus => {
  const total = totalsFor(invoice).total;
  const received = paidAmount(invoice);
  if (received >= total && total > 0) return 'Paid';
  if (invoice.dueDate < today()) return 'Overdue';
  if (received > 0) return 'Partially Paid';
  if (invoice.baseStatus === 'Draft') return 'Draft';
  return 'Sent';
};

const statusClass = (status: InvoiceStatus) => {
  if (status === 'Paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Partially Paid') return 'bg-blue-100 text-blue-700';
  if (status === 'Overdue') return 'bg-rose-100 text-rose-700';
  if (status === 'Sent') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

export const InvoicesPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [formData, setFormData] = useState<InvoiceFormData>(emptyInvoiceForm());
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(emptyPaymentForm());
  const [paymentVerifications, setPaymentVerifications] = useState<PaymentVerification[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [upiPaymentLink, setUpiPaymentLink] = useState('');
  const [scanPayOpen, setScanPayOpen] = useState(false);
  const [verificationReference, setVerificationReference] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formError, setFormError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [invoiceFrom, setInvoiceFrom] = useState('');
  const [invoiceTo, setInvoiceTo] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    let active = true;
    const load = async () => { try { const currentProjects = await fetchProjects() as Project[]; setProjects(currentProjects); setFormData(emptyInvoiceForm(currentProjects[0]?.id || '')); const records = await fetchInvoices(); if (!active) return; setInvoices(records.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber, projectId: i.projectId, clientName: i.client?.name || '', clientEmail: i.client?.email || '', invoiceDate: (i.issueDate || '').slice(0, 10), dueDate: (i.dueDate || '').slice(0, 10), lineItems: (i.items || []).map((x: any) => ({ id: x.id, description: x.description, quantity: Number(x.quantity), unitPrice: Number(x.unitPrice) })), taxRate: Number(i.taxRate), paymentTerms: i.termsAndConditions || '', notes: i.notes || '', baseStatus: String(i.status || 'DRAFT') === 'SENT' ? 'Sent' : 'Draft', payments: (i.payments || []).map((p: any) => ({ id: p.id, date: (p.paymentDate || '').slice(0, 10), amount: Number(p.amount), method: String(p.paymentMethod).replace('_', ' ') as PaymentMethod, reference: p.transactionReference || '' })), createdAt: i.createdAt }))); } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to load invoices.'); } };
    load(); return () => { active = false; };
  }, []);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const summary = useMemo(() => invoices.reduce((result, invoice) => {
    const total = totalsFor(invoice).total;
    const received = paidAmount(invoice);
    result.invoiced += total;
    result.received += received;
    result.pending += Math.max(0, total - received);
    if (invoiceStatus(invoice) === 'Overdue') result.overdue += Math.max(0, total - received);
    return result;
  }, { invoiced: 0, received: 0, pending: 0, overdue: 0 }), [invoices]);

  const filteredInvoices = useMemo(() => {
    const result = invoices.filter((invoice) => {
      const project = projectById.get(invoice.projectId);
      const status = invoiceStatus(invoice);
      const matchesSearch = [invoice.invoiceNumber, project?.name || '', invoice.clientName]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesSearch &&
        (statusFilter === 'ALL' || status === statusFilter) &&
        (projectFilter === 'ALL' || invoice.projectId === projectFilter) &&
        (!invoiceFrom || invoice.invoiceDate >= invoiceFrom) &&
        (!invoiceTo || invoice.invoiceDate <= invoiceTo) &&
        (!dueFrom || invoice.dueDate >= dueFrom) &&
        (!dueTo || invoice.dueDate <= dueTo);
    });
    return result.sort((a, b) => {
      if (sortBy === 'amount-desc') return totalsFor(b).total - totalsFor(a).total;
      if (sortBy === 'amount-asc') return totalsFor(a).total - totalsFor(b).total;
      if (sortBy === 'due-asc') return a.dueDate.localeCompare(b.dueDate);
      if (sortBy === 'due-desc') return b.dueDate.localeCompare(a.dueDate);
      if (sortBy === 'date-asc') return a.invoiceDate.localeCompare(b.invoiceDate);
      return b.invoiceDate.localeCompare(a.invoiceDate);
    });
  }, [invoices, projectById, searchQuery, statusFilter, projectFilter, invoiceFrom, invoiceTo, dueFrom, dueTo, sortBy]);

  const updateForm = (name: keyof InvoiceFormData, value: string) => { setFormData((current) => ({ ...current, [name]: value })); setFormError(''); setMessage(''); };
  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => { setFormData((current) => ({ ...current, lineItems: current.lineItems.map((item) => item.id === id ? { ...item, [field]: field === 'description' ? value : Number(value) } : item) })); setFormError(''); };
  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); const taxRate = Number(formData.taxRate); if (!formData.projectId || !formData.invoiceDate || !formData.dueDate || formData.dueDate < formData.invoiceDate || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || formData.lineItems.length === 0 || formData.lineItems.some((i) => !i.description.trim() || i.quantity <= 0 || i.unitPrice < 0)) { setFormError('Please enter valid project dates, tax, and line items.'); return; } const project: any = projectById.get(formData.projectId); if (!project) { setFormError('Select a valid project.'); return; } const existing = invoices.find((i) => i.id === editingId); const number = existing?.invoiceNumber || `MORYA-INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`; const payload = { invoiceNumber: number, projectId: project.id, issueDate: formData.invoiceDate, dueDate: formData.dueDate, status: formData.baseStatus.toUpperCase(), taxRate, discountAmount: 0, notes: formData.notes.trim(), termsAndConditions: formData.paymentTerms.trim(), items: formData.lineItems.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) }; try { const saved = editingId ? await updateInvoice(editingId, payload) : await createInvoice(payload); const next: Invoice = { ...(existing || {} as Invoice), id: saved.id, invoiceNumber: saved.invoiceNumber, projectId: project.id, clientName: project.clientName, clientEmail: project.clientEmail, invoiceDate: formData.invoiceDate, dueDate: formData.dueDate, lineItems: formData.lineItems, taxRate, paymentTerms: formData.paymentTerms, notes: formData.notes, baseStatus: formData.baseStatus, payments: existing?.payments || [], createdAt: saved.createdAt || new Date().toISOString() }; setInvoices((current) => editingId ? current.map((i) => i.id === editingId ? next : i) : [next, ...current]); setFormData(emptyInvoiceForm(project.id)); setEditingId(null); setMessage(`${number} ${editingId ? 'updated' : 'created'} successfully.`); } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to save invoice.'); } };
  const startEditing = (invoice: Invoice) => { setEditingId(invoice.id); setFormData({ projectId: invoice.projectId, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, lineItems: invoice.lineItems.map((item) => ({ ...item })), taxRate: String(invoice.taxRate), paymentTerms: invoice.paymentTerms, notes: invoice.notes, baseStatus: invoice.baseStatus }); setFormError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteInvoice = async (invoice: Invoice) => { if (!window.confirm(`Delete ${invoice.invoiceNumber}? This also removes its recorded payment history.`)) return; try { await deleteInvoiceApi(invoice.id); setInvoices((current) => current.filter((i) => i.id !== invoice.id)); setSelectedInvoice(null); setMessage(`${invoice.invoiceNumber} deleted.`); } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to delete invoice.'); } };
  const openDetails = (invoice: Invoice) => { setSelectedInvoice(invoice); setPaymentForm(emptyPaymentForm()); setPaymentError(''); setMessage(''); };
  const openScanPay = async () => {
    if (!selectedInvoice) return;
    setScanPayOpen(true); setVerificationError(''); setVerificationReference('');
    const verifications = await fetchPaymentVerifications(selectedInvoice.id);
    setPaymentVerifications(verifications);
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setQrDataUrl(''); setUpiPaymentLink(''); setVerificationError('Enter the payment amount in Record payment before opening Scan & Pay.'); return; }
    const { payeeName, upiId } = await fetchPaymentConfig();
    if (!upiId) { setQrDataUrl(''); setUpiPaymentLink(''); return; }
    const projectName = projectById.get(selectedInvoice.projectId)?.name || 'Construction project';
    const paymentLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${selectedInvoice.invoiceNumber} - ${projectName}`)}`;
    setUpiPaymentLink(paymentLink);
    setQrDataUrl(await QRCode.toDataURL(paymentLink));
  };
  const submitVerification = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedInvoice) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setVerificationError('Enter the payment amount in Record payment before submitting a reference.'); return; }
    if (!verificationReference.trim()) { setVerificationError('Enter the transaction reference for manual verification.'); return; }
    try { const verification = await submitPaymentVerification(selectedInvoice.id, { amount, transactionReference: verificationReference.trim() }); setPaymentVerifications((current) => [{ ...verification, createdAt: verification.createdAt || new Date().toISOString() }, ...current]); setVerificationReference(''); setMessage('Payment reference submitted. Verification is pending.'); } catch (error) { setVerificationError(error instanceof Error ? error.message : 'Unable to submit payment verification.'); }
  };
  const recordPayment = async (event: React.FormEvent) => { event.preventDefault(); if (!selectedInvoice) return; const amount = Number(paymentForm.amount); const balance = Math.max(0, totalsFor(selectedInvoice).total - paidAmount(selectedInvoice)); if (!paymentForm.date || !Number.isFinite(amount) || amount <= 0 || amount > balance + 0.001) { setPaymentError(`Enter a valid payment amount up to ${formatFullINR(balance)}.`); return; } try { const payment = await createInvoicePayment(selectedInvoice.id, { amount, paymentDate: paymentForm.date, paymentMethod: paymentForm.method.toUpperCase().replace(' ', '_'), transactionReference: paymentForm.reference.trim() }); const updated = { ...selectedInvoice, payments: [...selectedInvoice.payments, { id: payment.id, date: paymentForm.date, amount, method: paymentForm.method, reference: paymentForm.reference.trim() }] }; setInvoices((current) => current.map((i) => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); setPaymentForm(emptyPaymentForm()); setMessage(`Payment recorded for ${updated.invoiceNumber}.`); } catch (error) { setPaymentError(error instanceof Error ? error.message : 'Unable to record payment.'); } };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setProjectFilter('ALL');
    setInvoiceFrom('');
    setInvoiceTo('');
    setDueFrom('');
    setDueTo('');
    setSortBy('date-desc');
  };

  const summaryCards = [
    { label: 'Total invoiced', value: formatINR(summary.invoiced), icon: Receipt, color: 'text-blue-600 bg-blue-50' },
    { label: 'Amount received', value: formatINR(summary.received), icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pending payments', value: formatINR(summary.pending), icon: WalletCards, color: 'text-brand-600 bg-amber-50' },
    { label: 'Overdue payments', value: formatINR(summary.overdue), icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
    { label: 'Number of invoices', value: String(invoices.length), icon: FileText, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider"><Receipt className="w-3.5 h-3.5" /> Receivables control</div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Invoices & Payments</h2><p className="text-xs text-slate-500 mt-0.5">Create project invoices, record received payments, and monitor outstanding balances.</p></div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Local data mode</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">{summaryCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div></div><p className="text-xl font-extrabold text-slate-900 mt-2.5 truncate">{value}</p></div>)}</div>

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-xs font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {message}</div>}

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit invoice' : 'Create invoice'}</h3><p className="text-xs text-slate-500 mt-1">Client details are pulled from the selected project record.</p></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setFormData(emptyInvoiceForm(projects[0]?.id || '')); }} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>}</div>
        <form className="space-y-5 mt-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><label className="text-xs font-bold text-slate-600 lg:col-span-2">Project<select className="mt-1" value={formData.projectId} onChange={(event) => updateForm('projectId', event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="text-xs text-slate-600"><span className="font-bold block">Client</span><div className="mt-1 min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><strong className="block text-slate-800">{projectById.get(formData.projectId)?.clientName || 'Select a project'}</strong><span className="text-[11px] text-slate-500">{projectById.get(formData.projectId)?.clientEmail || 'Client contact will appear here'}</span></div></div><label className="text-xs font-bold text-slate-600">Invoice status<select className="mt-1" value={formData.baseStatus} onChange={(event) => updateForm('baseStatus', event.target.value)}><option>Draft</option><option>Sent</option></select></label><label className="text-xs font-bold text-slate-600">Invoice date<input className="mt-1" type="date" value={formData.invoiceDate} onChange={(event) => updateForm('invoiceDate', event.target.value)} /></label><label className="text-xs font-bold text-slate-600">Due date<input className="mt-1" type="date" value={formData.dueDate} onChange={(event) => updateForm('dueDate', event.target.value)} /></label><label className="text-xs font-bold text-slate-600">Tax rate (%)<input className="mt-1" type="number" min="0" max="100" step="0.01" value={formData.taxRate} onChange={(event) => updateForm('taxRate', event.target.value)} /></label></div>
          <div><div className="flex items-center justify-between mb-2"><h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Line items</h4><button type="button" onClick={() => setFormData((current) => ({ ...current, lineItems: [...current.lineItems, emptyLineItem()] }))} className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add line item</button></div><div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full min-w-[700px] text-left"><thead className="bg-slate-50"><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-3 py-2">Description</th><th className="px-3 py-2 w-28">Quantity</th><th className="px-3 py-2 w-36">Unit price (₹)</th><th className="px-3 py-2 w-36">Line total</th><th className="px-3 py-2 w-12"></th></tr></thead><tbody>{formData.lineItems.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2"><input value={item.description} onChange={(event) => updateLineItem(item.id, 'description', event.target.value)} placeholder="Work or service description" /></td><td className="px-3 py-2"><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateLineItem(item.id, 'quantity', event.target.value)} /></td><td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateLineItem(item.id, 'unitPrice', event.target.value)} /></td><td className="px-3 py-2 text-xs font-semibold text-slate-800">{formatFullINR(lineTotal(item))}</td><td className="px-3 py-2"><button type="button" disabled={formData.lineItems.length === 1} onClick={() => setFormData((current) => ({ ...current, lineItems: current.lineItems.filter((line) => line.id !== item.id) }))} className="text-rose-600 disabled:text-slate-300" title="Remove line item"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="space-y-4"><label className="text-xs font-bold text-slate-600 block">Payment terms<textarea className="mt-1 min-h-20" value={formData.paymentTerms} onChange={(event) => updateForm('paymentTerms', event.target.value)} placeholder="Payment terms" /></label><label className="text-xs font-bold text-slate-600 block">Notes<textarea className="mt-1 min-h-20" value={formData.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Optional invoice notes" /></label></div><div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{formatFullINR(totalsFor({ lineItems: formData.lineItems, taxRate: Number(formData.taxRate) || 0 }).subtotal)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Tax ({Number(formData.taxRate) || 0}%)</span><strong>{formatFullINR(totalsFor({ lineItems: formData.lineItems, taxRate: Number(formData.taxRate) || 0 }).taxAmount)}</strong></div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm"><span className="font-bold text-slate-700">Final amount</span><strong className="text-brand-700">{formatFullINR(totalsFor({ lineItems: formData.lineItems, taxRate: Number(formData.taxRate) || 0 }).total)}</strong></div></div></div>
          <div className="flex items-center gap-3"><button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingId ? 'Update invoice' : 'Create invoice'}</button>{formError && <p className="text-xs font-semibold text-rose-600" role="alert">{formError}</p>}</div>
        </form>
      </section>

      <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm"><div className="flex flex-col gap-4 mb-5"><div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"><div><h3 className="text-sm font-bold text-slate-900">Invoice register</h3><p className="text-xs text-slate-500 mt-1">{filteredInvoices.length} of {invoices.length} invoices shown.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={clearFilters} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear filters</button><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} title="Sort invoices"><option value="date-desc">Newest invoice date</option><option value="date-asc">Oldest invoice date</option><option value="amount-desc">Highest amount</option><option value="amount-asc">Lowest amount</option><option value="due-asc">Nearest due date</option><option value="due-desc">Latest due date</option></select></div></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"><div className="relative lg:col-span-2"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input className="!pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search invoice, project, or client..." /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option>Draft</option><option>Sent</option><option>Partially Paid</option><option>Paid</option><option>Overdue</option></select><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="ALL">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><label className="text-[11px] font-bold text-slate-500">Invoice from<input className="mt-1" type="date" value={invoiceFrom} onChange={(event) => setInvoiceFrom(event.target.value)} /></label><label className="text-[11px] font-bold text-slate-500">Invoice to<input className="mt-1" type="date" value={invoiceTo} onChange={(event) => setInvoiceTo(event.target.value)} /></label><label className="text-[11px] font-bold text-slate-500">Due from<input className="mt-1" type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} /></label><label className="text-[11px] font-bold text-slate-500">Due to<input className="mt-1" type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} /></label></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Project / client</th><th className="px-3 py-3">Invoice date</th><th className="px-3 py-3">Due date</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filteredInvoices.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-slate-500">No invoices match the current filters.</td></tr> : filteredInvoices.map((invoice) => { const totals = totalsFor(invoice); const balance = Math.max(0, totals.total - paidAmount(invoice)); const status = invoiceStatus(invoice); return <tr key={invoice.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{invoice.invoiceNumber}</strong><small className="text-[11px] text-slate-500">{invoice.lineItems.length} line item{invoice.lineItems.length === 1 ? '' : 's'}</small></td><td className="px-3 py-4"><strong className="block text-xs text-slate-800">{projectNames.get(invoice.projectId) || 'Unassigned'}</strong><small className="text-[11px] text-slate-500">{invoice.clientName} · {invoice.clientEmail || 'No email'}</small></td><td className="px-3 py-4 text-xs text-slate-600">{formatDate(invoice.invoiceDate)}</td><td className={`px-3 py-4 text-xs ${status === 'Overdue' ? 'font-bold text-rose-600' : 'text-slate-600'}`}>{formatDate(invoice.dueDate)}</td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{formatFullINR(totals.total)}</td><td className="px-3 py-4 text-xs font-semibold text-slate-800">{formatFullINR(balance)}</td><td className="px-3 py-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${statusClass(status)}`}>{status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : status === 'Overdue' ? <AlertTriangle className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}{status}</span></td><td className="px-3 py-4"><div className="flex items-center gap-3"><button type="button" onClick={() => openDetails(invoice)} className="text-xs font-semibold text-slate-600 hover:text-slate-900" title="View invoice"><Eye className="w-3.5 h-3.5 inline mr-1" />View</button><button type="button" onClick={() => startEditing(invoice)} className="text-xs font-semibold text-blue-600 hover:text-blue-800" title="Edit invoice"><Pencil className="w-3.5 h-3.5 inline mr-1" />Edit</button><button type="button" onClick={() => deleteInvoice(invoice)} className="text-xs font-semibold text-rose-600 hover:text-rose-800" title="Delete invoice"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button></div></td></tr>; })}</tbody></table></div></section>

      {selectedInvoice && <div className="fixed inset-0 z-40 bg-slate-950/30 p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"><div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusClass(invoiceStatus(selectedInvoice))}`}>{invoiceStatus(selectedInvoice)}</span><span className="text-[11px] text-slate-500">{selectedInvoice.invoiceNumber}</span></div><h3 className="text-lg font-bold text-slate-900 mt-2">Invoice details</h3><p className="text-xs text-slate-500 mt-1">{projectNames.get(selectedInvoice.projectId) || 'Unassigned'} · {selectedInvoice.clientName} · {selectedInvoice.clientEmail || 'No email'}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => window.print()} className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Print invoice"><Printer className="w-4 h-4" /></button><button type="button" onClick={() => setSelectedInvoice(null)} className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Close invoice details"><X className="w-4 h-4" /></button></div></div><div className="p-5 space-y-6"><div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><div><span className="text-[11px] text-slate-500 block">Invoice date</span><strong className="text-xs text-slate-800">{formatDate(selectedInvoice.invoiceDate)}</strong></div><div><span className="text-[11px] text-slate-500 block">Due date</span><strong className={`text-xs ${invoiceStatus(selectedInvoice) === 'Overdue' ? 'text-rose-600' : 'text-slate-800'}`}>{formatDate(selectedInvoice.dueDate)}</strong></div><div><span className="text-[11px] text-slate-500 block">Total amount</span><strong className="text-xs text-slate-800">{formatFullINR(totalsFor(selectedInvoice).total)}</strong></div><div><span className="text-[11px] text-slate-500 block">Balance due</span><strong className="text-xs text-brand-700">{formatFullINR(Math.max(0, totalsFor(selectedInvoice).total - paidAmount(selectedInvoice)))}</strong></div></div><div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full min-w-[650px] text-left"><thead className="bg-slate-50"><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-3 py-2">Description</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Unit price</th><th className="px-3 py-2">Total</th></tr></thead><tbody>{selectedInvoice.lineItems.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-3 text-xs text-slate-700">{item.description}</td><td className="px-3 py-3 text-xs text-slate-700">{item.quantity}</td><td className="px-3 py-3 text-xs text-slate-700">{formatFullINR(item.unitPrice)}</td><td className="px-3 py-3 text-xs font-semibold text-slate-800">{formatFullINR(lineTotal(item))}</td></tr>)}</tbody></table></div><div className="flex justify-end"><div className="w-full sm:w-72 bg-slate-50 rounded-lg p-4 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{formatFullINR(totalsFor(selectedInvoice).subtotal)}</strong></div><div className="flex justify-between"><span className="text-slate-500">Tax ({selectedInvoice.taxRate}%)</span><strong>{formatFullINR(totalsFor(selectedInvoice).taxAmount)}</strong></div><div className="flex justify-between border-t border-slate-200 pt-2 text-sm"><span className="font-bold text-slate-700">Final amount</span><strong className="text-brand-700">{formatFullINR(totalsFor(selectedInvoice).total)}</strong></div></div></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div><div className="flex items-center justify-between mb-3"><h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Payment history</h4><span className="text-[11px] text-slate-500">{selectedInvoice.payments.length} payment{selectedInvoice.payments.length === 1 ? '' : 's'}</span></div>{selectedInvoice.payments.length === 0 ? <p className="text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-4">No payments recorded yet.</p> : <div className="space-y-2">{selectedInvoice.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2.5"><div><strong className="text-xs text-slate-800 block">{formatDate(payment.date)} · {payment.method}</strong><span className="text-[11px] text-slate-500">{payment.reference || 'No transaction reference'}</span></div><strong className="text-xs text-emerald-700">{formatFullINR(payment.amount)}</strong></div>)}</div>}</div><div className="bg-slate-50 border border-slate-200 rounded-lg p-4"><div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-slate-600" /><h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Record payment</h4><button type="button" onClick={openScanPay} className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-brand-700 hover:bg-white"><QrCode className="w-3.5 h-3.5" /> Scan & Pay</button></div>{Math.max(0, totalsFor(selectedInvoice).total - paidAmount(selectedInvoice)) > 0 ? <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={recordPayment}><label className="text-xs font-bold text-slate-600">Amount<input className="mt-1" type="number" min="0.01" max={Math.max(0, totalsFor(selectedInvoice).total - paidAmount(selectedInvoice))} step="0.01" value={paymentForm.amount} onChange={(event) => { setPaymentForm((current) => ({ ...current, amount: event.target.value })); setPaymentError(''); }} placeholder="0.00" /></label><label className="text-xs font-bold text-slate-600">Payment date<input className="mt-1" type="date" value={paymentForm.date} onChange={(event) => { setPaymentForm((current) => ({ ...current, date: event.target.value })); setPaymentError(''); }} /></label><label className="text-xs font-bold text-slate-600">Method<select className="mt-1" value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as PaymentMethod }))}>{payments.map((method) => <option key={method}>{method}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Transaction reference<input className="mt-1" value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Optional" /></label><div className="sm:col-span-2 flex items-center gap-2"><button type="submit" className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">Record payment</button>{paymentError && <p className="text-xs font-semibold text-rose-600" role="alert">{paymentError}</p>}</div></form> : <p className="text-xs font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Invoice fully paid.</p>}</div></div><div className="mt-4 border-t border-slate-200 pt-4">{scanPayOpen && <div className="space-y-3"><div className="flex items-center justify-between"><h5 className="text-xs font-bold text-slate-800">Scan & Pay</h5><button type="button" onClick={() => setScanPayOpen(false)} className="text-xs text-slate-500">Close</button></div>{qrDataUrl ? <><img src={qrDataUrl} alt="UPI payment QR code" className="w-48 h-48 border border-slate-200 rounded-lg bg-white p-2" /><p className="text-[11px] text-slate-600">Morya Enterprises � UPI payment for {projectNames.get(selectedInvoice.projectId) || "Construction project"} � Amount {formatFullINR(Number(paymentForm.amount))}</p><a href={upiPaymentLink} className="inline-flex text-xs font-semibold text-brand-700 hover:text-brand-900" target="_blank" rel="noreferrer">Open in UPI app</a><p className="text-[11px] text-amber-700">After paying in Google Pay, PhonePe, or Paytm, submit the transaction reference below. Payment remains pending until verified.</p><form onSubmit={submitVerification} className="flex gap-2"><input value={verificationReference} onChange={(event) => { setVerificationReference(event.target.value); setVerificationError(""); }} placeholder="Transaction reference" className="flex-1" /><button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">Submit reference</button></form></> : <p className="text-xs font-semibold text-rose-600">UPI payment configuration is required.</p>}{verificationError && <p className="text-xs font-semibold text-rose-600">{verificationError}</p>}{paymentVerifications.length > 0 && <div className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Verification status</span>{paymentVerifications.map((verification) => <p key={verification.id} className="text-xs text-amber-700">{verification.transactionReference}: {verification.status === "PENDING" ? "Pending Verification" : verification.status}</p>)}</div>}</div>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><div><span className="text-[11px] text-slate-500 block">Payment terms</span><p className="text-slate-700 mt-1">{selectedInvoice.paymentTerms || 'Not specified'}</p></div><div><span className="text-[11px] text-slate-500 block">Notes</span><p className="text-slate-700 mt-1">{selectedInvoice.notes || 'No notes'}</p></div></div></div></div></div>}
    </div>
  );
};

export default InvoicesPage;