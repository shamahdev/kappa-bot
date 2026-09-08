// Reply-by-number on delivery messages: replying "3" to a bot delivery shows
// the single-card detail for entry #3. Wired as a feature `messageCreate`
// event (gateway only — needs GuildMessages + MessageContent intents).
// Deliveries live in `delivery_messages` (survives restarts, eviction, and
// worker polls); a bounded in-memory map fronts it as an L1 cache. Numbers
// resolve against the exact display order (flattenDeliveryItems), newest first.
import { eq } from 'drizzle-orm';
import type { FeatureContext } from '../../../core/feature';
import { flattenDeliveryItems, renderJobPostingCard, type DeliveryItem } from '../embed';
import { deliveryMessages } from '../schema';

const MAX_STORED = 200; // recent deliveries; oldest evicted first

const deliveries = new Map<string, { items: DeliveryItem[]; keyword: string | null }>();

type StoredDelivery = { items: DeliveryItem[]; keyword: string | null };

/** Persist a delivered batch (memory first, DB write-through; never throws). */
export async function recordDelivery(
  ctx: FeatureContext,
  channelId: string,
  messageId: string,
  items: DeliveryItem[],
  keyword?: string | null,
): Promise<void> {
  const flat = flattenDeliveryItems(items);
  const entry: StoredDelivery = { items: flat, keyword: keyword ?? null };
  deliveries.set(messageId, entry);
  if (deliveries.size > MAX_STORED) {
    const oldest = deliveries.keys().next();
    if (!oldest.done) deliveries.delete(oldest.value);
  }
  try {
    await ctx.db
      .insert(deliveryMessages)
      .values({
        messageId,
        channelId,
        jobs: flat.map((i) => i.job),
        keyword: keyword ?? null,
      })
      .onConflictDoUpdate({
        target: deliveryMessages.messageId,
        set: {
          channelId,
          jobs: flat.map((i) => i.job),
          keyword: keyword ?? null,
          createdAt: new Date(),
        },
      });
  } catch (e) {
    ctx.log.warn({ feature: 'job-subscription', messageId, err: e }, 'delivery persist failed (memory only)');
  }
}

async function loadDelivery(ctx: FeatureContext, messageId: string): Promise<StoredDelivery | null> {
  const hit = deliveries.get(messageId);
  if (hit) return hit;
  try {
    const [row] = await ctx.db
      .select()
      .from(deliveryMessages)
      .where(eq(deliveryMessages.messageId, messageId));
    if (!row) return null;
    const entry: StoredDelivery = {
      items: row.jobs.map((job) => ({ job })),
      keyword: row.keyword ?? null,
    };
    deliveries.set(messageId, entry);
    if (deliveries.size > MAX_STORED) {
      const oldest = deliveries.keys().next();
      if (!oldest.done) deliveries.delete(oldest.value);
    }
    return entry;
  } catch (e) {
    ctx.log.warn({ feature: 'job-subscription', messageId, err: e }, 'delivery load failed');
    return null;
  }
}

type ReplyMessage = {
  author?: { bot?: boolean } | null;
  reference?: { messageId?: string | null } | null;
  content?: unknown;
  reply: (payload: unknown) => Promise<unknown>;
};

function asReplyMessage(interaction: unknown): ReplyMessage | null {
  if (typeof interaction !== 'object' || interaction === null) return null;
  const msg = interaction as Partial<ReplyMessage> & { reply?: unknown };
  if (typeof msg.reply !== 'function') return null;
  if (typeof msg.content !== 'string') return null;
  return msg as ReplyMessage;
}

export async function onMessage(ctx: FeatureContext, interaction: unknown): Promise<void> {
  const msg = asReplyMessage(interaction);
  if (!msg || msg.author?.bot) return;
  const refId = msg.reference?.messageId;
  if (!refId) return;
  const text = (msg.content as string).trim();
  if (!/^\d+$/.test(text)) return;
  const delivery = await loadDelivery(ctx, refId);
  if (!delivery) return;
  const n = Number(text);
  if (n < 1 || n > delivery.items.length) return;

  const job = delivery.items[n - 1]!.job;
  try {
    await msg.reply({ embeds: [(await renderJobPostingCard(ctx.log, job, delivery.keyword)).toJSON()] });
  } catch (e) {
    ctx.log.warn({ feature: 'job-subscription', job: job.id, err: e }, 'reply detail failed');
    try {
      await msg.reply("Couldn't load that JobPosting right now.");
    } catch {
      // best effort on a read path
    }
  }
}
