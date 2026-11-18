import { MilestoneStatus, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const payload = z.object({
  projectId: z.string().uuid(), name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  plannedStartDate: z.coerce.date(), plannedEndDate: z.coerce.date(),
  actualCompletionDate: z.coerce.date().nullable().optional(), assignedToId: z.string().uuid().nullable().optional(),
  weightagePercentage: z.coerce.number().min(0).max(100).default(10),
  progressPercentage: z.coerce.number().min(0).max(100).default(0),
  status: z.nativeEnum(MilestoneStatus).default(MilestoneStatus.NOT_STARTED), clientApprovalRequired: z.boolean().default(true),
});
const include = { project: true, assignedTo: { select: { id: true, name: true, email: true } }, approvalLogs: { orderBy: { createdAt: 'desc' as const } } };
const access = async (req: any, id: string, write = false) => {
  const p = await prisma.project.findUnique({ where: { id }, select: { clientId: true, projectManagerId: true } }); if (!p) return false;
  if (req.user.role === Role.ADMIN) return true;
  if (req.user.role === Role.PROJECT_MANAGER) return p.projectManagerId === req.user.id;
  const c = await prisma.client.findUnique({ where: { userId: req.user.id }, select: { id: true } }); return !write && req.user.role === Role.CLIENT && c?.id === p.clientId;
};
const serialize = (m: any) => ({ ...m, weightagePercentage: Number(m.weightagePercentage), progressPercentage: Number(m.progressPercentage), plannedStartDate: m.plannedStartDate.toISOString().slice(0, 10), plannedEndDate: m.plannedEndDate.toISOString().slice(0, 10), actualCompletionDate: m.actualCompletionDate?.toISOString().slice(0, 10) ?? null });

router.get('/', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    if (projectId && !(await access(req, projectId))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const where: any = projectId ? { projectId } : user.role === Role.CLIENT ? { project: { client: { userId: user.id } } } : user.role === Role.PROJECT_MANAGER ? { project: { projectManagerId: user.id } } : {};
    return res.json({ milestones: (await prisma.milestone.findMany({ where, include, orderBy: { plannedStartDate: 'asc' } })).map(serialize) });
  } catch { return res.status(500).json({ error: 'Unable to load milestones.' }); }
});
router.get('/:id', async (req, res) => { try { const m = await prisma.milestone.findUnique({ where: { id: req.params.id }, include }); if (!m) return res.status(404).json({ error: 'Milestone not found.' }); if (!(await access(req, m.projectId))) return res.status(403).json({ error: 'You do not have permission to access this project.' }); return res.json({ milestone: serialize(m) }); } catch { return res.status(500).json({ error: 'Unable to load milestone.' }); } });
router.post('/', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => { const p = payload.safeParse(req.body); if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message }); if (p.data.plannedEndDate < p.data.plannedStartDate) return res.status(400).json({ error: 'End date must be on or after start date.' }); try { if (!(await access(req, p.data.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' }); return res.status(201).json({ milestone: serialize(await prisma.milestone.create({ data: p.data, include })) }); } catch { return res.status(400).json({ error: 'Unable to create milestone.' }); } });
router.patch('/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => { const p = payload.partial().safeParse(req.body); if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message }); try { const old = await prisma.milestone.findUnique({ where: { id: req.params.id } }); if (!old) return res.status(404).json({ error: 'Milestone not found.' }); if (!(await access(req, old.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' }); return res.json({ milestone: serialize(await prisma.milestone.update({ where: { id: old.id }, data: p.data, include })) }); } catch { return res.status(400).json({ error: 'Unable to update milestone.' }); } });
router.delete('/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => { try { const m = await prisma.milestone.findUnique({ where: { id: req.params.id } }); if (!m) return res.status(404).json({ error: 'Milestone not found.' }); if (!(await access(req, m.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' }); await prisma.milestone.delete({ where: { id: m.id } }); return res.status(204).send(); } catch { return res.status(400).json({ error: 'Unable to delete milestone.' }); } });
const approval = async (req: any, res: any, action: 'APPROVED' | 'REJECTED') => { const p = z.object({ comments: z.string().max(2000).optional() }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message }); const m = await prisma.milestone.findUnique({ where: { id: req.params.id } }); if (!m) return res.status(404).json({ error: 'Milestone not found.' }); if (req.user.role !== Role.CLIENT || !(await access(req, m.projectId))) return res.status(403).json({ error: 'Only the authorized client may approve milestones.' }); const updated = await prisma.$transaction(async tx => { const value = await tx.milestone.update({ where: { id: m.id }, data: { clientApprovalStatus: action, clientApprovedAt: action === 'APPROVED' ? new Date() : null, clientRejectionReason: action === 'REJECTED' ? p.data.comments : null, status: action === 'APPROVED' ? MilestoneStatus.APPROVED : MilestoneStatus.SUBMITTED_FOR_APPROVAL }, include }); await tx.milestoneApprovalLog.create({ data: { milestoneId: m.id, action, actorId: req.user.id, actorRole: Role.CLIENT, comments: p.data.comments } }); return value; }); return res.json({ milestone: serialize(updated) }); };
router.post('/:id/approve', (req, res) => approval(req, res, 'APPROVED').catch(() => res.status(400).json({ error: 'Unable to record approval.' })));
router.post('/:id/reject', (req, res) => approval(req, res, 'REJECTED').catch(() => res.status(400).json({ error: 'Unable to record approval.' })));
router.post('/:id/approval', (req, res) => approval(req, res, req.body?.action === 'REJECTED' ? 'REJECTED' : 'APPROVED').catch(() => res.status(400).json({ error: 'Unable to record approval.' })));
export { router as milestonesRouter };
