import { Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectStatusEnum = z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);
const constructionTypeEnum = z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INFRASTRUCTURE', 'INDUSTRIAL', 'RENOVATION']);

const projectPayloadSchema = z.object({
  projectCode: z.string().trim().min(3).max(80).optional(),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')).default(''),
  constructionType: constructionTypeEnum.default('COMMERCIAL'),
  location: z.string().trim().min(3).max(200),
  contractAmount: z.coerce.number().positive(),
  approvedBudget: z.coerce.number().min(0),
  plannedStartDate: z.string().min(1),
  expectedCompletionDate: z.string().min(1),
  actualCompletionDate: z.string().optional().nullable(),
  status: projectStatusEnum.default('PLANNING'),
  progress: z.coerce.number().min(0).max(100).default(0),
  clientId: z.string().uuid().optional(),
  clientName: z.string().trim().max(200).optional(),
  clientEmail: z.string().trim().email().optional(),
  projectManagerId: z.string().uuid().nullable().optional(),
  projectManager: z.string().trim().max(200).optional(),
  contractorName: z.string().trim().max(200).optional(),
});

const clientAssignmentSchema = z.object({
  clientId: z.string().uuid('A valid client account is required.'),
});

const parseDate = (value: string | null | undefined, field: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} is not a valid date.`);
  }

  return parsed;
};

const getProjectRiskSummary = (project: {
  approvedBudget: Prisma.Decimal | number;
  actualExpenses: number;
  progress: number;
  plannedStartDate: Date;
  expectedCompletionDate: Date;
}) => {
  const approvedBudgetValue = Number(project.approvedBudget ?? 0);
  const expenseRatio = approvedBudgetValue > 0 ? (project.actualExpenses / approvedBudgetValue) * 100 : 0;
  const progressPenalty = Math.max(0, 100 - project.progress);
  const scheduleRisk = Math.min(100, Math.max(0, Math.round((expenseRatio * 0.7) + (progressPenalty * 0.3))));
  const costRiskScore = Math.min(100, Math.round(Math.max(0, expenseRatio * 0.8) + Math.max(0, 40 - project.progress) * 0.5));

  return {
    costRiskScore,
    costRiskTier: costRiskScore >= 70 ? 'HIGH' : costRiskScore >= 35 ? 'MEDIUM' : 'LOW',
    scheduleRiskScore: scheduleRisk,
    scheduleRiskTier: scheduleRisk >= 70 ? 'HIGH' : scheduleRisk >= 35 ? 'MEDIUM' : 'LOW',
  };
};

const projectInclude = {
  client: true,
  projectManager: true,
  expenses: true,
  payments: true,
  invoices: {
    include: {
      payments: true,
    },
  },
} as const;

const serializeProject = (project: Prisma.ProjectGetPayload<{ include: typeof projectInclude }>) => {
  const actualExpenses = project.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const amountPaid = project.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstandingAmount = Math.max(0, Number(project.contractAmount) - amountPaid);
  const riskSummary = getProjectRiskSummary({
    approvedBudget: project.approvedBudget,
    actualExpenses,
    progress: Number(project.progress),
    plannedStartDate: project.plannedStartDate,
    expectedCompletionDate: project.expectedCompletionDate,
  });

  return {
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
    description: project.description ?? '',
    constructionType: project.constructionType,
    location: project.location,
    clientId: project.clientId,
    clientName: project.client?.name ?? '',
    clientEmail: project.client?.email ?? '',
    contractAmount: Number(project.contractAmount),
    approvedBudget: Number(project.approvedBudget),
    actualExpenses,
    amountPaid,
    outstandingAmount,
    plannedStartDate: project.plannedStartDate.toISOString().slice(0, 10),
    expectedCompletionDate: project.expectedCompletionDate.toISOString().slice(0, 10),
    actualCompletionDate: project.actualCompletionDate ? project.actualCompletionDate.toISOString().slice(0, 10) : undefined,
    status: project.status,
    progress: Number(project.progress),
    projectManagerId: project.projectManagerId,
    projectManager: project.projectManager?.name ?? 'Unassigned',
    contractorName: 'Aniket Desai',
    costRiskScore: riskSummary.costRiskScore,
    costRiskTier: riskSummary.costRiskTier,
    scheduleRiskScore: riskSummary.scheduleRiskScore,
    scheduleRiskTier: riskSummary.scheduleRiskTier,
    isDemoData: false,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
};

const resolveClient = async (data: { clientId?: string; clientName?: string; clientEmail?: string }) => {
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      throw new Error('Client not found.');
    }
    return client;
  }

  if (data.clientEmail) {
    const client = await prisma.client.upsert({
      where: { email: data.clientEmail.toLowerCase() },
      update: { name: data.clientName ?? undefined },
      create: {
        email: data.clientEmail.toLowerCase(),
        name: data.clientName ?? 'Client',
        address: null,
      },
    });
    return client;
  }

  if (data.clientName) {
    const client = await prisma.client.upsert({
      where: { email: `${data.clientName.toLowerCase().replace(/\s+/g, '.')}@morya.local` },
      update: { name: data.clientName },
      create: {
        email: `${data.clientName.toLowerCase().replace(/\s+/g, '.')}@morya.local`,
        name: data.clientName,
        address: null,
      },
    });
    return client;
  }

  throw new Error('A valid client is required.');
};

const canAccessProject = (userRole: Role, userId: string, project: { clientId: string; projectManagerId: string | null }) => {
  if (userRole === 'ADMIN') {
    return true;
  }

  if (userRole === 'PROJECT_MANAGER') {
    return project.projectManagerId === userId;
  }

  return false;
};

projectsRouter.get('/', async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    let projects;

    if (user.role === 'CLIENT') {
      const clientRecord = await prisma.client.findUnique({ where: { userId: user.id } });
      if (!clientRecord) {
        return res.status(200).json({ projects: [] });
      }

      projects = await prisma.project.findMany({
        where: { clientId: clientRecord.id },
        include: projectInclude,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      projects = await prisma.project.findMany({
        where: user.role === 'PROJECT_MANAGER' ? { projectManagerId: user.id } : {},
        include: projectInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    return res.status(200).json({
      projects: projects.map(serializeProject),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load projects.' });
  }
});

projectsRouter.get('/clients', requireRole(Role.ADMIN), async (_req, res) => {
  try {
    const clients = await prisma.client.findMany({
      select: { id: true, name: true, email: true, userId: true, user: { select: { name: true, email: true, isActive: true } } },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ clients });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load client accounts.' });
  }
});

projectsRouter.get('/:id', async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: projectInclude,
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (user.role === 'CLIENT') {
      const clientRecord = await prisma.client.findUnique({ where: { userId: user.id } });
      if (!clientRecord || project.clientId !== clientRecord.id) {
        return res.status(403).json({ error: 'You do not have access to this project.' });
      }
    } else if (user.role === 'PROJECT_MANAGER' && !canAccessProject(user.role, user.id, project)) {
      return res.status(403).json({ error: 'You do not have permission to access this project.' });
    }

    return res.status(200).json({ project: serializeProject(project) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch project.' });
  }
});

projectsRouter.patch('/:id/client', requireRole(Role.ADMIN), async (req, res) => {
  const parsed = clientAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid client assignment.' });
  }

  try {
    const [project, client] = await Promise.all([
      prisma.project.findUnique({ where: { id: req.params.id } }),
      prisma.client.findUnique({ where: { id: parsed.data.clientId } }),
    ]);

    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!client) return res.status(404).json({ error: 'Client account not found.' });

    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: { clientId: client.id },
      include: projectInclude,
    });

    return res.status(200).json({ message: 'Project assigned to client account.', project: serializeProject(updatedProject) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to assign project.' });
  }
});

projectsRouter.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  const parsed = projectPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid project payload.' });
  }

  const payload = parsed.data;

  try {
    if (payload.contractAmount <= 0) {
      return res.status(400).json({ error: 'Contract amount must be greater than zero.' });
    }

    if (payload.approvedBudget > payload.contractAmount) {
      return res.status(400).json({ error: 'Approved budget cannot exceed contract value.' });
    }

    const clientRecord = await resolveClient({
      clientId: payload.clientId,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
    });

    const effectiveProjectManagerId = req.user?.role === 'PROJECT_MANAGER'
      ? (payload.projectManagerId && payload.projectManagerId !== req.user.id ? req.user.id : (payload.projectManagerId ?? req.user.id))
      : payload.projectManagerId ?? null;

    const projectCode = payload.projectCode?.trim() || `MORYA-PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

    const plannedStartDate = parseDate(payload.plannedStartDate, 'plannedStartDate');
    const expectedCompletionDate = parseDate(payload.expectedCompletionDate, 'expectedCompletionDate');
    const actualCompletionDate = parseDate(payload.actualCompletionDate ?? null, 'actualCompletionDate');

    if (!plannedStartDate || !expectedCompletionDate) {
      return res.status(400).json({ error: 'Project start and end dates are required.' });
    }

    const project = await prisma.project.create({
      data: {
        projectCode,
        name: payload.name,
        description: payload.description || null,
        constructionType: payload.constructionType,
        location: payload.location,
        contractAmount: payload.contractAmount,
        approvedBudget: payload.approvedBudget,
        plannedStartDate,
        expectedCompletionDate,
        actualCompletionDate,
        status: payload.status,
        progress: payload.progress,
        clientId: clientRecord.id,
        projectManagerId: effectiveProjectManagerId,
      },
      include: projectInclude,
    });

    return res.status(201).json({
      message: 'Project created successfully.',
      project: serializeProject(project),
    });
  } catch (error) {
    if ((error as Error).message.includes('Client not found') || (error as Error).message.includes('A valid client is required')) {
      return res.status(400).json({ error: (error as Error).message });
    }

    if ((error as Error).message.includes('Unique constraint')) {
      return res.status(409).json({ error: 'A project with this code already exists.' });
    }

    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create project.' });
  }
});

projectsRouter.put('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  const parsed = projectPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid project payload.' });
  }

  const payload = parsed.data;

  try {
    const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (req.user?.role === 'PROJECT_MANAGER' && !canAccessProject(req.user.role, req.user.id, existingProject)) {
      return res.status(403).json({ error: 'You do not have permission to update this project.' });
    }

    if (payload.approvedBudget > payload.contractAmount) {
      return res.status(400).json({ error: 'Approved budget cannot exceed contract value.' });
    }

    const clientRecord = req.user?.role === Role.PROJECT_MANAGER
      ? await prisma.client.findUnique({ where: { id: existingProject.clientId } })
      : await resolveClient({
          clientId: payload.clientId,
          clientName: payload.clientName,
          clientEmail: payload.clientEmail,
        });

    if (!clientRecord) return res.status(404).json({ error: 'Project client not found.' });

    const plannedStartDate = parseDate(payload.plannedStartDate, 'plannedStartDate');
    const expectedCompletionDate = parseDate(payload.expectedCompletionDate, 'expectedCompletionDate');
    const actualCompletionDate = parseDate(payload.actualCompletionDate ?? null, 'actualCompletionDate');

    if (!plannedStartDate || !expectedCompletionDate) {
      return res.status(400).json({ error: 'Project start and end dates are required.' });
    }

    const projectManagerId = req.user?.role === 'PROJECT_MANAGER'
      ? (payload.projectManagerId ?? req.user.id)
      : payload.projectManagerId ?? null;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        projectCode: payload.projectCode ?? existingProject.projectCode,
        name: payload.name,
        description: payload.description ?? existingProject.description,
        constructionType: payload.constructionType,
        location: payload.location,
        contractAmount: payload.contractAmount,
        approvedBudget: payload.approvedBudget,
        plannedStartDate,
        expectedCompletionDate,
        actualCompletionDate,
        status: payload.status,
        progress: payload.progress,
        clientId: clientRecord.id,
        projectManagerId: projectManagerId,
      },
      include: projectInclude,
    });

    return res.status(200).json({
      message: 'Project updated successfully.',
      project: serializeProject(project),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update project.' });
  }
});

projectsRouter.patch('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  try {
    const existingProject = await prisma.project.findUnique({ where: { id: req.params.id }, include: projectInclude });
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (req.user?.role === 'PROJECT_MANAGER' && !canAccessProject(req.user.role, req.user.id, existingProject)) {
      return res.status(403).json({ error: 'You do not have permission to update this project.' });
    }

    const payload = projectPayloadSchema.partial().safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.issues[0]?.message ?? 'Invalid project update payload.' });
    }

    const updates = payload.data;
    if (!updates.name && !updates.location && !updates.contractAmount && !updates.approvedBudget && !updates.status && !updates.progress) {
      return res.status(400).json({ error: 'At least one valid field is required for update.' });
    }

    const nextData: Prisma.ProjectUpdateInput = {};
    if (updates.name) nextData.name = updates.name;
    if (updates.description !== undefined) nextData.description = updates.description || null;
    if (updates.constructionType) nextData.constructionType = updates.constructionType;
    if (updates.location) nextData.location = updates.location;
    if (updates.contractAmount) nextData.contractAmount = updates.contractAmount;
    if (updates.approvedBudget !== undefined) nextData.approvedBudget = updates.approvedBudget;
    if (updates.plannedStartDate) nextData.plannedStartDate = parseDate(updates.plannedStartDate, 'plannedStartDate') ?? existingProject.plannedStartDate;
    if (updates.expectedCompletionDate) nextData.expectedCompletionDate = parseDate(updates.expectedCompletionDate, 'expectedCompletionDate') ?? existingProject.expectedCompletionDate;
    if (updates.actualCompletionDate !== undefined) nextData.actualCompletionDate = parseDate(updates.actualCompletionDate ?? null, 'actualCompletionDate');
    if (updates.status) nextData.status = updates.status;
    if (updates.progress !== undefined) nextData.progress = updates.progress;
    if (updates.projectCode) nextData.projectCode = updates.projectCode;
    if (updates.clientId || updates.clientEmail || updates.clientName) {
      if (req.user?.role === Role.PROJECT_MANAGER) {
        return res.status(403).json({ error: 'Only an administrator can change a project client.' });
      }
      const clientRecord = await resolveClient({
        clientId: updates.clientId,
        clientName: updates.clientName,
        clientEmail: updates.clientEmail,
      });
      nextData.client = { connect: { id: clientRecord.id } };
    }
    if (updates.projectManagerId !== undefined || req.user?.role === 'PROJECT_MANAGER') {
      const projectManagerId = updates.projectManagerId ?? req.user?.id ?? null;
      nextData.projectManager = projectManagerId ? { connect: { id: projectManagerId } } : { disconnect: true };
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: nextData,
      include: projectInclude,
    });

    return res.status(200).json({
      message: 'Project updated successfully.',
      project: serializeProject(project),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update project.' });
  }
});

projectsRouter.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (req.user?.role === 'PROJECT_MANAGER' && !canAccessProject(req.user.role, req.user.id, project)) {
      return res.status(403).json({ error: 'You do not have permission to delete this project.' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    return res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to delete project.' });
  }
});

export { projectsRouter };
