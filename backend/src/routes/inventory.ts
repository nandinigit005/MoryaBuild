import { InventoryMovementType, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const movementTypes = z.enum(['PURCHASE_RECEIPT', 'PROJECT_CONSUMPTION', 'RETURN_TO_SUPPLIER', 'WASTAGE_ADJUSTMENT']);
const materialSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(100).default('GENERAL'),
  unit: z.string().trim().min(1).max(40).default('BAGS'),
  currentStock: z.coerce.number().finite().min(0).default(0),
  minimumThreshold: z.coerce.number().finite().min(0).default(10),
  unitPrice: z.coerce.number().finite().min(0),
  supplierId: z.string().uuid().nullable().optional(),
});
const movementSchema = z.object({
  materialId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  movementType: movementTypes,
  quantity: z.coerce.number().finite().positive(),
  unitPrice: z.coerce.number().finite().min(0),
  referenceDoc: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const manage = (req: any) => req.user?.role === Role.ADMIN || req.user?.role === Role.PROJECT_MANAGER;
const projectAccess = async (req: any, projectId: string, write = false) => {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true, projectManagerId: true } });
  if (!project) return false;
  if (req.user.role === Role.ADMIN) return true;
  if (req.user.role === Role.PROJECT_MANAGER) return project.projectManagerId === req.user.id;
  const client = await prisma.client.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  return client?.id === project.clientId && !write;
};
const serializeMaterial = (m: any) => ({ ...m, unitPrice: Number(m.unitPrice), currentStock: Number(m.currentStock), minimumThreshold: Number(m.minimumThreshold) });
const serializeMovement = (m: any) => ({ ...m, quantity: Number(m.quantity), unitPrice: Number(m.unitPrice), totalCost: Number(m.totalCost), createdAt: m.createdAt.toISOString() });

router.get('/materials', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (_req, res) => {
  try { return res.json({ materials: (await prisma.material.findMany({ include: { supplier: true }, orderBy: { name: 'asc' } })).map(serializeMaterial) }); }
  catch { return res.status(500).json({ error: 'Unable to load materials.' }); }
});
router.post('/materials', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = materialSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  try { return res.status(201).json({ material: serializeMaterial(await prisma.material.create({ data: { ...parsed.data, unitPrice: new Prisma.Decimal(parsed.data.unitPrice) } })) }); }
  catch (e) { return res.status((e as any)?.code === 'P2002' ? 409 : 500).json({ error: 'Unable to create material.' }); }
});
router.patch('/materials/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = materialSchema.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  try { const data: any = { ...parsed.data }; if (data.unitPrice !== undefined) data.unitPrice = new Prisma.Decimal(data.unitPrice); return res.json({ material: serializeMaterial(await prisma.material.update({ where: { id: req.params.id }, data })) }); }
  catch { return res.status(404).json({ error: 'Material not found.' }); }
});
router.delete('/materials/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  try { await prisma.material.delete({ where: { id: req.params.id } }); return res.status(204).send(); } catch { return res.status(404).json({ error: 'Material not found.' }); }
});
router.get('/movements', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    if (projectId && !(await projectAccess(req, projectId))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    const where: any = projectId ? { projectId } : req.user?.role === Role.CLIENT ? { project: { client: { userId: req.user.id } } } : req.user?.role === Role.PROJECT_MANAGER ? { project: { projectManagerId: req.user.id } } : {};
    return res.json({ movements: (await prisma.inventoryMovement.findMany({ where, include: { material: true, project: true }, orderBy: { createdAt: 'desc' } })).map(serializeMovement) });
  } catch { return res.status(500).json({ error: 'Unable to load stock movements.' }); }
});
router.post('/movements', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), async (req, res) => {
  const parsed = movementSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const p = parsed.data;
  try {
    if (p.projectId && !(await projectAccess(req, p.projectId, true))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    const sign = p.movementType === InventoryMovementType.PURCHASE_RECEIPT ? 1 : -1;
    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: p.materialId } }); if (!material) throw new Error('material');
      const next = Number(material.currentStock) + sign * p.quantity; if (next < 0) throw new Error('stock');
      const movement = await tx.inventoryMovement.create({ data: { ...p, unitPrice: new Prisma.Decimal(p.unitPrice), totalCost: new Prisma.Decimal(p.unitPrice * p.quantity), recordedById: req.user!.id } });
      await tx.material.update({ where: { id: p.materialId }, data: { currentStock: next } }); return movement;
    });
    return res.status(201).json({ movement: serializeMovement(result) });
  } catch (e) { return res.status(400).json({ error: (e as Error).message === 'stock' ? 'Insufficient stock.' : 'Unable to record stock movement.' }); }
});

export { router as inventoryRouter };
