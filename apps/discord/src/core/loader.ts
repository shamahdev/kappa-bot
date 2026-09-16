import { Glob } from 'bun';
import { fileURLToPath } from 'node:url';
import type { Feature } from './feature';

/** Auto-discovers src/features/*\/index.ts (default export must be a Feature). */
export async function loadFeatures(): Promise<Feature[]> {
  const dir = fileURLToPath(new URL('../features/', import.meta.url));
  const glob = new Glob('*/index.ts');
  const features: Feature[] = [];
  for await (const rel of glob.scan({ cwd: dir, absolute: true })) {
    const mod = (await import(rel)) as { default?: Feature };
    if (!mod.default || typeof mod.default !== 'object' || !('name' in mod.default)) {
      throw new Error(`feature at ${rel} has no default Feature export`);
    }
    features.push(mod.default as Feature);
  }
  features.sort((a, b) => a.name.localeCompare(b.name));
  return features;
}
