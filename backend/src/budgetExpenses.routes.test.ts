import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from './app';
import { prisma } from './lib/prisma';

const uniqueSuffix = () => `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const buildToken = async (email: string, password: string) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.body?.error || response.text}`);
  }
  return response.body.token as string;
};

describe('Budget & Expenses API', () => {
  const createdExpenseIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];

  beforeEach(() => {
    createdExpenseIds.length = 0;
    createdUserIds.length = 0;
    createdClientIds.length = 0;
  });

  afterEach(async () => {
    if (createdExpenseIds.length) {
      await prisma.expense.deleteMany({ where: { id: { in: createdExpenseIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdClientIds.length) {
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    }
  });

  it('creates, lists, updates, summarizes, and deletes an expense in MySQL', async () => {
    const adminToken = await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026');
    const project = await prisma.project.findFirstOrThrow({ orderBy: { projectCode: 'asc' } });
    const baselineSummaryResponse = await request(app)
      .get(`/api/budget-expenses/summary?projectId=${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const baselineSummary = baselineSummaryResponse.body.summary;

    const createResponse = await request(app)
      .post('/api/budget-expenses/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: project.id,
        title: 'RCC cement and reinforcement steel',
        category: 'MATERIALS',
        amount: 185000,
        date: '2026-10-28',
        vendor: 'Shree Buildmart Supplies',
        paymentStatus: 'Pending',
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.expense).toMatchObject({
      projectId: project.id,
      projectCode: project.projectCode,
      title: 'RCC cement and reinforcement steel',
      category: 'MATERIALS',
      amount: 185000,
      paymentStatus: 'Pending',
    });

    const expenseId = createResponse.body.expense.id as string;
    createdExpenseIds.push(expenseId);

    const listResponse = await request(app)
      .get(`/api/budget-expenses/expenses?projectId=${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.expenses.some((expense: { id: string }) => expense.id === expenseId)).toBe(true);

    const summaryResponse = await request(app)
      .get(`/api/budget-expenses/summary?projectId=${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.summary).toMatchObject({
      totalBudget: Number(project.approvedBudget),
      totalExpenses: baselineSummary.totalExpenses + 185000,
      pendingPayments: baselineSummary.pendingPayments + 185000,
    });

    const updateResponse = await request(app)
      .put(`/api/budget-expenses/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: project.id,
        title: 'Paid RCC material invoice',
        category: 'MATERIALS',
        amount: 200000,
        date: '2026-10-28',
        vendor: 'Shree Buildmart Supplies',
        paymentStatus: 'Paid',
        paymentMethod: 'UPI',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.expense).toMatchObject({ amount: 200000, paymentStatus: 'Paid' });

    const deleteResponse = await request(app)
      .delete(`/api/budget-expenses/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(await prisma.expense.findUnique({ where: { id: expenseId } })).toBeNull();
  });

  it('rejects invalid input and unauthenticated requests', async () => {
    const invalidResponse = await request(app)
      .post('/api/budget-expenses/expenses')
      .set('Authorization', `Bearer ${await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026')}`)
      .send({ title: '', amount: -1 });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toMatch(/required|greater|valid/i);

    const unauthenticatedResponse = await request(app).get('/api/budget-expenses/expenses');
    expect(unauthenticatedResponse.status).toBe(401);
  });

  it('denies a client from creating an expense for an unrelated project', async () => {
    const project = await prisma.project.findFirstOrThrow({ orderBy: { projectCode: 'asc' } });
    const client = await prisma.client.create({
      data: {
        name: `Expense Test Client ${uniqueSuffix()}`,
        email: `expense-test-client-${uniqueSuffix()}@example.com`,
        address: 'Pune',
      },
    });
    createdClientIds.push(client.id);

    const clientUser = await prisma.user.create({
      data: {
        email: `expense-client-user-${uniqueSuffix()}@example.com`,
        passwordHash: await bcrypt.hash('ClientPass123!', 10),
        name: 'Expense Test Client User',
        role: 'CLIENT',
        clientProfile: { connect: { id: client.id } },
      },
    });
    createdUserIds.push(clientUser.id);

    const clientToken = await buildToken(clientUser.email, 'ClientPass123!');
    const response = await request(app)
      .post('/api/budget-expenses/expenses')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        projectId: project.id,
        title: 'Unauthorized expense',
        category: 'MATERIALS',
        amount: 1000,
        date: '2026-10-28',
        vendor: 'Unauthorized Vendor',
        paymentStatus: 'Pending',
        paymentMethod: 'CASH',
      });

    expect(response.status).toBe(403);
    expect(await prisma.expense.count({ where: { description: 'Unauthorized expense' } })).toBe(0);
  });
});
