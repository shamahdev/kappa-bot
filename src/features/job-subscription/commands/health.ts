import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { FeatureContext } from '../../../core/feature';
import { circuitCount, CONCRETE_SOURCES, OPT_IN_SOURCES, SOURCE_COOKIE_ENV } from '../adapter';
import { formatSourceName } from '../embed';
import { errorEmbed, requireManageGuild } from './_shared';

export type SourceHealth = {
  source: string;
  active: boolean;
  detail: string;
};

/**
 * Static source check (no network): concrete Source Adapters are always
 * active; opt-in ones need their WAF-cookie env var. Pure over `env` so it is
 * testable without Discord or network.
 */
export function checkSources(
  env: Record<string, string | undefined>,
  circuitOpen: number,
): SourceHealth[] {
  const rows: SourceHealth[] = [];
  for (const source of CONCRETE_SOURCES) {
    if (source === 'linkedin' && circuitOpen > 0) {
      rows.push({
        source,
        active: true,
        detail: `ready (circuit backing off on ${circuitOpen} filter set(s))`,
      });
    } else {
      rows.push({ source, active: true, detail: 'ready' });
    }
  }
  for (const source of OPT_IN_SOURCES) {
    try {
      const envName = SOURCE_COOKIE_ENV[source as keyof typeof SOURCE_COOKIE_ENV] ?? '';
      const value = envName ? (env[envName] ?? '') : '';
      if (value.trim()) {
        rows.push({ source, active: true, detail: 'ready (cookies set)' });
      } else {
        rows.push({ source, active: false, detail: `not active — set ${envName} (see .env.example)` });
      }
    } catch (e) {
      rows.push({ source, active: false, detail: `error — ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return rows;
}

export function healthEmbed(rows: SourceHealth[]): EmbedBuilder {
  const lines = rows.map(
    (r) => `${r.active ? '🟢' : '🔴'} \`${r.source}\` ${formatSourceName(r.source)} — ${r.detail}`,
  );
  return new EmbedBuilder().setColor(0x3f6b55).setTitle('Job source health').setDescription(lines.join('\n'));
}

/** /jobs health: which sources are active, with the reason when one is not. */
export async function executeHealth(
  interaction: ChatInputCommandInteraction,
  _ctx: FeatureContext,
): Promise<void> {
  if (!(await requireManageGuild(interaction))) return;
  try {
    const rows = checkSources(process.env, circuitCount());
    await interaction.reply({ embeds: [healthEmbed(rows)], ephemeral: true });
  } catch (e) {
    await interaction.reply({
      embeds: [errorEmbed(`health check failed — ${e instanceof Error ? e.message : String(e)}`)],
      ephemeral: true,
    });
  }
}
