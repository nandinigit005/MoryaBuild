import { InvoiceStatus, PaymentMethod, PaymentVerificationStatus, Prisma, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);
const uuid = z.string().uuid();
const item = z.object({ description: z.string().trim().min(1), quantity: z.coerce.number().finite().positive(), unitPrice: z.coerce.number().finite().nonnegative() });
const invoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(80), projectId: uuid, clientId: uuid.optional(), issueDate: z.string(), dueDate: z.string(),
  status: z.nativeEnum(InvoiceStatus).optional(), taxRate: z.coerce.number().finite().min(0).max(100).default(18), discountAmount: z.coerce.number().finite().min(0).default(0),
  notes: z.string().optional().nullable(), termsAndConditions: z.string().optional().nullable(), items: z.array(item).min(1),
});
const paymentSchema = z.object({ amount: z.coerce.number().finite().positive(), paymentDate: z.string(), paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER), transactionReference: z.string().trim().max(255).optional(), notes: z.string().optional().nullable() });
const verificationSchema = z.object({ amount: z.coerce.number().finite().positive(), transactionReference: z.string().trim().min(1).max(255) });
const parseDate = (s: string) => { const d = new Date(s); if (Number.isNaN(d.getTime())) throw new Error('Date is not valid.'); return d; };
const canManage = (u: Express.Request['user']) => u?.role === Role.ADMIN || u?.role === Role.PROJECT_MANAGER;
const clientId = async (u: NonNullable<Express.Request['user']>) => (await prisma.client.findUnique({ where: { userId: u.id }, select: { id: true } }))?.id;
const access = async (u: NonNullable<Express.Request['user']>, project: { clientId: string; projectManagerId: string | null }) =>
  u.role === Role.ADMIN ||
  (u.role === Role.PROJECT_MANAGER && project.projectManagerId === u.id) ||
  (u.role === Role.CLIENT && (await clientId(u)) === project.clientId);
const include = { items: true, payments: true, project: { select: { id: true, projectCode: true, name: true, clientId: true, projectManagerId: true } }, client: true } as const;
const serialize = (i: any) => ({ ...i, subtotal: Number(i.subtotal), taxAmount: Number(i.taxAmount), discountAmount: Number(i.discountAmount), totalAmount: Number(i.totalAmount), paidAmount: Number(i.paidAmount), balanceDue: Number(i.balanceDue), items: i.items?.map((x: any) => ({ ...x, unitPrice: Number(x.unitPrice), amount: Number(x.amount) })), payments: i.payments?.map((p: any) => ({ ...p, amount: Number(p.amount) })) });
const totals = (items: z.infer<typeof item>[], taxRate: number, discount: number) => { const subtotal = items.reduce((s, x) => s + x.quantity * x.unitPrice, 0); const taxAmount = Math.max(0, subtotal - discount) * taxRate / 100; const totalAmount = Math.max(0, subtotal - discount) + taxAmount; return { subtotal, taxAmount, totalAmount, balanceDue: totalAmount }; };

router.get('/', async (req, res) => {
  try {
    const where = req.user?.role === Role.ADMIN
      ? {}
      : req.user?.role === Role.PROJECT_MANAGER
      ? { project: { projectManagerId: req.user.id } }
      : { clientId: (await clientId(req.user!)) ?? '__none__' };
    const invoices = await prisma.invoice.findMany({ where, include, orderBy: { createdAt: 'desc' } });
    return res.json({ invoices: invoices.map(serialize) });
  } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : 'Unable to load invoices.' }); }
});
router.get('/payment-config', (_req, res) => res.json({ payeeName: 'Morya Enterprises', upiId: env.MORYA_UPI_ID ?? null }));
router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  if (!(await access(req.user!, invoice.project))) return res.status(403).json({ error: 'You do not have permission to access this invoice.' });
  return res.json({ invoice: serialize(invoice) });
});

const save = async (req: any, res: any, update: boolean) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to manage invoices.' });
  const parsed = invoiceSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid invoice.' });
  try {
    const d = parsed.data; const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { clientId: true, projectManagerId: true } });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!(await access(req.user!, project))) return res.status(403).json({ error: 'You do not have permission to access this project.' });
    if (d.clientId && d.clientId !== project.clientId) return res.status(400).json({ error: 'Invoice client must match the project client.' });
    const t = totals(d.items, d.taxRate, d.discountAmount);
    const invoice = await prisma.$transaction(async tx => {
      const base = { invoiceNumber: d.invoiceNumber, projectId: d.projectId, clientId: project.clientId, issueDate: parseDate(d.issueDate), dueDate: parseDate(d.dueDate), ...(d.status ? { status: d.status } : {}), taxRate: d.taxRate, ...t, discountAmount: d.discountAmount, notes: d.notes ?? null, termsAndConditions: d.termsAndConditions ?? null, createdById: req.user.id };
      if (!update) return tx.invoice.create({ data: { ...base, items: { create: d.items.map(x => ({ ...x, amount: x.quantity * x.unitPrice })) } }, include });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
      return tx.invoice.update({ where: { id: req.params.id }, data: { ...base, createdById: undefined, paidAmount: undefined, balanceDue: undefined, items: { create: d.items.map(x => ({ ...x, amount: x.quantity * x.unitPrice })) } }, include });
    });
    return res.status(update ? 200 : 201).json({ invoice: serialize(invoice) });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to save invoice.' }); }
};
router.post('/', (req, res) => save(req, res, false));
router.put('/:id', async (req, res) => { const i = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { id: true } }); if (!i) return res.status(404).json({ error: 'Invoice not found.' }); return save(req, res, true); });
router.delete('/:id', async (req, res) => { if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to manage invoices.' }); try { const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { project: true } }); if (!invoice) return res.status(404).json({ error: 'Invoice not found.' }); if (!(await access(req.user!, invoice.project))) return res.status(403).json({ error: 'You do not have permission to access this invoice.' }); await prisma.invoice.delete({ where: { id: req.params.id } }); return res.json({ message: 'Invoice deleted.' }); } catch { return res.status(404).json({ error: 'Invoice not found.' }); } });

router.get('/:id/payment-verifications', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (!(await access(req.user!, invoice.project))) return res.status(403).json({ error: 'You do not have permission to access this invoice.' });
    const verifications = await prisma.paymentVerification.findMany({ where: { invoiceId: invoice.id }, orderBy: { createdAt: 'desc' } });
    return res.json({ verifications: verifications.map((verification) => ({ ...verification, amount: Number(verification.amount) })) });
  } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : 'Unable to load payment verifications.' }); }
});

router.post('/:id/payment-verifications', async (req, res) => {
  const parsed = verificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment verification.' });
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { project: true } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (!(await access(req.user!, invoice.project))) return res.status(403).json({ error: 'You do not have permission to access this invoice.' });
    if (parsed.data.amount > Number(invoice.balanceDue)) return res.status(400).json({ error: 'Payment cannot exceed the invoice balance.' });
    const verification = await prisma.paymentVerification.create({ data: { invoiceId: invoice.id, projectId: invoice.projectId, amount: parsed.data.amount, transactionReference: parsed.data.transactionReference, submittedById: req.user!.id } });
    return res.status(201).json({ verification: { ...verification, amount: Number(verification.amount) } });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to submit payment verification.' }); }
});

router.patch('/:id/payment-verifications/:verificationId', async (req, res) => {
  if (!canManage(req.user)) return res.status(403).json({ error: 'Only an administrator or project manager can verify payments.' });
  const parsed = z.object({ status: z.nativeEnum(PaymentVerificationStatus) }).safeParse(req.body);
  if (!parsed.success || parsed.data.status === PaymentVerificationStatus.PENDING) return res.status(400).json({ error: 'A verification status of VERIFIED or REJECTED is required.' });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const verification = await tx.paymentVerification.findUnique({ where: { id: req.params.verificationId }, include: { invoice: { include: { project: true } } } });
      if (!verification || verification.invoiceId !== req.params.id) throw new Error('Payment verification not found.');
      if (!(await access(req.user!, verification.invoice.project))) throw new Error('You do not have permission to verify this payment.');
      if (verification.status !== PaymentVerificationStatus.PENDING) throw new Error('This payment verification has already been reviewed.');
      if (parsed.data.status === PaymentVerificationStatus.REJECTED) return tx.paymentVerification.update({ where: { id: verification.id }, data: { status: parsed.data.status, reviewedById: req.user!.id, reviewedAt: new Date() } });
      const invoice = verification.invoice;
      const balance = Number(invoice.balanceDue);
      if (Number(verification.amount) > balance) throw new Error('Payment verification exceeds the current invoice balance.');
      const paid = Number(invoice.paidAmount) + Number(verification.amount);
      await tx.payment.create({ data: { invoiceId: invoice.id, projectId: invoice.projectId, amount: verification.amount, paymentDate: new Date(), paymentMethod: PaymentMethod.UPI, transactionReference: verification.transactionReference, recordedById: req.user!.id } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount: paid, balanceDue: Math.max(0, Number(invoice.totalAmount) - paid), status: paid >= Number(invoice.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID } });
      return tx.paymentVerification.update({ where: { id: verification.id }, data: { status: parsed.data.status, reviewedById: req.user!.id, reviewedAt: new Date() } });
    });
    return res.json({ verification: { ...result, amount: Number(result.amount) } });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to review payment verification.' }); }
});

router.post('/:id/payments', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment.' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'You do not have permission to record payments.' });
  try {
    const payment = await prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { project: true } });
      if (!invoice) throw new Error('Invoice not found.');
      if (!(await access(req.user!, invoice.project))) throw new Error('You do not have permission to access this invoice.');
      const amount = parsed.data.amount; const balance = Number(invoice.balanceDue);
      if (amount > balance) throw new Error('Payment cannot exceed the invoice balance.');
      const paid = Number(invoice.paidAmount) + amount; const remaining = Number(invoice.totalAmount) - paid;
      const created = await tx.payment.create({ data: { invoiceId: invoice.id, projectId: invoice.projectId, amount, paymentDate: parseDate(parsed.data.paymentDate), paymentMethod: parsed.data.paymentMethod, transactionReference: parsed.data.transactionReference, notes: parsed.data.notes ?? null, recordedById: req.user!.id } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount: paid, balanceDue: Math.max(0, remaining), status: remaining <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID } });
      return created;
    });
    return res.status(201).json({ payment: { ...payment, amount: Number(payment.amount) } });
  } catch (e) { return res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to record payment.' }); }
});
export { router as invoicesRouter };
