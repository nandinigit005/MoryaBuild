import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from './app';
import { prisma } from './lib/prisma';

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created = { materials: [] as string[], workers: [] as string[], attendances: [] as string[], movements: [] as string[], milestones: [] as string[], projects: [] as string[], clients: [] as string[], users: [] as string[] };
const login = async (email = 'aniket.desai@moryaenterprises.com', password = 'MoryaAdmin@2026') =>
  (await request(app).post('/api/auth/login').send({ email, password })).body.token as string;

afterEach(async () => {
  if (created.attendances.length) await prisma.attendance.deleteMany({ where: { id: { in: created.attendances } } });
  if (created.movements.length) await prisma.inventoryMovement.deleteMany({ where: { id: { in: created.movements } } });
  if (created.milestones.length) await prisma.milestone.deleteMany({ where: { id: { in: created.milestones } } });
  if (created.materials.length) await prisma.material.deleteMany({ where: { id: { in: created.materials } } });
  if (created.workers.length) await prisma.worker.deleteMany({ where: { id: { in: created.workers } } });
  if (created.projects.length) await prisma.project.deleteMany({ where: { id: { in: created.projects } } });
  if (created.clients.length) await prisma.client.deleteMany({ where: { id: { in: created.clients } } });
  if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  Object.values(created).forEach((ids) => { ids.length = 0; });
});

describe('Inventory, workforce, and milestone APIs', () => {
  it('requires authentication and validates inventory and workforce payloads', async () => {
    expect((await request(app).get('/api/inventory/materials')).status).toBe(401);
    expect((await request(app).get('/api/workforce/workers')).status).toBe(401);
    expect((await request(app).get('/api/milestones')).status).toBe(401);
    const token = await login();
    expect((await request(app).post('/api/inventory/materials').set('Authorization', `Bearer ${token}`).send({ name: 'Missing code' })).status).toBe(400);
    expect((await request(app).post('/api/workforce/workers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Missing wage' })).status).toBe(400);
    expect((await request(app).post('/api/milestones').set('Authorization', `Bearer ${token}`).send({ name: 'Missing project' })).status).toBe(400);
  });

  it('persists stock movements and attendance with calculated values', async () => {
    const token = await login();
    const client = await prisma.client.create({ data: { name: `Inventory Test Client ${suffix()}`, email: `inventory-${suffix()}@example.com` } });
    created.clients.push(client.id);
    const project = await prisma.project.create({
      data: { projectCode: `INV-${suffix()}`, name: 'Inventory API test project', location: 'Pune', contractAmount: 100000, approvedBudget: 90000, plannedStartDate: new Date('2026-01-01'), expectedCompletionDate: new Date('2027-01-01'), clientId: client.id },
    });
    created.projects.push(project.id);

    const materialResponse = await request(app).post('/api/inventory/materials').set('Authorization', `Bearer ${token}`).send({
      code: `MAT-${suffix()}`, name: 'API test cement', category: 'Cement', unit: 'bags', currentStock: 10, minimumThreshold: 2, unitPrice: 400,
    });
    expect(materialResponse.status).toBe(201);
    const materialId = materialResponse.body.material.id as string;
    created.materials.push(materialId);

    const movementResponse = await request(app).post('/api/inventory/movements').set('Authorization', `Bearer ${token}`).send({
      materialId, projectId: project.id, movementType: 'PURCHASE_RECEIPT', quantity: 5, unitPrice: 410,
    });
    expect(movementResponse.status).toBe(201);
    created.movements.push(movementResponse.body.movement.id);
    expect(Number((await prisma.material.findUniqueOrThrow({ where: { id: materialId } })).currentStock)).toBe(15);

    const workerResponse = await request(app).post('/api/workforce/workers').set('Authorization', `Bearer ${token}`).send({
      employeeCode: `EMP-${suffix()}`, fullName: 'API Test Worker', tradeSkill: 'MASON', dailyWageRate: 1000, hourlyOvertimeRate: 150,
    });
    expect(workerResponse.status).toBe(201);
    const workerId = workerResponse.body.worker.id as string;
    created.workers.push(workerId);

    const attendanceResponse = await request(app).post('/api/workforce/attendance').set('Authorization', `Bearer ${token}`).send({
      workerId, projectId: project.id, date: '2026-10-28', status: 'OVERTIME', regularHours: 8, overtimeHours: 2,
    });
    expect(attendanceResponse.status).toBe(201);
    created.attendances.push(attendanceResponse.body.attendance.id);
    expect(Number((await prisma.attendance.findUniqueOrThrow({ where: { id: attendanceResponse.body.attendance.id } })).calculatedCost)).toBe(1300);
  });

  it('enforces client project authorization and permits approval only on its milestone', async () => {
    const adminToken = await login();
    const clientUser = await prisma.user.create({
      data: { email: `milestone-client-${suffix()}@example.com`, passwordHash: await bcrypt.hash('ClientPass123!', 10), name: 'Milestone Test Client', role: 'CLIENT', clientProfile: { create: { name: 'Milestone Test Client', email: `profile-${suffix()}@example.com` } } },
      include: { clientProfile: true },
    });
    created.users.push(clientUser.id);
    const project = await prisma.project.create({
      data: { projectCode: `MS-${suffix()}`, name: 'Milestone API test project', location: 'Mumbai', contractAmount: 200000, approvedBudget: 180000, plannedStartDate: new Date('2026-01-01'), expectedCompletionDate: new Date('2027-01-01'), clientId: clientUser.clientProfile!.id },
    });
    created.projects.push(project.id);
    created.clients.push(clientUser.clientProfile!.id);

    const invalid = await request(app).post('/api/milestones').set('Authorization', `Bearer ${adminToken}`).send({ projectId: project.id, name: 'Invalid dates', plannedStartDate: '2026-12-01', plannedEndDate: '2026-01-01' });
    expect(invalid.status).toBe(400);
    const create = await request(app).post('/api/milestones').set('Authorization', `Bearer ${adminToken}`).send({
      projectId: project.id, name: 'Foundation approval', description: 'API test milestone', plannedStartDate: '2026-01-01', plannedEndDate: '2026-06-01', progressPercentage: 100, status: 'SUBMITTED_FOR_APPROVAL',
    });
    expect(create.status).toBe(201);
    const milestoneId = create.body.milestone.id as string;
    created.milestones.push(milestoneId);

    const clientToken = await login(clientUser.email, 'ClientPass123!');
    expect((await request(app).post('/api/inventory/materials').set('Authorization', `Bearer ${clientToken}`).send({
      code: `CLIENT-${suffix()}`, name: 'Not allowed', unitPrice: 1,
    })).status).toBe(403);
    expect((await request(app).post('/api/milestones').set('Authorization', `Bearer ${clientToken}`).send({
      projectId: project.id, name: 'Not allowed', plannedStartDate: '2026-01-01', plannedEndDate: '2026-02-01',
    })).status).toBe(403);
    const approval = await request(app).post(`/api/milestones/${milestoneId}/approve`).set('Authorization', `Bearer ${clientToken}`).send({ comments: 'Approved by API test client' });
    expect(approval.status).toBe(200);
    const stored = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(stored.clientApprovalStatus).toBe('APPROVED');
    expect((await prisma.milestoneApprovalLog.count({ where: { milestoneId } }))).toBe(1);
  });
});
