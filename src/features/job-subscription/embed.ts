// Production job embed renderer: clean, direct source JobPosting display without AI.
import { EmbedBuilder } from 'discord.js';
import type { Logger } from '../../core/logger';
import { fetchJobPostingDetail } from './adapter';
import { withAiSummary } from './ai';
import type { JobDetail, JobPosting } from './types';

const FALLBACK_COLOR = 0x3f6b55;
const MAX_DESC = 3500; // embed description cap is 4096; leave headroom

export function formatSourceName(source?: string): string {
  if (!source) return 'LinkedIn';
  const lower = source.toLowerCase();
  if (lower === 'techinasia') return 'Tech in Asia';
  if (lower === 'kalibrr') return 'Kalibrr';
  if (lower === 'linkedin') return 'LinkedIn';
  if (lower === 'glints') return 'Glints';
  if (lower === 'indeed') return 'Indeed';
  if (lower === 'jobstreet') return 'Jobstreet';
  if (lower === 'all') return 'All Sources';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatFooterText(keyword?: string | null, source?: string): string {
  const sourceName = formatSourceName(source);
  const kw = keyword?.trim();
  if (kw) {
    return `'${kw}' keyword in '${sourceName}'`;
  }
  return `'all' keyword in '${sourceName}'`;
}

export function formatDeliveryTitle(
  count: number,
  keyword?: string | null,
  source?: string,
): string {
  const kw = keyword?.trim() || 'all';
  const sourceName = formatSourceName(source);
  const jobWord = count === 1 ? '1 new job' : `${count} new jobs`;
  return `${jobWord} - '${kw}' - '${sourceName}'`;
}

export function embedForJobPosting(
  job: JobPosting,
  detail?: JobDetail | null,
  keyword?: string | null,
): EmbedBuilder {
  const headline = `${job.position} @ ${job.company}`.replace(/[\[\]]/g, '');
  const embed = new EmbedBuilder()
    .setColor(FALLBACK_COLOR)
    .setTitle(headline.length > MAX_TITLE ? `${headline.slice(0, MAX_TITLE)}…` : headline)
    .setURL(job.url)
    .addFields(
      { name: 'Location', value: job.location || '—', inline: true },
      { name: 'Posted', value: job.agoTime || 'recently', inline: true },
    )
    .setFooter({ text: formatFooterText(keyword, job.source) });

  if (job.logo) embed.setThumbnail(job.logo);

  const salary = detail?.salary ?? job.salary;
  if (salary) {
    embed.addFields({ name: 'Salary', value: salary, inline: true });
  }

  const rawDesc = detail?.description ?? null;
  if (rawDesc) {
    embed.setDescription(formatCardDescription(rawDesc));
  }

  return embed;
}

/**
 * Single rich card for one JobPosting: enriches via detail + AI summary,
 * falling back to the unenriched card when detail fails. Shared by the poll
 * single-delivery, reply-by-number, and latest-JobPosting paths so the
 * search → detail → summary → render chain lives in exactly one module.
 */
export async function renderJobPostingCard(
  log: Logger,
  job: JobPosting,
  keyword?: string | null,
): Promise<EmbedBuilder> {
  let detail: JobDetail | null = null;
  try {
    detail = await withAiSummary(job, await fetchJobPostingDetail(job));
  } catch (e) {
    log.warn({ feature: 'job-subscription', job: job.id, err: e }, 'detail failed (card-only)');
  }
  return embedForJobPosting(job, detail, keyword);
}

/**
 * Discord-safe card body: normalized line breaks, no trailing whitespace,
 * no mid-word cut — truncates at the last break before the cap.
 */
export function formatCardDescription(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= MAX_DESC) return text;
  const lineBreak = text.lastIndexOf('\n', MAX_DESC);
  const space = text.lastIndexOf(' ', MAX_DESC);
  const cut = lineBreak > MAX_DESC * 0.5 ? lineBreak : space;
  const end = cut > 0 ? cut : MAX_DESC;
  return `${text.slice(0, end).trimEnd()}…\n\n*(full description at the title link)*`;
}

/** One enriched posting queued for delivery. */
export type DeliveryItem = {
  job: JobPosting;
  detail?: JobDetail | null;
};

const MAX_TITLE = 250; // Discord title cap is 256

function listedAt(job: JobPosting): number {
  if (!job.datetime) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(job.datetime);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** Newest JobPosting first; undated postings keep their relative order at the end. */
export function sortNewestFirst(items: DeliveryItem[]): DeliveryItem[] {
  return [...items].sort((a, b) => listedAt(b.job) - listedAt(a.job));
}

/**
 * One delivery line per JobPosting: "1. Position @ Company".
 */
export function deliveryEntry(item: DeliveryItem, index: number): string {
  const { job } = item;
  const title = `${job.position} @ ${job.company}`.replace(/[\[\]]/g, '');
  const link = job.url ? `[${title}](${job.url})` : title;
  return `${index + 1}. ${link}`;
}

const MAX_SOURCE_ITEMS = 20; // embed list cap per source

/** Reply hint with the actual number range shown on this embed (e.g. 1-5, 9-13). */
function replyHint(start: number, count: number): string {
  const range = count === 1 ? `${start + 1}` : `${start + 1}-${start + count}`;
  return `Reply with ${range} to get the summary of the job`;
}

/** Source list title: "🚨 20 new 'frontend' jobs found in LinkedIn". */
export function formatSourceTitle(
  count: number,
  keyword?: string | null,
  source?: string,
): string {
  const kw = keyword?.trim() || 'all';
  const jobWord = count === 1 ? 'job' : 'jobs';
  return `🚨 ${count} new '${kw}' ${jobWord} found in ${formatSourceName(source)}`;
}

export type SourceGroup = { source: string; items: DeliveryItem[] };

/** Display order: newest first, grouped by source (first-seen order), 20 cap each. */
export function groupDeliveryItems(items: DeliveryItem[]): SourceGroup[] {
  const groups = new Map<string, DeliveryItem[]>();
  for (const item of sortNewestFirst(items)) {
    const key = item.job.source || 'linkedin';
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([source, group]) => ({ source, items: group.slice(0, MAX_SOURCE_ITEMS) }));
}

/** Flat display order — entry N on screen is index N-1 here. */
export function flattenDeliveryItems(items: DeliveryItem[]): DeliveryItem[] {
  return groupDeliveryItems(items).flatMap((g) => g.items);
}

/** One list embed per source: up to 20 latest, newest first, reply-hint footer. */
export function embedsForDelivery(
  header: string | undefined,
  items: DeliveryItem[],
  keyword?: string | null,
): EmbedBuilder[] {
  void header; // per-source titles carry count + keyword; the rollup header is unused
  const groups = groupDeliveryItems(items);
  if (groups.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(FALLBACK_COLOR)
        .setTitle(formatSourceTitle(0, keyword))
        .setDescription('No new jobs.'),
    ];
  }
  let offset = 0; // numbering runs continuously across source embeds
  return groups.map(({ source, items: group }) => {
    const start = offset;
    offset += group.length;
    let text = group.map((item, i) => deliveryEntry(item, start + i)).join('\n').trim();
    if (text.length > MAX_DESC) text = `${text.slice(0, MAX_DESC)}…`;
    const title = formatSourceTitle(group.length, keyword, source);
    return new EmbedBuilder()
      .setColor(FALLBACK_COLOR)
      .setTitle(title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE)}…` : title)
      .setDescription(text || 'No new jobs.')
      .setFooter({ text: replyHint(start, group.length) });
  });
}
