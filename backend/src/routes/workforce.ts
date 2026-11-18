import { Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const skills = z.enum(['MASON', 'CARPENTER', 'STEEL_FIXER', 'ELECTRICIAN', 'PLUMBER', 'PAINTER', 'WELDER', 'HEAVY_OPERATOR', 'GENERAL_LABOUR', 'SITE_SUPERVISOR']);
const workerSchema = z.object({ employeeCode: z.string().trim().min(1).max(80), fullName: z.string().trim().min(1).max(255), tradeSkill: skills.default('GENERAL_LABOUR'), phone: z.string().trim().max(30).nullable().optional(), dailyWageRate: z.coerce.number().finite().positive(), hourlyOvertimeRate: z.coerce.number().finite().min(0), emergencyContact: z.string().trim().max(255).nullable().optional(), isActive: z.boolean().optional() });
const attendanceSchema = z.object({ workerId: z.string().uuid(), projectId: z.string().uuid(), date: z.coerce.date(), status: z.enum(['PRESENT', 'HALF_DAY', 'OVERTIME', 'ABSENT']).default('PRESENT'), regularHours: z.coerce.number().finite().min(0).max(24).default(8), overtimeHours: z.coerce.number().finite().min(0).max(24).default(0), notes: z.string().trim().max(2000).nullable().optional() });
const canManage = (u: any, p: any) => u.role === Role.ADMIN || (u.role === Role.PROJECT_MANAGER && p.projectManagerId === u.id);
const projectFor = async (req: any, id: string, write = false) => {
  const p = await prisma.project.findUnique({ where: { id }, select: { id: true, clientId: true, projectManagerId: true } }); if (!p) return false;
  if (canManage(req.user, p)) return true;
  if (write) return false;
  const c = await prisma.client.findUnique({ where: { userId: req.user.id }, select: { id: true } }); return req.user.role === Role.CLIENT && c?.id === p.clientId;
};
const workerOut = (w: any) => ({ ...w, dailyWageRate: Number(w.dailyWageRate), hourlyOvertimeRate: Number(w.hourlyOvertimeRate) });
const attendanceOut = (a: any) => ({ ...a, calculatedCost: Number(a.calculatedCost), date: a.date.toISOString().slice(0, 10), createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() });

router.get('/workers', async (req, res) => {
  try {
    const workers = req.user?.role === Role.CLIENT
      ? await prisma.worker.findMany({ where: { attendances: { some: { project: { client: { userId: req.user.id } } } } }, orderBy: { fullName: 'asc' } })
      : await prisma.worker.findMany({ orderBy: { fullName: 'asc' } });
    return res.json({ workers: workers.map(workerOut) });
  } catch { return res.status(500).json({ error: 'Unable to load workers.' }); }
});
router.post('/workers', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = workerSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d: any = { ...parsed.data, dailyWageRate: new Prisma.Decimal(parsed.data.dailyWageRate), hourlyOvertimeRate: new Prisma.Decimal(parsed.data.hourlyOvertimeRate) };
  try { return res.status(201).json({ worker: workerOut(await prisma.worker.create({ data: d })) }); } catch { return res.status(409).json({ error: 'Worker employee code already exists.' }); }
});
router.patch('/workers/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = workerSchema.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d: any = { ...parsed.data }; if (d.dailyWageRate !== undefined) d.dailyWageRate = new Prisma.Decimal(d.dailyWageRate); if (d.hourlyOvertimeRate !== undefined) d.hourlyOvertimeRate = new Prisma.Decimal(d.hourlyOvertimeRate);
  try { return res.json({ worker: workerOut(await prisma.worker.update({ where: { id: req.params.id }, data: d })) }); } catch { return res.status(404).json({ error: 'Worker not found.' }); }
});
router.delete('/workers/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => { try { await prisma.worker.delete({ where: { id: req.params.id } }); return res.status(204).send(); } catch { return res.status(404).json({ error: 'Worker not found.' }); } });

router.get('/attendance', async (req, res) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  try {
    if (projectId && !(await projectFor(req, projectId))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    const where: any = projectId ? { projectId } : req.user?.role === Role.CLIENT ? { project: { client: { userId: req.user.id } } } : req.user?.role === Role.PROJECT_MANAGER ? { project: { projectManagerId: req.user.id } } : {};
    return res.json({ attendance: (await prisma.attendance.findMany({ where, include: { worker: true, project: true }, orderBy: { date: 'desc' } })).map(attendanceOut) });
  } catch { return res.status(500).json({ error: 'Unable to load attendance.' }); }
});
router.post('/attendance', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = attendanceSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  try {
    if (!(await projectFor(req, d.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    const result = await prisma.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({ where: { id: d.workerId } }); if (!worker) throw new Error('worker');
      const multiplier = d.status === 'ABSENT' ? 0 : d.status === 'HALF_DAY' ? 0.5 : 1;
      const cost = Number(worker.dailyWageRate) * multiplier + Number(worker.hourlyOvertimeRate) * d.overtimeHours;
      return tx.attendance.create({ data: { ...d, calculatedCost: new Prisma.Decimal(cost), recordedById: req.user!.id } });
    });
    return res.status(201).json({ attendance: attendanceOut(result) });
  } catch { return res.status(400).json({ error: 'Unable to record attendance.' }); }
});
router.patch('/attendance/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = attendanceSchema.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  try { const current = await prisma.attendance.findUnique({ where: { id: req.params.id }, include: { worker: true } }); if (!current) return res.status(404).json({ error: 'Attendance not found.' }); if (!(await projectFor(req, current.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' }); const d: any = parsed.data; const worker = d.workerId ? await prisma.worker.findUnique({ where: { id: d.workerId } }) : current.worker; const status = d.status ?? current.status; const overtime = d.overtimeHours ?? current.overtimeHours; d.calculatedCost = new Prisma.Decimal(Number(worker!.dailyWageRate) * (status === 'ABSENT' ? 0 : status === 'HALF_DAY' ? .5 : 1) + Number(worker!.hourlyOvertimeRate) * overtime); return res.json({ attendance: attendanceOut(await prisma.attendance.update({ where: { id: req.params.id }, data: d })) }); } catch { return res.status(400).json({ error: 'Unable to update attendance.' }); }
});

export { router as workforceRouter };
