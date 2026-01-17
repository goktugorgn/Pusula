/**
 * Pusula Backend Entry Point
 * 
 * Node.js backend for Unbound DNS management on Raspberry Pi
 */

import 'dotenv/config';
import { buildServer, startServer } from './server.js';

async function main(): Promise<void> {
  console.log('🧭 Starting Pusula backend...');

  try {
    const fastify = await buildServer();
    await startServer(fastify);

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await fastify.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
