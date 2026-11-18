import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { budgetExpensesRouter } from './routes/budgetExpenses';
import { projectsRouter } from './routes/projects';
import { quotationsRouter } from './routes/quotations';
import { invoicesRouter } from './routes/invoices';
import { inventoryRouter } from './routes/inventory';
import { workforceRouter } from './routes/workforce';
import { milestonesRouter } from './routes/milestones';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/budget-expenses', budgetExpensesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/workforce', workforceRouter);
app.use('/api/milestones', milestonesRouter);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      service: 'morya-contractor-backend',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      database: 'unavailable',
      service: 'morya-contractor-backend',
      message: 'Database connectivity check failed.',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);
