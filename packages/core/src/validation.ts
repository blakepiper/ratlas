import { z } from 'zod';

// Set this before schemas are constructed: even a caught eval probe violates CSP.
if ('document' in globalThis) z.config({ jitless: true });
export { z };
