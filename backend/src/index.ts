import { app } from './app';
import { env } from './config/env';
import { disconnectPrisma } from './lib/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`Morya backend listening on port ${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down backend.`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
