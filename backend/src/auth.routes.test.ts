import request from 'supertest';
import { afterEach, describe, it, expect } from 'vitest';
import { app } from './app';
import { prisma } from './lib/prisma';

const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe('Auth API', () => {
  it('rejects invalid credentials with 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aniket.desai@moryaenterprises.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('issues a JWT for a valid seeded admin user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aniket.desai@moryaenterprises.com', password: 'MoryaAdmin@2026' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toMatchObject({
      email: 'aniket.desai@moryaenterprises.com',
      role: 'ADMIN',
    });
  });

  it('registers a client account without accepting an elevated role', async () => {
    const email = `auth-test-${Date.now()}@example.com`;
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Auth Test Client', email, password: 'SecureClient123!', role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email, role: 'CLIENT' });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    createdUserIds.push(response.body.user.id);
  });

  it('rejects unauthenticated and invalid-token protected requests', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401);
    expect((await request(app).get('/api/projects').set('Authorization', 'Bearer invalid-token')).status).toBe(401);
  });

  it('validates the current database-backed session through /me', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aniket.desai@moryaenterprises.com', password: 'MoryaAdmin@2026' });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: login.body.user.id, role: 'ADMIN' });
  });
});
