import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from './app';
import { prisma } from './lib/prisma';

const created: { quotations: string[]; invoices: string[] } = { quotations: [], invoices: [] };
const login = async () => (await request(app).post('/api/auth/login').send({ email: 'aniket.desai@moryaenterprises.com', password: 'MoryaAdmin@2026' })).body.token as string;
const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

afterEach(async () => {
  if (created.quotations.length) await prisma.quotation.deleteMany({ where: { id: { in: created.quotations } } });
  if (created.invoices.length) await prisma.invoice.deleteMany({ where: { id: { in: created.invoices } } });
  created.quotations.length = 0; created.invoices.length = 0;
});

describe('Quotations and invoices API', () => {
  it('requires authentication and validates payloads', async () => {
    expect((await request(app).get('/api/quotations')).status).toBe(401);
    const token = await login();
    const response = await request(app).post('/api/quotations').set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(400);
  });

  it('calculates quotation totals and persists invoice payments', async () => {
    const token = await login();
    const project = await prisma.project.findFirstOrThrow({ orderBy: { projectCode: 'asc' }, select: { id: true, clientId: true } });
    const quotation = await request(app).post('/api/quotations').set('Authorization', `Bearer ${token}`).send({
      quotationNumber: `QT-${suffix()}`, clientId: project.clientId, title: 'API test quotation', taxRate: 10, discountAmount: 10,
      validityDate: '2030-01-01', items: [{ description: 'Testing', quantity: 2, unitRate: 100 }],
    });
    expect(quotation.status).toBe(201);
    expect(quotation.body.quotation).toMatchObject({ subtotal: 200, taxAmount: 19, totalAmount: 209 });
    created.quotations.push(quotation.body.quotation.id);

    const invoice = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({
      invoiceNumber: `INV-${suffix()}`, projectId: project.id, issueDate: '2026-01-01', dueDate: '2030-01-01',
      taxRate: 0, items: [{ description: 'Testing', quantity: 1, unitPrice: 100 }],
    });
    expect(invoice.status).toBe(201);
    created.invoices.push(invoice.body.invoice.id);
    const payment = await request(app).post(`/api/invoices/${invoice.body.invoice.id}/payments`).set('Authorization', `Bearer ${token}`).send({ amount: 40, paymentDate: '2026-01-02', paymentMethod: 'UPI' });
    expect(payment.status).toBe(201);
    const stored = await prisma.invoice.findUnique({ where: { id: invoice.body.invoice.id } });
    expect(Number(stored?.paidAmount)).toBe(40);
    expect(Number(stored?.balanceDue)).toBe(60);
    expect(stored?.status).toBe('PARTIALLY_PAID');
  });
});
