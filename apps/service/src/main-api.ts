import { createApi } from './api/server.js';
import { configArguments, loadConfig } from './commands/config.js';

const config = loadConfig(configArguments().config);
const app = await createApi(config, {
  production: process.env.NODE_ENV === 'production',
  logger: true,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
await app.listen({ host: config.server.host, port: config.server.port });
