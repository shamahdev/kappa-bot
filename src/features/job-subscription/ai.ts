// AI enrichment (owner-opted): plain OpenAI-compatible chat completion.
// Works with any standard /v1/chat/completions endpoint — no opencode CLI
// needed. AI_USER_AGENT exists because some gateways fingerprint clients;
// standard OpenAI providers ignore it. Never blocks delivery: any failure
// (no key, 401, bad JSON, timeout) returns null and the embed renders the
// raw description instead.
import type { JobAiSummary } from './types';

const MAX_INPUT = 6000; // chars of description sent to the model

const SYSTEM =
  'You extract structured facts from job postings. Reply with ONLY a JSON object, no markdown: ' +
  '{"summary": "2-sentence plain summary", ' +
  '"details": "the key responsibilities and requirements condensed into 3-5 short lines separated by \\n, ' +
  'excluding anything covered by seniority/employmentType/workMode/skills/salary", ' +
  '"seniority": "internship|entry|mid|senior|lead|unknown", ' +
  '"employmentType": "full-time|part-time|contract|internship|unknown", "workMode": "onsite|remote|hybrid|unknown", ' +
  '"skills": ["max 6 short skill tags"], "salary": "stated pay range or null"}';

export async function summarizeJob(description: string): Promise<JobAiSummary | null> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model || !description) return null;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': process.env.AI_USER_AGENT ?? 'opencode/1.0',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: description.slice(0, MAX_INPUT) },
        ],
        temperature: 0,
        // deepseek-style reasoning models spend tokens on reasoning_content
        // before the answer; keep the budget high enough for both.
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`summarizeJob: ${res.status} ${(await res.text()).slice(0, 120)}`);
      return null;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = extractJson(content);
    if (!parsed || typeof parsed.summary !== 'string') return null;
    return {
      summary: parsed.summary,
      details: strOrNull(parsed.details),
      seniority: strOrNull(parsed.seniority),
      employmentType: strOrNull(parsed.employmentType),
      workMode: strOrNull(parsed.workMode),
      skills: Array.isArray(parsed.skills)
        ? parsed.skills.filter((s) => typeof s === 'string').slice(0, 6)
        : [],
      salary: strOrNull(parsed.salary),
    };
  } catch (e) {
    console.error('summarizeJob failed:', (e as Error).message);
    return null;
  }
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : null;
}

/** Tolerant JSON extraction: plain object, code-fenced, or first balanced block. */
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
