// Groq AI enrichment for single-job cards (owner-opted, via AI SDK).
// summarizeJob condenses a posting description into a short seeker-focused
// summary; withAiSummary swaps it into a JobDetail. Never blocks delivery:
// no key, empty input, or any failure returns the input unchanged/null.
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { JobDetail, JobPosting } from './types';

const MAX_INPUT = 6000; // chars of description sent to the model
const MAX_SUMMARY = 1500; // chars kept for the embed
const MODEL = process.env.GROQ_MODEL ?? 'qwen/qwen3.8-27b';

const SYSTEM =
  'You summarize job postings for job seekers. Reply in the same language as the posting. ' +
  'Discord markdown is allowed (**bold**, • bullets). Keep it under 1200 characters. Cover: ' +
  'what the role is in one line; must-have requirements; nice-to-have skills; ' +
  'salary, work arrangement and location (a Location/Salary header above the description is trusted metadata — report it, never claim it was not stated); how to apply. ' +
  'Skip boilerplate (equal-opportunity statements, company fluff). ' +
  'Never open with the job title or company name as a heading — begin directly with the role summary. ' +
  'Output ONLY the summary, no preamble.';

export async function summarizeJob(
  title: string,
  company: string,
  description: string,
  meta?: { salary?: string | null; location?: string | null },
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !description.trim()) return null;
  try {
    const groq = createGroq({ apiKey });
    const context = [
      meta?.location ? `Location: ${meta.location}` : null,
      meta?.salary ? `Salary: ${meta.salary}` : null,
    ].filter((l): l is string => Boolean(l));
    const contextBlock = context.length > 0 ? `${context.join('\n')}\n\n` : '';
    const { text } = await generateText({
      model: groq(MODEL),
      system: SYSTEM,
      prompt: `Job: ${title} @ ${company}\n\n${contextBlock}${description.slice(0, MAX_INPUT)}`,
      maxOutputTokens: 600,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(30_000),
    });
    const summary = stripTitleHeading(text.trim(), title, company);
    if (!summary) return null;
    return summary.length > MAX_SUMMARY ? `${summary.slice(0, MAX_SUMMARY).trimEnd()}…` : summary;
  } catch {
    return null;
  }
}

/**
 * Drop a leading model-echoed heading that duplicates "title @ company"
 * (the card already shows it as the embed title). Token-overlap fuzzy match:
 * most title tokens + all company tokens must appear in the heading line.
 * ("NodeJs" vs "Node.js" tokenize differently, so substring match fails.)
 */
export function stripTitleHeading(summary: string, title: string, company: string): string {
  const lines = summary.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i++;
  if (i >= lines.length) return summary;
  const tokens = (s: string) =>
    s
      .toLowerCase()
      .replace(/[*_#`>\[\]()]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  const head = new Set(tokens(lines[i]!));
  const titleTokens = tokens(title);
  const companyTokens = tokens(company);
  const hits = titleTokens.filter((t) => head.has(t)).length;
  const need = titleTokens.length <= 2 ? titleTokens.length : Math.ceil(titleTokens.length / 2);
  if (
    titleTokens.length > 0 &&
    companyTokens.length > 0 &&
    hits >= Math.max(need, 1) &&
    companyTokens.every((t) => head.has(t))
  ) {
    lines.splice(i, 1);
    while (i < lines.length && !lines[i]!.trim()) lines.splice(i, 1);
    return lines.join('\n');
  }
  return summary;
}

/** Swap an AI summary into the card detail; falls back to the base detail. */
export async function withAiSummary(
  job: Pick<JobPosting, 'position' | 'company' | 'description' | 'salary' | 'location'>,
  base: JobDetail | null,
): Promise<JobDetail | null> {
  // Prefer the fetched detail; fall back to the list-row description (e.g. a
  // failed LinkedIn detail fetch for a row that already carries text).
  const input =
    base?.description
      ? base
      : job.description
        ? { description: job.description, salary: job.salary ?? null, closed: false }
        : base;
  if (!input?.description) return base;
  const summary = await summarizeJob(job.position, job.company, input.description, {
    salary: input.salary ?? job.salary ?? null,
    location: job.location ?? null,
  });
  if (!summary) return input;
  return { ...input, description: summary };
}
