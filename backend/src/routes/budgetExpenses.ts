import { ApprovalStatus, ExpenseCategory, PaymentMethod, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const budgetExpensesRouter = Router();
budgetExpensesRouter.use(requireAuth);

const categorySchema = z.enum(['MATERIALS', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'TRANSPORT', 'PERMITS', 'UTILITIES', 'MISCELLANEOUS']);
const paymentStatusSchema = z.enum(['Paid', 'Pending']);
const paymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NEFT_RTGS', 'CREDIT']).default('BANK_TRANSFER');
const projectIdSchema = z.string().uuid('A valid project ID is required.');

const expenseSchema = z.object({
  projectId: projectIdSchema,
  title: z.string().trim().min(1, 'Expense title is required.').max(500),
  category: categorySchema,
  amount: z.coerce.number().finite().positive('Amount must be greater than zero.'),
  date: z.string().min(1, 'Expense date is required.'),
  vendor: z.string().trim().min(1, 'Vendor is required.').max(255),
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema,
});

const projectInclude = {
  projectManager: true,
  client: true,
} as const;

const parseDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Expense date is not valid.');
  }
  return parsed;
};

const canManageProject = (user: NonNullable<Express.Request['user']>, project: { projectManagerId: string | null }) =>
  user.role === Role.ADMIN || (user.role === Role.PROJECT_MANAGER && project.projectManagerId === user.id);

const canReadProject = async (user: NonNullable<Express.Request['user']>, project: { id: string; projectManagerId: string | null; clientId: string }) => {
  if (canManageProject(user, project)) {
    return true;
  }

  if (user.role !== Role.CLIENT) {
    return false;
  }

  const client = await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } });
  return client?.id === project.clientId;
};

const findProjectForUser = async (user: NonNullable<Express.Request['user']>, projectId: string, requireManage = false) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, projectCode: true, name: true, approvedBudget: true, projectManagerId: true, clientId: true },
  });

  if (!project) {
    return { project: null, status: 404 as const, error: 'Project not found.' };
  }

  const allowed = requireManage ? canManageProject(user, project) : await canReadProject(user, project);
  if (!allowed) {
    return { project: null, status: 403 as const, error: 'You do not have permission to access this project.' };
  }

  return { project, status: 200 as const, error: null };
};

const projectWhereForUser = async (user: NonNullable<Express.Request['user']>) => {
  if (user.role === Role.ADMIN) {
    return {};
  }

  if (user.role === Role.PROJECT_MANAGER) {
    return { projectManagerId: user.id };
  }

  const client = await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } });
  return client ? { clientId: client.id } : { id: '__no_access__' };
};

const serializeExpense = (expense: Prisma.ExpenseGetPayload<{ include: { project: true } }>) => ({
  id: expense.id,
  projectId: expense.projectId,
  projectCode: expense.project.projectCode,
  projectName: expense.project.name,
  title: expense.description,
  category: expense.category,
  amount: Number(expense.amount),
  date: expense.expenseDate.toISOString().slice(0, 10),
  vendor: expense.vendorOrSupplier ?? '',
  paymentStatus: expense.approvalStatus === ApprovalStatus.APPROVED ? 'Paid' : 'Pending',
  approvalStatus: expense.approvalStatus,
  paymentMethod: expense.paymentMethod,
  createdAt: expense.createdAt.toISOString(),
  updatedAt: expense.updatedAt.toISOString(),
});

const serializeBudget = (project: Prisma.ProjectGetPayload<{ include: { budgets: true } }>) => {
  const activeBudget = project.budgets.find((budget) => budget.isActive) ?? project.budgets[0];
  return {
    id: activeBudget?.id ?? null,
    projectId: project.id,
    projectCode: project.projectCode,
    projectName: project.name,
    version: activeBudget?.version ?? null,
    totalBudget: Number(activeBudget?.totalBudget ?? project.approvedBudget),
    materialsBudget: Number(activeBudget?.materialsBudget ?? 0),
    labourBudget: Number(activeBudget?.labourBudget ?? 0),
    equipmentBudget: Number(activeBudget?.equipmentBudget ?? 0),
    subcontractorBudget: Number(activeBudget?.subcontractorBudget ?? 0),
    transportBudget: Number(activeBudget?.transportBudget ?? 0),
    contingencyBudget: Number(activeBudget?.contingencyBudget ?? 0),
    otherBudget: Number(activeBudget?.otherBudget ?? 0),
    notes: activeBudget?.notes ?? null,
    isFallbackToApprovedBudget: !activeBudget,
  };
};

const toApprovalStatus = (status: z.infer<typeof paymentStatusSchema>) =>
  status === 'Paid' ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;

budgetExpensesRouter.get('/expenses', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  try {
    if (projectId) {
      const access = await findProjectForUser(user, projectId);
      if (!access.project) return res.status(access.status).json({ error: access.error });
    }

    const projectWhere = await projectWhereForUser(user);
    const expenses = await prisma.expense.findMany({
      where: { project: projectWhere, ...(projectId ? { projectId } : {}) },
      include: { project: true },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });

    return res.status(200).json({ expenses: expenses.map(serializeExpense) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load expenses.' });
  }
});

budgetExpensesRouter.get('/budgets', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  try {
    if (projectId) {
      const access = await findProjectForUser(user, projectId);
      if (!access.project) return res.status(access.status).json({ error: access.error });
    }

    const projectWhere = await projectWhereForUser(user);
    const projects = await prisma.project.findMany({
      where: { ...projectWhere, ...(projectId ? { id: projectId } : {}) },
      include: { budgets: true },
      orderBy: { projectCode: 'asc' },
    });

    return res.status(200).json({ budgets: projects.map(serializeBudget) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load budgets.' });
  }
});

budgetExpensesRouter.get('/summary', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  try {
    if (projectId) {
      const access = await findProjectForUser(user, projectId);
      if (!access.project) return res.status(access.status).json({ error: access.error });
    }

    const projectWhere = await projectWhereForUser(user);
    const projects = await prisma.project.findMany({
      where: { ...projectWhere, ...(projectId ? { id: projectId } : {}) },
      include: { budgets: true, expenses: true },
      orderBy: { projectCode: 'asc' },
    });

    const projectSummaries = projects.map((project) => {
      const budget = serializeBudget(project);
      const totalExpenses = project.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const pendingPayments = project.expenses
        .filter((expense) => expense.approvalStatus === ApprovalStatus.PENDING)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);
      const totalBudget = budget.totalBudget;

      return {
        projectId: project.id,
        projectCode: project.projectCode,
        projectName: project.name,
        totalBudget,
        totalExpenses,
        remainingBudget: Math.max(0, totalBudget - totalExpenses),
        pendingPayments,
        utilization: totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0,
      };
    });

    const summary = projectSummaries.reduce(
      (result, project) => ({
        totalBudget: result.totalBudget + project.totalBudget,
        totalExpenses: result.totalExpenses + project.totalExpenses,
        pendingPayments: result.pendingPayments + project.pendingPayments,
      }),
      { totalBudget: 0, totalExpenses: 0, pendingPayments: 0 },
    );

    return res.status(200).json({
      summary: {
        ...summary,
        remainingBudget: Math.max(0, summary.totalBudget - summary.totalExpenses),
        utilization: summary.totalBudget > 0 ? Math.round((summary.totalExpenses / summary.totalBudget) * 100) : 0,
      },
      projects: projectSummaries,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load budget summary.' });
  }
});

budgetExpensesRouter.post('/expenses', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid expense payload.' });
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const access = await findProjectForUser(req.user, parsed.data.projectId, true);
    if (!access.project) return res.status(access.status).json({ error: access.error });

    const expense = await prisma.expense.create({
      data: {
        projectId: parsed.data.projectId,
        category: parsed.data.category,
        description: parsed.data.title,
        vendorOrSupplier: parsed.data.vendor,
        amount: parsed.data.amount,
        expenseDate: parseDate(parsed.data.date),
        paymentMethod: parsed.data.paymentMethod,
        approvalStatus: toApprovalStatus(parsed.data.paymentStatus),
        createdById: req.user.id,
      },
      include: { project: true },
    });

    return res.status(201).json({ message: 'Expense created successfully.', expense: serializeExpense(expense) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create expense.' });
  }
});

budgetExpensesRouter.put('/expenses/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid expense payload.' });
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id }, select: { id: true, projectId: true } });
    if (!existing) return res.status(404).json({ error: 'Expense not found.' });

    const existingAccess = await findProjectForUser(req.user, existing.projectId, true);
    if (!existingAccess.project) return res.status(existingAccess.status).json({ error: existingAccess.error });
    const targetAccess = await findProjectForUser(req.user, parsed.data.projectId, true);
    if (!targetAccess.project) return res.status(targetAccess.status).json({ error: targetAccess.error });

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        projectId: parsed.data.projectId,
        category: parsed.data.category,
        description: parsed.data.title,
        vendorOrSupplier: parsed.data.vendor,
        amount: parsed.data.amount,
        expenseDate: parseDate(parsed.data.date),
        paymentMethod: parsed.data.paymentMethod,
        approvalStatus: toApprovalStatus(parsed.data.paymentStatus),
      },
      include: { project: true },
    });

    return res.status(200).json({ message: 'Expense updated successfully.', expense: serializeExpense(expense) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update expense.' });
  }
});

budgetExpensesRouter.delete('/expenses/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id }, select: { id: true, projectId: true } });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    const access = await findProjectForUser(req.user, expense.projectId, true);
    if (!access.project) return res.status(access.status).json({ error: access.error });

    await prisma.expense.delete({ where: { id: req.params.id } });
    return res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to delete expense.' });
  }
});

export { budgetExpensesRouter };
