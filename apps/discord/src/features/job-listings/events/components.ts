import type { JobSubscription } from "@kappa/service/job-listings";
import type { StringSelectMenuInteraction } from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import { activeChannelSubs, activeGuildSubs } from "../commands/_pick";
import {
  applicationErrorMessage,
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../commands/_shared";
import { fetchResultEmbed } from "../commands/fetch";
import { removedEmbed } from "../commands/unsubscribe";
import { cardPayload } from "../embed";

const asSelectMenu = (
  interaction: unknown
): StringSelectMenuInteraction | null => {
  if (typeof interaction !== "object" || interaction === null) {
    return null;
  }
  const candidate = interaction as Partial<StringSelectMenuInteraction>;
  return typeof candidate.isStringSelectMenu === "function" &&
    candidate.isStringSelectMenu()
    ? (candidate as StringSelectMenuInteraction)
    : null;
};

/** Component IDs are untrusted input: accept only the exact IDs emitted by our pickers. */
export const subscriptionId = (value: string): number | null => {
  if (!/^[1-9]\d*$/u.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

type Selection =
  | { action: "fetch"; id: number | null }
  | { action: "unsub" | "latest"; id: number };

const parseSelection = (action: string, values: string[]): Selection | null => {
  if (values.length !== 1) {
    return null;
  }
  const value = values[0] ?? "";
  const id = subscriptionId(value);
  if (action === "fetch") {
    return id !== null || value === "all" ? { action, id } : null;
  }
  return id !== null && (action === "unsub" || action === "latest")
    ? { action, id }
    : null;
};

const subscriptionSummary = (removed: JobSubscription): string =>
  `\`${removed.source}\` ${removed.keywords ?? ""}${removed.location ? ` · ${removed.location}` : ""}`;

export const onComponent = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<void> => {
  const inter = asSelectMenu(interaction);
  if (
    !(
      inter &&
      ["jobs:unsub", "jobs:fetch", "jobs:latest"].includes(inter.customId)
    )
  ) {
    return;
  }
  if (!(await requireManageGuild(inter))) {
    return;
  }
  await inter.deferUpdate();
  const fail = async (message: string) => {
    await inter.editReply({
      components: [],
      content: null,
      embeds: [errorEmbed(message)],
    });
  };
  const actor = jobActor(inter);
  const scope = jobScope(inter);
  const selection = parseSelection(
    inter.customId.slice("jobs:".length),
    inter.values
  );
  if (!selection) {
    return fail("Pick a subscription from the menu.");
  }
  const { action, id } = selection;

  try {
    if (action === "unsub") {
      const scoped = await activeGuildSubs(ctx, actor, scope);
      if (!scoped.some((sub) => sub.id === id)) {
        return fail("Subscription not found here.");
      }
      // Reauthorize even if the menu predates a permission/subscription change.
      await ctx.jobListings.subscriptions.get(actor, id);
      const removed = await ctx.jobListings.subscriptions.remove(actor, id);
      await inter.editReply({
        components: [],
        content: null,
        embeds: [removedEmbed(subscriptionSummary(removed))],
      });
      return;
    }
    if (!inter.channelId) {
      return fail("Run this from a channel.");
    }
    // A valid subscription in another channel must not be selectable from this menu.
    const rows = await activeChannelSubs(ctx, actor, scope, inter.channelId);
    if (!rows.length || (id !== null && !rows.some((sub) => sub.id === id))) {
      return fail(
        "No matching active subscription in this channel. It may have been removed."
      );
    }
    if (id !== null) {
      const current = await ctx.jobListings.subscriptions.get(actor, id);
      if (!current.isActive || current.channelId !== inter.channelId) {
        return fail("No matching active subscription in this channel.");
      }
    }
    if (action === "fetch") {
      const result = await ctx.jobListings.poll(actor, {
        channelId: inter.channelId,
        scope,
        ...(id === null ? {} : { subscriptionId: id }),
      });
      await inter.editReply({
        components: [],
        content: null,
        embeds: [fetchResultEmbed(result)],
      });
    } else {
      const posting = await ctx.jobListings.latest(actor, id);
      if (!posting) {
        return fail("No jobs found for that subscription right now.");
      }
      // Membership was validated above; the same list supplies the card keyword.
      const sub = rows.find((row) => row.id === id);
      await inter.editReply({
        content: null,
        ...cardPayload(posting, sub?.keywords),
        components: [],
      });
    }
  } catch (error) {
    ctx.log.error(
      { err: error, guildId: inter.guildId },
      "component job action failed"
    );
    await fail(
      applicationErrorMessage(
        error,
        "Failed to fetch jobs due to an internal error."
      )
    );
  }
};
