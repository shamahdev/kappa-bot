// Throwaway prototype for wayfinder ticket 10 — NOT production code.
// Renders a fetched JobPosting as the decided single rich embed
// (ticket 09 Q5 A): title `Position @ Company`, Location/Posted/Salary
// fields, logo thumbnail, stable URL — no detail-fetch enrichment.

import { EmbedBuilder } from 'discord.js';
import { MOCK_JOBS, type MockJobPosting } from './mock-jobs';

const FALLBACK_COLOR = 0x2b4ffe;

export function embedForJob(job: MockJobPosting, sourceLabel = 'LinkedIn') {
  const embed = new EmbedBuilder()
    .setColor(FALLBACK_COLOR)
    .setTitle(`${job.position} @ ${job.company}`)
    .setURL(job.url)
    .addFields(
      { name: 'Location', value: job.location, inline: true },
      { name: 'Posted', value: job.agoTime, inline: true },
    )
    .setFooter({ text: `Kappa · ${sourceLabel}` });
  if (job.logo) embed.setThumbnail(job.logo);
  if (job.salary) embed.addFields({ name: 'Salary', value: job.salary, inline: true });
  return embed;
}

if (import.meta.main) {
  for (const job of MOCK_JOBS) {
    console.log(JSON.stringify(embedForJob(job).toJSON()));
  }
}
