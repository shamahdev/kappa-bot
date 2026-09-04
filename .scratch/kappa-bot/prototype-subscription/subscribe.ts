// Throwaway prototype for wayfinder ticket 10 — NOT production code.
// Neon-backed `/jobs subscribe` handler: validates the `filters` JSON
// against the research-01 LinkedIn vocab, then upserts
// guilds → channels → subscriptions (ADR-0003).
// NOTE: uses drizzle neon-http (stateless). Production gateway will use
// the pg Pool per ADR-0001/research-04; the SQL shape is identical.

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { guilds, channels, subscriptions } from '../../../src/db/schema';

// Research-01 filter vocabulary (guest search params).
const ALLOWED_FILTER_KEYS = new Set([
  'f_TPR',
  'f_WT',
  'f_E',
  'f_JT',
  'f_SB2',
  'f_C',
  'f_AL',
  'f_EA',
  'f_VJ',
]);

export type SubscribeInput = {
  guildId: string;
  guildName: string;
  channelId: string;
  source: 'linkedin' | 'arbeitnow';
  keywords: string;
  location?: string;
  distance?: number;
  filtersRaw?: string; // raw JSON from the slash option
  createdBy: string;
};

function parseFilters(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`filters is not valid JSON: ${raw}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('filters must be a JSON object, e.g. {"f_TPR":"r86400"}');
  }
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) {
      throw new Error(`unknown filter key "${key}" (allowed: ${Array.from(ALLOWED_FILTER_KEYS).join(', ')})`);
    }
  }
  return parsed as Record<string, string>;
}

export async function handleSubscribe(input: SubscribeInput) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const db = drizzle(neon(process.env.DATABASE_URL));
  const filters = parseFilters(input.filtersRaw);

  await db.insert(guilds).values({ id: input.guildId, name: input.guildName }).onConflictDoNothing();
  await db
    .insert(channels)
    .values({ id: input.channelId, guildId: input.guildId })
    .onConflictDoNothing();

  const [row] = await db
    .insert(subscriptions)
    .values({
      guildId: input.guildId,
      channelId: input.channelId,
      keywords: input.keywords,
      location: input.location ?? null,
      distance: input.distance ?? null,
      filters,
      source: input.source,
      createdBy: input.createdBy,
    })
    .returning({ id: subscriptions.id });

  const [saved] = await db.select().from(subscriptions).where(eq(subscriptions.id, row.id));
  return saved;
}
