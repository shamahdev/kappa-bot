import {
  jobSourceName,
  MATCH_GRADE_LABELS,
  normalizeText,
  DEFAULT_JOB_SOURCE,
  sortPostingsNewestFirst,
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
import { EMBED_COLOR } from "./presentation";

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

export const formatSourceName = (source: string = DEFAULT_JOB_SOURCE): string =>
  jobSourceName(source);

const formatFooterText = (keyword?: string | null, source?: string): string =>
  `'${keyword?.trim() || "all"}' keyword in '${formatSourceName(source)}'`;

/** Normalize source text, preserving paragraph breaks and the title link for the full description. */
const formatCardDescription = (
  raw: string,
  limit = MAX_DESCRIPTION
): string => {
  const text = normalizeText(raw);
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
const embedForJobPosting = (
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
  // DMs show only the A–E grade; the factor breakdown lives on the dashboard.
  if (match) {
    fields.push({
      inline: false,
      name: "Match",
      value: truncate(
        `${match.grade} — ${MATCH_GRADE_LABELS[match.grade]}`,
        MAX_FIELD
      ),
    });
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
    .setColor(EMBED_COLOR)
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

const formatSourceTitle = (
  count: number,
  keyword?: string | null,
  source?: string
): string =>
  `${count} new '${keyword?.trim() || "all"}' ${count === 1 ? "job" : "jobs"} found in ${formatSourceName(source)}`;

const replyHint = (count: number): string =>
  `Reply with ${count === 1 ? "1" : `1-${count}`} to get the summary of the job`;

/** One valid Markdown link per job; only the visible label is shortened. */
const deliveryEntry = (job: JobPosting, index: number): string => {
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
  for (const job of sortPostingsNewestFirst(jobs)) {
    const source = job.source || DEFAULT_JOB_SOURCE;
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
              color: EMBED_COLOR,
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
