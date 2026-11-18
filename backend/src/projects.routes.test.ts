import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './lib/prisma';
import { app } from './app';

const uniqueSuffix = () => `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const buildToken = async (email: string, password: string) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.body?.error || response.text}`);
  }

  return response.body.token as string;
};

describe('Project CRUD API', () => {
  const createdIds: string[] = [];
  const createdAssignmentUserIds: string[] = [];
  const createdAssignmentClientIds: string[] = [];

  beforeEach(async () => {
    createdIds.length = 0;
  });

  afterEach(async () => {
    for (const projectId of createdIds) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => undefined);
    }
    createdIds.length = 0;
    if (createdAssignmentUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdAssignmentUserIds } } });
      createdAssignmentUserIds.length = 0;
    }
    if (createdAssignmentClientIds.length) {
      await prisma.client.deleteMany({ where: { id: { in: createdAssignmentClientIds } } });
      createdAssignmentClientIds.length = 0;
    }
  });

  it('allows an admin to create a project and retrieve it', async () => {
    const adminToken = await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026');

    const client = await prisma.client.create({
      data: {
        name: `Alpha Client ${uniqueSuffix()}`,
        email: `alpha.${uniqueSuffix()}@example.com`,
        address: 'Pune',
      },
    });

    const createResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Alpha Tower Project',
        projectCode: `ALPHA-${uniqueSuffix()}`,
        description: 'A new high-rise tower project.',
        constructionType: 'COMMERCIAL',
        location: 'Kharadi, Pune',
        contractAmount: 2500000,
        approvedBudget: 2200000,
        plannedStartDate: '2026-01-01',
        expectedCompletionDate: '2027-01-01',
        status: 'PLANNING',
        progress: 12,
        clientId: client.id,
        projectManagerId: null,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.project).toMatchObject({
      name: 'Alpha Tower Project',
      clientName: client.name,
    });

    createdIds.push(createResponse.body.project.id);

    const listResponse = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects.some((project: any) => project.id === createResponse.body.project.id)).toBe(true);
    expect(listResponse.body.projects[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      projectCode: expect.any(String),
      name: expect.any(String),
      constructionType: expect.any(String),
      status: expect.any(String),
      contractAmount: expect.any(Number),
      approvedBudget: expect.any(Number),
    }));
  });

  it('prevents a client from accessing another client project', async () => {
    const adminToken = await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026');

    const clientA = await prisma.client.create({
      data: { name: `Client A ${uniqueSuffix()}`, email: `clienta.${uniqueSuffix()}@example.com`, address: 'Baner' },
    });
    const clientB = await prisma.client.create({
      data: { name: `Client B ${uniqueSuffix()}`, email: `clientb.${uniqueSuffix()}@example.com`, address: 'Kharadi' },
    });

    const clientUser = await prisma.user.create({
      data: {
        email: `client-b-${uniqueSuffix()}@example.com`,
        passwordHash: await bcrypt.hash('SecurePass123!', 10),
        name: 'Client B User',
        role: 'CLIENT',
        clientProfile: {
          create: {
            name: clientB.name,
            email: `client-b-profile-${uniqueSuffix()}@example.com`,
            address: clientB.address,
          },
        },
      },
    });

    const project = await prisma.project.create({
      data: {
        projectCode: `CLIENTA-${uniqueSuffix()}`,
        name: 'Confidential Client A Project',
        description: 'Should stay private',
        constructionType: 'COMMERCIAL',
        location: 'Pune',
        contractAmount: 1800000,
        approvedBudget: 1600000,
        plannedStartDate: new Date('2025-01-01'),
        expectedCompletionDate: new Date('2026-01-01'),
        status: 'IN_PROGRESS',
        progress: 50,
        clientId: clientA.id,
      },
    });
    createdIds.push(project.id);

    const clientToken = await buildToken(clientUser.email, 'SecurePass123!');

    const response = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/access/i);

    const listResponse = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects.some((item: any) => item.id === project.id)).toBe(false);
  });

  it('denies a client role from updating a project', async () => {
    const adminToken = await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026');

    const client = await prisma.client.create({
      data: {
        name: `Project Client ${uniqueSuffix()}`,
        email: `projectclient.${uniqueSuffix()}@example.com`,
        address: 'Mumbai',
      },
    });

    const clientUser = await prisma.user.create({
      data: {
        email: `clientuser.${uniqueSuffix()}@example.com`,
        passwordHash: await bcrypt.hash('ClientPass123!', 10),
        name: 'Client User',
        role: 'CLIENT',
        clientProfile: {
          create: {
            name: client.name,
            email: `client-project-profile-${uniqueSuffix()}@example.com`,
            address: client.address,
          },
        },
      },
    });

    const project = await prisma.project.create({
      data: {
        projectCode: `CLIENTUPD-${uniqueSuffix()}`,
        name: 'Client Editable Project',
        constructionType: 'RESIDENTIAL',
        location: 'Bandra, Mumbai',
        contractAmount: 2100000,
        approvedBudget: 1800000,
        plannedStartDate: new Date('2025-04-01'),
        expectedCompletionDate: new Date('2026-03-01'),
        status: 'PLANNING',
        progress: 5,
        clientId: client.id,
      },
    });
    createdIds.push(project.id);

    const clientToken = await buildToken(clientUser.email, 'ClientPass123!');

    const updateResponse = await request(app)
      .put(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        name: 'Hacked Project Name',
      });

    expect(updateResponse.status).toBe(403);
    expect(updateResponse.body.error).toMatch(/permission/i);

    const adminProjectCheck = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminProjectCheck.status).toBe(200);
    expect(adminProjectCheck.body.project.name).toBe('Client Editable Project');
  });

  it('limits a project manager to explicitly assigned projects', async () => {
    const managerToken = await buildToken('sachin.more@moryaenterprises.com', 'MoryaAdmin@2026');
    const manager = await prisma.user.findUniqueOrThrow({ where: { email: 'sachin.more@moryaenterprises.com' }, select: { id: true } });
    const otherManager = await prisma.user.findUniqueOrThrow({ where: { email: 'nikhil.jagtap@moryaenterprises.com' }, select: { id: true } });
    const client = await prisma.client.findFirstOrThrow();
    const assignedProject = await prisma.project.create({
      data: {
        projectCode: `PM-ASSIGNED-${uniqueSuffix()}`,
        name: 'Assigned manager test project',
        location: 'Pune',
        contractAmount: 100000,
        approvedBudget: 90000,
        plannedStartDate: new Date('2026-01-01'),
        expectedCompletionDate: new Date('2027-01-01'),
        clientId: client.id,
        projectManagerId: manager.id,
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        projectCode: `PM-OTHER-${uniqueSuffix()}`,
        name: 'Other manager test project',
        location: 'Mumbai',
        contractAmount: 100000,
        approvedBudget: 90000,
        plannedStartDate: new Date('2026-01-01'),
        expectedCompletionDate: new Date('2027-01-01'),
        clientId: client.id,
        projectManagerId: otherManager.id,
      },
    });
    createdIds.push(assignedProject.id, otherProject.id);

    const listResponse = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.projects.some((project: any) => project.id === assignedProject.id)).toBe(true);
    expect(listResponse.body.projects.some((project: any) => project.id === otherProject.id)).toBe(false);

    const detailResponse = await request(app)
      .get(`/api/projects/${otherProject.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(detailResponse.status).toBe(403);
  });

  it('allows only an admin to assign an existing project to a client account', async () => {
    const adminToken = await buildToken('aniket.desai@moryaenterprises.com', 'MoryaAdmin@2026');
    const client = await prisma.client.create({
      data: {
        name: `Assignment Client ${uniqueSuffix()}`,
        email: `assignment-client-${uniqueSuffix()}@example.com`,
      },
    });
    createdAssignmentClientIds.push(client.id);
    const clientUser = await prisma.user.create({
      data: {
        email: `assignment-user-${uniqueSuffix()}@example.com`,
        passwordHash: await bcrypt.hash('ClientPass123!', 10),
        name: 'Assignment Client User',
        role: 'CLIENT',
        clientProfile: { connect: { id: client.id } },
      },
    });
    createdAssignmentUserIds.push(clientUser.id);
    const sourceClient = await prisma.client.findFirstOrThrow({ where: { id: { not: client.id } } });
    const project = await prisma.project.create({
      data: {
        projectCode: `CLIENT-ASSIGN-${uniqueSuffix()}`,
        name: 'Existing project assignment test',
        location: 'Pune',
        contractAmount: 100000,
        approvedBudget: 90000,
        plannedStartDate: new Date('2026-01-01'),
        expectedCompletionDate: new Date('2027-01-01'),
        clientId: sourceClient.id,
      },
    });
    createdIds.push(project.id);

    const clientToken = await buildToken(clientUser.email, 'ClientPass123!');
    const unauthorized = await request(app)
      .patch(`/api/projects/${project.id}/client`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ clientId: client.id });
    expect(unauthorized.status).toBe(403);

    const assignment = await request(app)
      .patch(`/api/projects/${project.id}/client`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: client.id });
    expect(assignment.status).toBe(200);
    expect(assignment.body.project.clientId).toBe(client.id);

    const clientProjects = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientProjects.status).toBe(200);
    expect(clientProjects.body.projects.some((item: any) => item.id === project.id)).toBe(true);
  });
});
