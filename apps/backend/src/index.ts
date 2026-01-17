/**
 * Entry point
 */

import 'dotenv/config';
import { buildServer } from './server.js';
import { loadConfig } from './config/index.js';

async function main() {
  try {
    const config = loadConfig();
    const server = await buildServer();

    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    console.log(`🧭 Pusula backend running at http://${config.server.host}:${config.server.port}`);

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
