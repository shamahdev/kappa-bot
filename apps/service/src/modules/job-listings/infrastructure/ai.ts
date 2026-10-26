// Groq AI enrichment (via AI SDK). summarizeJob condenses a posting description
// into a short seeker-focused summary (cached per posting in `jobs` by the
// enrichment application); scoreJobMatch scores a posting against a
// CV. Never blocks delivery: no key, empty input, or any failure returns null.

import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";

import type { JobMatch } from "../domain/posting";

export type { JobMatch } from "../domain/posting";

// Chars of description sent to the model.
const MAX_INPUT = 6000;
// Chars kept for the summary.
const MAX_SUMMARY = 1500;
const MODEL = process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b";

const SYSTEM =
  "You summarize job postings for job seekers. Reply in the same language as the posting. " +
  "Markdown is allowed (**bold**, • bullets). Keep it under 1200 characters. Cover: " +
  "what the role is in one line; must-have requirements; nice-to-have skills; " +
  "salary, work arrangement and location (a Location/Salary header above the description is trusted metadata — report it, never claim it was not stated); how to apply. " +
  "Skip boilerplate (equal-opportunity statements, company fluff). " +
  "Never open with the job title or company name as a heading — begin directly with the role summary. " +
  "Output ONLY the summary, no preamble.";

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(/[*_#`>[\]()]/gu, " ")
    .replaceAll(/[^a-z0-9\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1);

/**
 * Drop a leading model-echoed heading that duplicates "title @ company"
 * (the posting already carries its title). Token-overlap fuzzy match:
 * most title tokens + all company tokens must appear in the heading line.
 * ("NodeJs" vs "Node.js" tokenize differently, so substring match fails.)
 */
export const stripTitleHeading = (
  summary: string,
  title: string,
  company: string
): string => {
  const lines = summary.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]?.trim()) {
    i += 1;
  }
  if (i >= lines.length) {
    return summary;
  }
  const head = new Set(tokens(lines[i] ?? ""));
  const titleTokens = tokens(title);
  const companyTokens = tokens(company);
  const hits = titleTokens.filter((t) => head.has(t)).length;
  const need =
    titleTokens.length <= 2
      ? titleTokens.length
      : Math.ceil(titleTokens.length / 2);
  if (
    titleTokens.length > 0 &&
    companyTokens.length > 0 &&
    hits >= Math.max(need, 1) &&
    companyTokens.every((t) => head.has(t))
  ) {
    lines.splice(i, 1);
    while (i < lines.length && !lines[i]?.trim()) {
      lines.splice(i, 1);
    }
    return lines.join("\n");
  }
  return summary;
};

export const summarizeJob = async (
  title: string,
  company: string,
  description: string,
  meta?: { salary?: string | null; location?: string | null }
): Promise<string | null> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!(apiKey && description.trim())) {
    return null;
  }
  try {
    const groq = createGroq({ apiKey });
    const context = [
      meta?.location ? `Location: ${meta.location}` : null,
      meta?.salary ? `Salary: ${meta.salary}` : null,
    ].filter((l): l is string => Boolean(l));
    const contextBlock = context.length > 0 ? `${context.join("\n")}\n\n` : "";
    const { text } = await generateText({
      abortSignal: AbortSignal.timeout(30_000),
      maxOutputTokens: 600,
      model: groq(MODEL),
      prompt: `Job: ${title} @ ${company}\n\n${contextBlock}${description.slice(0, MAX_INPUT)}`,
      system: SYSTEM,
      temperature: 0.2,
    });
    const summary = stripTitleHeading(text.trim(), title, company);
    if (!summary) {
      return null;
    }
    return summary.length > MAX_SUMMARY
      ? `${summary.slice(0, MAX_SUMMARY).trimEnd()}…`
      : summary;
  } catch {
    return null;
  }
};

// Chars of CV sent to the model.
const MAX_CV_INPUT = 4000;
// Chars of posting sent to the model.
const MAX_JOB_INPUT = 4000;
// Chars kept for the match reason.
const MAX_REASON = 140;

const MATCH_SYSTEM =
  "You score how well a job posting fits a candidate. Reply with ONLY one JSON object, " +
  'no preamble, no markdown: {"score": <0-100 integer>, "reason": "<one line, max 140 chars, ' +
  'naming the decisive overlap or gap>"}. Score the fit honestly: required skills and ' +
  "experience dominate; location and seniority are secondary.";

/**
 * Parse a model reply into a JobMatch. Tolerates surrounding prose by
 * extracting the first {...} block; clamps the score, trims the reason.
 */
export const parseMatchJson = (raw: string): JobMatch | null => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const { score, reason } = parsed as { score?: unknown; reason?: unknown };
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return null;
  }
  const clean = reason.trim().replaceAll(/\s+/gu, " ");
  return {
    reason:
      clean.length > MAX_REASON
        ? `${clean.slice(0, MAX_REASON).trimEnd()}…`
        : clean,
    score: Math.min(100, Math.max(0, Math.round(score))),
  };
};

/**
 * Score one posting against the user's CV. Personal-only callers pass a CV;
 * never throws and never blocks delivery (null on no key/empty/failure).
 */
export const scoreJobMatch = async (
  cvText: string,
  title: string,
  company: string,
  description: string,
  meta?: { location?: string | null }
): Promise<JobMatch | null> => {
  const apiKey = process.env.GROQ_API_KEY;
  const job = description.trim();
  if (!(apiKey && cvText.trim() && job)) {
    return null;
  }
  try {
    const groq = createGroq({ apiKey });
    const location = meta?.location ? `Location: ${meta.location}\n` : "";
    const { text } = await generateText({
      abortSignal: AbortSignal.timeout(30_000),
      maxOutputTokens: 200,
      model: groq(MODEL),
      prompt:
        `Job: ${title} @ ${company}\n${location}\n` +
        `Posting:\n${job.slice(0, MAX_JOB_INPUT)}\n\n` +
        `Candidate CV:\n${cvText.slice(0, MAX_CV_INPUT)}`,
      system: MATCH_SYSTEM,
      temperature: 0.1,
    });
    return parseMatchJson(text);
  } catch {
    return null;
  }
};
