import React, { useEffect, useMemo, useState } from 'react';
import {
	CalendarDays,
	CheckCircle2,
	ClipboardList,
	IndianRupee,
	Pencil,
	Plus,
	Receipt,
	Search,
	Trash2,
	WalletCards,
	X,
} from 'lucide-react';
import { formatFullINR } from '../../services/storage';
import { fetchProjects } from '../../services/projectsApi';
import {
	BudgetExpenseApiRecord,
	BudgetExpensesApiError,
	BudgetSummary,
	createExpenseRecord,
	deleteExpenseRecord,
	fetchBudgetExpenses,
	updateExpenseRecord,
} from '../../services/budgetExpensesApi';

type ExpenseCategory = 'Materials' | 'Labour' | 'Equipment' | 'Subcontractor' | 'Other';
type PaymentStatus = 'Paid' | 'Pending';

interface BudgetProject {
	id: string;
	name: string;
	approvedBudget: number;
}

type Expense = Omit<BudgetExpenseApiRecord, 'category' | 'paymentStatus'> & {
	category: ExpenseCategory;
	paymentStatus: PaymentStatus;
};

interface ExpenseFormData {
	title: string;
	category: ExpenseCategory;
	amount: string;
	date: string;
	vendor: string;
	paymentStatus: PaymentStatus;
	projectId: string;
}

const categories: ExpenseCategory[] = ['Materials', 'Labour', 'Equipment', 'Subcontractor', 'Other'];

const getToday = () => new Date().toISOString().split('T')[0];

const emptyForm = (projectId = ''): ExpenseFormData => ({
	title: '',
	category: 'Materials',
	amount: '',
	date: getToday(),
	vendor: '',
	paymentStatus: 'Pending',
	projectId,
});

const formatDate = (date: string) =>
	new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
		new Date(`${date}T00:00:00`)
	);

const categoryToApi: Record<ExpenseCategory, string> = {
	Materials: 'MATERIALS',
	Labour: 'LABOUR',
	Equipment: 'EQUIPMENT',
	Subcontractor: 'SUBCONTRACTOR',
	Other: 'MISCELLANEOUS',
};

const categoryFromApi = (category: string): ExpenseCategory => {
	if (category === 'MATERIALS') return 'Materials';
	if (category === 'LABOUR') return 'Labour';
	if (category === 'EQUIPMENT') return 'Equipment';
	if (category === 'SUBCONTRACTOR') return 'Subcontractor';
	return 'Other';
};

const mapExpense = (expense: BudgetExpenseApiRecord): Expense => ({
	...expense,
	category: categoryFromApi(expense.category),
	paymentStatus: expense.paymentStatus,
});

export const BudgetExpenses: React.FC = () => {
	const [projects, setProjects] = useState<BudgetProject[]>([]);
	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [summary, setSummary] = useState<BudgetSummary>({ totalBudget: 0, totalExpenses: 0, remainingBudget: 0, pendingPayments: 0, utilization: 0 });
	const [formData, setFormData] = useState<ExpenseFormData>(emptyForm());
	const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
	const [formError, setFormError] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [categoryFilter, setCategoryFilter] = useState('ALL');
	const [statusFilter, setStatusFilter] = useState('ALL');
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState('');

	const loadData = async () => {
		setLoading(true);
		setLoadError('');
		try {
			const [projectRecords, financialData] = await Promise.all([fetchProjects(), fetchBudgetExpenses()]);
			const currentProjects = projectRecords.map((project) => ({
				id: project.id,
				name: project.name,
				approvedBudget: project.approvedBudget,
			}));
			setProjects(currentProjects);
			setExpenses(financialData.expenses.map(mapExpense));
			setSummary(financialData.summary);
			setFormData((current) => ({ ...current, projectId: current.projectId || currentProjects[0]?.id || '' }));
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : 'Unable to load budget and expense data.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, []);

	const projectNames = useMemo(
		() => new Map(projects.map((project) => [project.id, project.name])),
		[projects]
	);
	const totalBudget = summary.totalBudget;
	const totalExpenses = summary.totalExpenses;
	const remainingBudget = summary.remainingBudget;
	const pendingPayments = summary.pendingPayments;
	const utilization = summary.utilization;

	const filteredExpenses = expenses.filter((expense) => {
		const projectName = projectNames.get(expense.projectId) || '';
		const matchesSearch = [expense.title, expense.vendor, projectName]
			.join(' ')
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		return (
			matchesSearch &&
			(categoryFilter === 'ALL' || expense.category === categoryFilter) &&
			(statusFilter === 'ALL' || expense.paymentStatus === statusFilter)
		);
	});

	const updateForm = (name: keyof ExpenseFormData, value: string) => {
		setFormData((current) => ({ ...current, [name]: value }));
		setFormError('');
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const amount = Number(formData.amount);
		if (!formData.title.trim() || !formData.vendor.trim() || !formData.projectId) {
			setFormError('Title, vendor, and project are required.');
			return;
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			setFormError('Enter an amount greater than zero.');
			return;
		}
		try {
			const payload = {
				projectId: formData.projectId,
				title: formData.title.trim(),
				category: categoryToApi[formData.category],
				amount,
				date: formData.date,
				vendor: formData.vendor.trim(),
				paymentStatus: formData.paymentStatus,
				paymentMethod: 'BANK_TRANSFER',
			};
			if (editingExpenseId) {
				await updateExpenseRecord(editingExpenseId, payload);
			} else {
				await createExpenseRecord(payload);
			}
			setFormData(emptyForm(formData.projectId));
			setEditingExpenseId(null);
			setFormError('');
			await loadData();
		} catch (error) {
			setFormError(error instanceof Error ? error.message : 'Unable to save expense.');
		}
	};

	const startEditing = (expense: Expense) => {
		setEditingExpenseId(expense.id);
		setFormData({ ...expense, amount: String(expense.amount) });
		setFormError('');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const deleteExpense = async (expense: Expense) => {
		if (window.confirm(`Delete “${expense.title}”?`)) {
			try {
				await deleteExpenseRecord(expense.id);
				if (editingExpenseId === expense.id) {
					setEditingExpenseId(null);
					setFormData(emptyForm(projects[0]?.id || ''));
				}
				await loadData();
			} catch (error) {
				setFormError(error instanceof Error ? error.message : 'Unable to delete expense.');
			}
		}
	};

	const summaryCards = [
		{ label: 'Total Budget', value: totalBudget, icon: WalletCards, color: 'text-blue-600 bg-blue-50' },
		{ label: 'Total Expenses', value: totalExpenses, icon: Receipt, color: 'text-brand-600 bg-amber-50' },
		{ label: 'Remaining Budget', value: remainingBudget, icon: ClipboardList, color: 'text-emerald-600 bg-emerald-50' },
		{ label: 'Pending Payments', value: pendingPayments, icon: CalendarDays, color: 'text-rose-600 bg-rose-50' },
	];

	if (loading) {
		return <div className="be-card p-10 text-center text-xs text-slate-500">Loading budget and expense data...</div>;
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 text-[11px] font-bold text-brand-600 uppercase tracking-wider">
						<IndianRupee className="w-3.5 h-3.5" /> Financial control
					</div>
					<h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Budget & Expenses</h2>
					<p className="text-xs text-slate-500 mt-0.5">Track site costs, vendors, and payment commitments across active projects.</p>
				</div>
				<span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
					<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live MySQL data
				</span>
			</div>
			{loadError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700" role="alert">{loadError} <button type="button" onClick={() => void loadData()} className="ml-2 underline">Retry</button></div>}

			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
				{summaryCards.map(({ label, value, icon: Icon, color }) => (
					<div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
							<div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
						</div>
						<p className="text-xl font-extrabold text-slate-900 mt-2.5 truncate" title={formatFullINR(value)}>{formatFullINR(value)}</p>
					</div>
				))}
			</div>

			<section className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
				<div className="flex items-center justify-between gap-4 mb-3">
					<div>
						<h3 className="text-sm font-bold text-slate-900">Budget utilization</h3>
						<p className="text-xs text-slate-500 mt-1">Recorded expenses against approved project budgets</p>
					</div>
					<strong className={`text-sm ${utilization > 100 ? 'text-rose-600' : 'text-brand-600'}`}>{utilization}%</strong>
				</div>
				<div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
					<div className={`h-full rounded-full transition-all ${utilization > 100 ? 'bg-rose-600' : 'bg-brand-600'}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
				</div>
				<div className="flex justify-between text-[11px] text-slate-500 mt-2"><span>{formatFullINR(totalExpenses)} spent</span><span>{formatFullINR(totalBudget)} approved</span></div>
			</section>

			<section className="be-card">
				<div className="be-section-heading">
					<div><h2>{editingExpenseId ? 'Edit expense' : 'Record an expense'}</h2><p className="be-muted">Add a project cost with its vendor and payment status.</p></div>
					{editingExpenseId && <button type="button" onClick={() => { setEditingExpenseId(null); setFormData(emptyForm(projects[0]?.id || '')); }} className="be-secondary-button flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Cancel edit</button>}
				</div>
				<form className="be-form" onSubmit={handleSubmit}>
					<label>Expense title<input value={formData.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="e.g. Cement delivery" /></label>
					<label>Category<select value={formData.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
					<label>Amount (₹)<input type="number" min="1" step="0.01" value={formData.amount} onChange={(event) => updateForm('amount', event.target.value)} placeholder="0.00" /></label>
					<label>Date<input type="date" value={formData.date} onChange={(event) => updateForm('date', event.target.value)} /></label>
					<label>Vendor<input value={formData.vendor} onChange={(event) => updateForm('vendor', event.target.value)} placeholder="Vendor or supplier name" /></label>
					<label>Payment status<select value={formData.paymentStatus} onChange={(event) => updateForm('paymentStatus', event.target.value)}><option>Pending</option><option>Paid</option></select></label>
					<label>Project<select value={formData.projectId} onChange={(event) => updateForm('projectId', event.target.value)}><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
					<div className="be-form-actions"><button type="submit" className="be-primary-button flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingExpenseId ? 'Update expense' : 'Add expense'}</button></div>
				</form>
				{formError && <p className="text-xs font-semibold text-rose-600 mt-3" role="alert">{formError}</p>}
			</section>

			<section className="be-card">
				<div className="be-list-heading"><div><h2>Expense register</h2><p className="be-muted">{filteredExpenses.length} of {expenses.length} recorded expenses</p></div><div className="be-filters"><div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input className="!pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search expenses..." /></div><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option>Paid</option><option>Pending</option></select></div></div>
				<div className="be-table-wrap"><table className="be-table"><thead><tr><th>Expense</th><th>Category</th><th>Project</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredExpenses.length === 0 ? <tr><td colSpan={7} className="be-empty">No expenses match the selected filters.</td></tr> : filteredExpenses.map((expense) => <tr key={expense.id}><td><strong>{expense.title}</strong><small>{expense.vendor}</small></td><td>{expense.category}</td><td>{projectNames.get(expense.projectId) || 'Unassigned'}</td><td>{formatDate(expense.date)}</td><td className="be-amount">{formatFullINR(expense.amount)}</td><td><span className={`be-status ${expense.paymentStatus === 'Paid' ? 'be-status-paid' : 'be-status-pending'}`}>{expense.paymentStatus === 'Paid' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}{expense.paymentStatus}</span></td><td><div className="be-actions"><button type="button" onClick={() => startEditing(expense)} title="Edit expense"><Pencil className="w-3.5 h-3.5 inline mr-1" />Edit</button><button type="button" className="be-delete" onClick={() => deleteExpense(expense)} title="Delete expense"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete</button></div></td></tr>)}</tbody></table></div>
			</section>
		</div>
	);
};

export default BudgetExpenses;
