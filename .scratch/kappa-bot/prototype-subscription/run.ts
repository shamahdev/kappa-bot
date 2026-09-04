// Throwaway prototype for wayfinder ticket 10 — NOT production code.
//
// End-to-end stub of the subscription flow against the REAL Neon schema:
//   mock /jobs subscribe interaction → handleSubscribe (Neon write) →
//   deliverIfNew dedup demo (ADR-0004 insert-first) → mock embed JSON →
//   cleanup (so the production branch is left empty).
//
// Prints no secrets — only ids, counts, and Discord JSON payloads.
// Usage: bun .scratch/kappa-bot/prototype-subscription/run.ts

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { guilds, channels, subscriptions, seenJobs } from '../../../src/db/schema';
import { handleSubscribe } from './subscribe';
import { embedForJob } from './embed';
import { MOCK_JOBS } from './mock-jobs';

// Obviously-fake snowflakes; deleted at the end of the run.
const TEST_GUILD = '999999999999999901';
const TEST_CHANNEL = '999999999999999902';

async function deliverIfNew(subscriptionId: number, source: string, job: { id: string; url: string }) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const db = drizzle(neon(process.env.DATABASE_URL));
  const inserted = await db
    .insert(seenJobs)
    .values({ subscriptionId, source, externalId: job.id, url: job.url })
    .onConflictDoNothing()
    .returning({ id: seenJobs.id });
  return inserted.length > 0; // true = new → channel.send; false = already seen → skip
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const db = drizzle(neon(process.env.DATABASE_URL));

  // 1. Mock interaction: /jobs subscribe source:linkedin keywords:"backend junior"
  //    location:"United States" filters:{"f_TPR":"r86400","f_E":"2"}
  const saved = await handleSubscribe({
    guildId: TEST_GUILD,
    guildName: 'Prototype Guild',
    channelId: TEST_CHANNEL,
    source: 'linkedin',
    keywords: 'backend junior',
    location: 'United States',
    filtersRaw: '{"f_TPR":"r86400","f_E":"2"}',
    createdBy: '999999999999999903',
  });
  console.log(
    `subscribe ok: id=${saved.id} source=${saved.source} keywords=${saved.keywords} ` +
      `location=${saved.location} filters=${JSON.stringify(saved.filters)}`,
  );

  // 1b. Invalid filters are rejected with a readable error (no row written).
  try {
    await handleSubscribe({
      guildId: TEST_GUILD,
      guildName: 'Prototype Guild',
      channelId: TEST_CHANNEL,
      source: 'linkedin',
      keywords: 'x',
      filtersRaw: '{"f_BOGUS":"1"}',
      createdBy: '999999999999999903',
    });
    console.log('filter validation: FAILED (bogus key accepted)');
  } catch (e) {
    console.log(`filter validation ok: ${(e as Error).message}`);
  }

  // 2. Dedup demo (ADR-0004 insert-first): first delivery sends, retry skips.
  const job = MOCK_JOBS[0];
  const first = await deliverIfNew(saved.id, 'linkedin', job);
  const retry = await deliverIfNew(saved.id, 'linkedin', job);
  console.log(`deliverIfNew: first=${first} (would send), retry=${retry} (skipped as seen)`);

  // 3. Rendered Discord payload for the same job.
  console.log(`embed: ${JSON.stringify(embedForJob(job).toJSON())}`);

  // 4. Cleanup: subscription (cascades seen_jobs) → channel → guild.
  await db.delete(subscriptions).where(eq(subscriptions.id, saved.id));
  await db.delete(channels).where(eq(channels.id, TEST_CHANNEL));
  await db.delete(guilds).where(eq(guilds.id, TEST_GUILD));
  const remaining = await db.select({ id: subscriptions.id }).from(subscriptions);
  console.log(`cleanup ok: subscriptions remaining=${remaining.length}`);
}

main().catch((e) => {
  console.error(`prototype failed: ${(e as Error).message}`);
  process.exit(1);
});
