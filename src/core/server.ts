import { Elysia } from 'elysia';
import { renderMetrics } from './metrics';
import type { FeatureRegistry } from './registry';

export function createServer(registry: FeatureRegistry) {
  const app = new Elysia()
    .get('/health', () => ({ ok: true, uptime: process.uptime(), features: registry.names() }))
    .get('/metrics', () => renderMetrics());
  for (const feature of registry.all()) feature.server?.(app);
  return app;
}

export type AppServer = ReturnType<typeof createServer>;
