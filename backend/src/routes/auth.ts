import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth, signToken } from '../middleware/auth';

const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long.').max(120),
  email: z.string().trim().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128),
  phone: z.string().trim().max(30).optional(),
  clientName: z.string().trim().min(2).max(200).optional(),
});

const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  phone: user.phone,
  avatar: user.avatar,
  isActive: user.isActive,
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Invalid login payload.',
    });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      avatar: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return res.status(200).json({
    token,
    expiresIn: env.JWT_EXPIRES_IN,
    user: sanitizeUser(user),
  });
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration payload.' });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (existingUser) {
        throw new Error('An account with this email already exists.');
      }

      const existingClient = await tx.client.findUnique({ where: { email: normalizedEmail }, select: { id: true, userId: true } });
      if (existingClient?.userId) {
        throw new Error('An account with this email already exists.');
      }

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: await bcrypt.hash(parsed.data.password, 12),
          name: parsed.data.name,
          phone: parsed.data.phone,
          role: Role.CLIENT,
        },
        select: { id: true, email: true, name: true, role: true, phone: true, avatar: true, isActive: true },
      });

      if (existingClient) {
        await tx.client.update({
          where: { id: existingClient.id },
          data: { userId: user.id, name: parsed.data.clientName ?? parsed.data.name, phone: parsed.data.phone },
        });
      } else {
        await tx.client.create({
          data: { userId: user.id, name: parsed.data.clientName ?? parsed.data.name, email: normalizedEmail, phone: parsed.data.phone },
        });
      }

      return user;
    });

    const token = signToken({ id: result.id, email: result.email, name: result.name, role: result.role });
    return res.status(201).json({ token, expiresIn: env.JWT_EXPIRES_IN, user: sanitizeUser(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register account.';
    return res.status(message.includes('already exists') ? 409 : 400).json({ error: message });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      avatar: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User not found or inactive.' });
  }

  return res.status(200).json({ user: sanitizeUser(user) });
});

export { authRouter };
