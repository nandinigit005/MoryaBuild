import { Prisma, QuotationStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
const id = z.string().uuid();
const item = z.object({ itemCode: z.string().trim().max(100).optional(), description: z.string().trim().min(1), quantity: z.coerce.number().finite().positive(), unit: z.string().trim().min(1).max(40).default('SQ_FT'), unitRate: z.coerce.number().finite().nonnegative(), sortOrder: z.coerce.number().int().nonnegative().default(0) });
const payload = z.object({
  quotationNumber: z.string().trim().min(1).max(80), clientId: id, title: z.string().trim().min(1).max(255),
  scopeDescription: z.string().optional().nullable(), status: z.nativeEnum(QuotationStatus).optional(),
  taxRate: z.coerce.number().finite().min(0).max(100).default(18), discountAmount: z.coerce.number().finite().min(0).default(0),
  validityDate: z.string().min(1), items: z.array(item).min(1),
});
const parseDate = (value: string) => { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error('Date is not valid.'); return date; };
const canManage = (user: Express.Request['user']) => user?.role === Role.ADMIN || user?.role === Role.PROJECT_MANAGER;
const clientFor = async (user: NonNullable<Express.Request['user']>) => prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } });
const canRead = async (user: NonNullable<Express.Request['user']>, clientId: string) =>
  user.role === Role.ADMIN ||
  (user.role === Role.PROJECT_MANAGER && Boolean(await prisma.project.findFirst({ where: { clientId, projectManagerId: user.id }, select: { id: true } }))) ||
  (user.role === Role.CLIENT && (await clientFor(user))?.id === clientId);
const totals = (items: z.infer<typeof item>[], taxRate: number, discount: number) => {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitRate, 0);
  const taxAmount = Math.max(0, subtotal - discount) * taxRate / 100;
  return { subtotal, taxAmount, totalAmount: Math.max(0, subtotal - discount) + taxAmount };
};
const serialize = (q: any) => ({ ...q, subtotal: Number(q.subtotal), taxAmount: Number(q.taxAmount), discountAmount: Number(q.discountAmount), totalAmount: Number(q.totalAmount), items: q.items?.map((i: any) => ({ ...i, unitRate: Number(i.unitRate), amount: Number(i.amount) })) });
const include = { items: true, client: true } as const;

router.get('/', async (req, res) => {
  const user = req.user!;
  try {
    const where = user.role === Role.ADMIN
      ? {}
      : user.role === Role.PROJECT_MANAGER
      ? { client: { projects: { some: { projectManagerId: user.id } } } }
      : { clientId: (await clientFor(user))?.id ?? '__none__' };
    const quotations = await prisma.quotation.findMany({ where, include, orderBy: { createdAt: 'desc' } });
    return res.json({ quotations: quotations.map(serialize) });
  } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : 'Unable to load quotations.' }); }
});

router.get('/:id', async (req, res) => {
  if (!id.safeParse(req.params.id).success) return res.status(400).json({ error: 'A valid quotation ID is required.' });
  const quotation = await prisma.quotation.findUnique({ where: { id: req.params.id }, include });
  if (!quotation) return res.status(404).json({ error: 'Quotation not found.' });
  if (!(await canRead(req.user!, quotation.clientId))) return res.status(403).json({ error: 'You do not have permission to access this quotation.' });
  return res.json({ quotation: serialize(quotation) });
});

const save = async (req: any, res: any, update: boolean) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to manage quotations.' });
  const parsed = payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid quotation.' });
  try {
    const data = parsed.data; parseDate(data.validityDate);
    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'Client not found.' });
    if (!(await canRead(req.user, client.id))) return res.status(403).json({ error: 'You do not have permission to access this client project.' });
    const t = totals(data.items, data.taxRate, data.discountAmount);
    const quotation = await prisma.$transaction(async (tx) => {
      const base = { quotationNumber: data.quotationNumber, clientId: data.clientId, title: data.title, scopeDescription: data.scopeDescription ?? null, ...(data.status ? { status: data.status } : {}), taxRate: data.taxRate, ...t, discountAmount: data.discountAmount, validityDate: parseDate(data.validityDate), createdById: req.user.id };
      if (!update) return tx.quotation.create({ data: { ...base, items: { create: data.items.map(i => ({ ...i, amount: i.quantity * i.unitRate })) } }, include });
      await tx.quotationItem.deleteMany({ where: { quotationId: req.params.id } });
      return tx.quotation.update({ where: { id: req.params.id }, data: { ...base, createdById: undefined, items: { create: data.items.map(i => ({ ...i, amount: i.quantity * i.unitRate })) } }, include });
    });
    return res.status(update ? 200 : 201).json({ quotation: serialize(quotation) });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to save quotation.' }); }
};
router.post('/', (req, res) => save(req, res, false));
router.put('/:id', async (req, res) => {
  const existing = await prisma.quotation.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Quotation not found.' });
  return save(req, res, true);
});
router.delete('/:id', async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to manage quotations.' });
  try { const quotation = await prisma.quotation.findUnique({ where: { id: req.params.id }, select: { id: true, clientId: true } }); if (!quotation) return res.status(404).json({ error: 'Quotation not found.' }); if (!(await canRead(req.user!, quotation.clientId))) return res.status(403).json({ error: 'You do not have permission to access this quotation.' }); await prisma.quotation.delete({ where: { id: req.params.id } }); return res.json({ message: 'Quotation deleted.' }); } catch { return res.status(404).json({ error: 'Quotation not found.' }); }
});

router.post('/:id/convert', async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to convert quotations.' });
  const q = await prisma.quotation.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!q) return res.status(404).json({ error: 'Quotation not found.' });
  if (!(await canRead(req.user!, q.clientId))) return res.status(403).json({ error: 'You do not have permission to access this quotation.' });
  const schema = z.object({ projectCode: z.string().trim().min(1), name: z.string().trim().min(1), location: z.string().trim().min(1), constructionType: z.enum(['RESIDENTIAL','COMMERCIAL','INFRASTRUCTURE','INDUSTRIAL','RENOVATION']).default('COMMERCIAL'), plannedStartDate: z.string(), expectedCompletionDate: z.string(), projectManagerId: id.nullable().optional() });
  const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message });
  try {
    const project = await prisma.$transaction(async tx => {
      const created = await tx.project.create({ data: { ...p.data, projectManagerId: req.user?.role === Role.PROJECT_MANAGER ? req.user.id : p.data.projectManagerId, clientId: q.clientId, contractAmount: q.totalAmount, approvedBudget: q.totalAmount, plannedStartDate: parseDate(p.data.plannedStartDate), expectedCompletionDate: parseDate(p.data.expectedCompletionDate), acceptedQuotationId: q.id } });
      await tx.quotation.update({ where: { id: q.id }, data: { status: QuotationStatus.ACCEPTED } });
      return created;
    });
    return res.status(201).json({ project });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to convert quotation.' }); }
});
export { router as quotationsRouter };
