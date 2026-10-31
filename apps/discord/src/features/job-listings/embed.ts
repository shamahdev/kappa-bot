import {
  jobSourceName,
  MATCH_FACTORS,
  MATCH_GRADE_LABELS,
} from "@kappa/contracts";
import type {
  EnrichedJobPosting,
  JobDetail,
  JobMatch,
  JobPosting,
} from "@kappa/service/job-listings";
import { EmbedBuilder } from "discord.js";
import type { APIEmbed } from "discord.js";

import type { MessagePayload } from "../../core/feature";

const FALLBACK_COLOR = 0x3f_6b_55;
// Discord embed limits. The existing list capacity applies to each page, not a source's total.
const MAX_DESCRIPTION = 4096;
const MAX_TITLE = 256;
const MAX_FIELD = 1024;
const MAX_FOOTER = 2048;
const MAX_EMBED_TEXT = 6000;
const SOURCE_PAGE_CAPACITY = 20;

const truncate = (text: string, length: number): string => {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
};

export const formatSourceName = (source = "linkedin"): string =>
  jobSourceName(source);

export const formatFooterText = (
  keyword?: string | null,
  source?: string
): string =>
  `'${keyword?.trim() || "all"}' keyword in '${formatSourceName(source)}'`;

/** Normalize source text, preserving paragraph breaks and the title link for the full description. */
export const formatCardDescription = (
  raw: string,
  limit = MAX_DESCRIPTION
): string => {
  const text = raw
    .replaceAll(/\r\n?/gu, "\n")
    .replaceAll(/[ \t]+$/gmu, "")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
  if (text.length <= limit) {
    return text;
  }
  const suffix = "…\n\n*(full description at the title link)*";
  if (limit <= suffix.length) {
    return truncate(text, limit);
  }
  const budget = limit - suffix.length;
  const lineBreak = text.lastIndexOf("\n", budget);
  const space = text.lastIndexOf(" ", budget);
  const cut = lineBreak > budget / 2 ? lineBreak : space;
  return `${text.slice(0, cut > 0 ? cut : budget).trimEnd()}${suffix}`;
};

/** Pure rendering: enrichment and matching belong to the application, never the view. */
export const embedForJobPosting = (
  job: JobPosting,
  detail?: JobDetail | null,
  keyword?: string | null,
  match?: JobMatch | null
): EmbedBuilder => {
  const title = truncate(
    `${job.position} @ ${job.company}`.replaceAll(/[[\]]/gu, ""),
    MAX_TITLE
  );
  const footer = truncate(formatFooterText(keyword, job.source), MAX_FOOTER);
  const fields = [
    {
      inline: true,
      name: "Location",
      value: truncate(job.location || "—", MAX_FIELD),
    },
    {
      inline: true,
      name: "Posted",
      value: truncate(job.agoTime || "recently", MAX_FIELD),
    },
  ];
  const salary = detail?.salary ?? job.salary;
  if (salary) {
    fields.push({
      inline: true,
      name: "Salary",
      value: truncate(salary, MAX_FIELD),
    });
  }
  if (match) {
    fields.push({
      inline: false,
      name: "Match",
      value: truncate(
        `${match.grade} — ${MATCH_GRADE_LABELS[match.grade]}`,
        MAX_FIELD
      ),
    });
    for (const factor of MATCH_FACTORS) {
      const assessment = match.factors[factor.key];
      fields.push({
        inline: false,
        name: `${factor.label} · ${factor.weight}% weight`,
        value: truncate(
          `${assessment.score}/100 — ${assessment.reason}`,
          MAX_FIELD
        ),
      });
    }
  }
  // Embed text has a combined 6000-character limit, including title, footer, field names and values.
  let remaining = MAX_EMBED_TEXT - title.length - footer.length;
  const safeFields = fields.flatMap((field) => {
    if (remaining <= field.name.length) {
      return [];
    }
    const value = truncate(field.value, remaining - field.name.length);
    remaining -= field.name.length + value.length;
    return [{ ...field, value }];
  });
  const embed = new EmbedBuilder()
    .setColor(FALLBACK_COLOR)
    .setTitle(title)
    .setURL(job.url)
    .addFields(safeFields)
    .setFooter({ text: footer });
  if (job.logo) {
    embed.setThumbnail(job.logo);
  }
  const description = detail?.description ?? job.description;
  if (description && remaining > 0) {
    embed.setDescription(
      formatCardDescription(description, Math.min(MAX_DESCRIPTION, remaining))
    );
  }
  return embed;
};

export const cardPayload = (
  posting: EnrichedJobPosting,
  keyword?: string | null
): MessagePayload => ({
  embeds: [
    embedForJobPosting(
      posting.job,
      posting.detail,
      keyword,
      posting.match
    ).toJSON(),
  ],
});

const listedAt = (job: JobPosting): number => {
  const time = job.datetime ? Date.parse(job.datetime) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

/** Newest first; stable sort keeps undated postings in their input order at the end. */
export const sortNewestFirst = (jobs: JobPosting[]): JobPosting[] =>
  jobs.toSorted((a, b) => listedAt(b) - listedAt(a));

export const formatSourceTitle = (
  count: number,
  keyword?: string | null,
  source?: string
): string =>
  `${count} new '${keyword?.trim() || "all"}' ${count === 1 ? "job" : "jobs"} found in ${formatSourceName(source)}`;

const replyHint = (count: number): string =>
  `Reply with ${count === 1 ? "1" : `1-${count}`} to get the summary of the job`;

/** One valid Markdown link per job; only the visible label is shortened. */
export const deliveryEntry = (job: JobPosting, index: number): string => {
  const prefix = `${index + 1}. `;
  const title =
    `${job.position} @ ${job.company}`
      .replaceAll(/[[\]\\]/gu, "")
      .replaceAll(/\s+/gu, " ")
      .trim() || "Job";
  const url = job.url
    .replaceAll("(", "%28")
    .replaceAll(")", "%29")
    .replaceAll(/\s/gu, (char) => encodeURIComponent(char));
  const suffix = url ? `](${url})` : "";
  const opening = url ? "[" : "";
  const budget =
    MAX_DESCRIPTION - prefix.length - opening.length - suffix.length;
  return `${prefix}${opening}${truncate(title, budget)}${suffix}`;
};

export interface DeliveryPage {
  jobs: JobPosting[];
  payload: { embeds: APIEmbed[] };
}

/**
 * Lossless display preparation. Sources follow first appearance in the newest-first list;
 * each source gets as many messages as needed. Recall uses the exact jobs on each page.
 */
export const deliveryPages = (
  jobs: JobPosting[],
  keyword?: string | null
): DeliveryPage[] => {
  const groups = new Map<string, JobPosting[]>();
  for (const job of sortNewestFirst(jobs)) {
    const source = job.source || "linkedin";
    const group = groups.get(source);
    if (group) {
      group.push(job);
    } else {
      groups.set(source, [job]);
    }
  }
  const pages: DeliveryPage[] = [];
  for (const [source, group] of groups) {
    let pageJobs: JobPosting[] = [];
    let lines: string[] = [];
    let length = 0;
    const flush = () => {
      if (!pageJobs.length) {
        return;
      }
      pages.push({
        jobs: pageJobs,
        payload: {
          embeds: [
            {
              color: FALLBACK_COLOR,
              description: lines.join("\n"),
              footer: { text: replyHint(pageJobs.length) },
              title: truncate(
                formatSourceTitle(pageJobs.length, keyword, source),
                MAX_TITLE
              ),
            },
          ],
        },
      });
      pageJobs = [];
      lines = [];
      length = 0;
    };
    for (const job of group) {
      let line = deliveryEntry(job, pageJobs.length);
      if (
        pageJobs.length &&
        (pageJobs.length === SOURCE_PAGE_CAPACITY ||
          length + 1 + line.length > MAX_DESCRIPTION)
      ) {
        flush();
        line = deliveryEntry(job, 0);
      }
      length += (lines.length ? 1 : 0) + line.length;
      pageJobs.push(job);
      lines.push(line);
    }
    flush();
  }
  return pages;
};
