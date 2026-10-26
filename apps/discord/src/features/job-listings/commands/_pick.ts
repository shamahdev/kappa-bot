// Shared subscription picker (StringSelectMenu) helpers. Subscription ids stay
// in option VALUES only — users never see them; labels are human-readable.

import type {
  JobActor,
  JobScope,
  JobSubscription,
} from "@kappa/service/job-listings";
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { Interaction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";

export const activeChannelSubs = async (
  ctx: FeatureContext,
  actor: JobActor,
  scope: JobScope,
  channelId: string
): Promise<JobSubscription[]> => {
  const subs = await ctx.jobListings.subscriptions.list(
    actor,
    scope,
    channelId
  );
  return subs.filter((sub) => sub.isActive);
};

export const activeGuildSubs = async (
  ctx: FeatureContext,
  actor: JobActor,
  scope: JobScope
): Promise<JobSubscription[]> => {
  const subs = await ctx.jobListings.subscriptions.list(actor, scope);
  return subs.filter((sub) => sub.isActive);
};

/** Human label for a picker option — no id. Max 100 chars (Discord limit). */
export const subscriptionLabel = (s: JobSubscription): string =>
  `${s.keywords ?? "—"} · ${s.source}${s.location ? ` · ${s.location}` : ""}`.slice(
    0,
    100
  );

export const channelNameOf = (
  interaction: Interaction,
  channelId: string
): string | null => {
  const guild = "guild" in interaction ? interaction.guild : null;
  const name = guild?.channels.cache.get(channelId)?.name;
  return typeof name === "string" ? name : null;
};

/** Select menu over Subscriptions (max 25 options). Prepends an "all" entry when asked. */
export const pickerRow = (
  customId: string,
  subs: JobSubscription[],
  interaction: Interaction,
  allLabel?: string
): ActionRowBuilder<StringSelectMenuBuilder> => {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Choose a subscription");
  if (allLabel) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(allLabel)
        .setValue("all")
        .setDescription(`${subs.length} subscription(s)`)
    );
  }
  for (const s of subs.slice(0, allLabel ? 24 : 25)) {
    const channel = channelNameOf(interaction, s.channelId);
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(subscriptionLabel(s))
        .setValue(String(s.id))
        .setDescription(
          (channel ? `Posts in #${channel}` : "Subscription").slice(0, 100)
        )
    );
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
};
