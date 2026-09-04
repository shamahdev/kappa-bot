// Production job embed renderer (ticket 09 Q5 A + corrections: detail
// enrichment opted in by owner; AI summary/structure on top).
import { EmbedBuilder } from 'discord.js';
import type { JobAiSummary, JobDetail, JobPosting } from './types';

const FALLBACK_COLOR = 0x2b4ffe;
const MAX_DESC = 3500; // embed description cap is 4096; leave headroom

function titleCase(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function embedForJob(
  job: JobPosting,
  detail?: JobDetail | null,
  ai?: JobAiSummary | null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(FALLBACK_COLOR)
    .setTitle(`${job.position} @ ${job.company}`)
    .setURL(job.url)
    .addFields(
      { name: 'Location', value: job.location || '—', inline: true },
      { name: 'Posted', value: job.agoTime || 'recently', inline: true },
    )
    .setFooter({ text: 'Kappa · LinkedIn' });
  if (job.logo) embed.setThumbnail(job.logo);
  if (ai?.salary ?? detail?.salary ?? job.salary) {
    embed.addFields({ name: 'Salary', value: (ai?.salary ?? detail?.salary ?? job.salary)!, inline: true });
  }
  if (ai) {
    const structured = [
      ai.seniority ? `Level: **${titleCase(ai.seniority)}**` : null,
      ai.employmentType ? `Type: **${titleCase(ai.employmentType)}**` : null,
      ai.workMode && ai.workMode !== 'unknown' ? `Mode: **${titleCase(ai.workMode)}**` : null,
    ].filter((v): v is string => v !== null);
    if (structured.length > 0) {
      embed.addFields({ name: 'At a glance', value: structured.join(' · ') });
    }
    if (ai.skills.length > 0) {
      embed.addFields({ name: 'Skills', value: ai.skills.join(', ') });
    }
  }
  const rawDesc = detail?.description ?? null;
  // With AI: condensed details replace the raw dump (dedup info already in
  // At a glance / Skills / Salary). Without AI: capped raw description.
  const body = ai ? (ai.details ?? null) : rawDesc;
  if (ai?.summary || body) {
    const summaryBlock = ai?.summary ? `**${ai.summary}**\n\n` : '';
    let text = `${summaryBlock}${body ?? ''}`;
    if (text.length > MAX_DESC) {
      text = `${text.slice(0, MAX_DESC)}…\n\n*(full description at the title link)*`;
    }
    embed.setDescription(text);
  }
  return embed;
}
