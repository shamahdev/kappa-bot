import { WORK_ENVIRONMENTS } from "@kappa/contracts";
import type { WorkEnvironmentType } from "@kappa/contracts";
import { JobSubscriptionError } from "@kappa/service/job-listings";
import type { JobSubscription } from "@kappa/service/job-listings";
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type {
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import type { FeatureContext } from "../../../core/feature";
import {
  applicationErrorMessage,
  errorEmbed,
  jobActor,
  jobScope,
  requireManageGuild,
} from "../interactions";

const input = (id: string, label: string, value: string, maxLength: number) =>
  new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(maxLength)
      .setValue(value)
  );

export const showSubscriptionEditor = (
  interaction: StringSelectMenuInteraction,
  sub: JobSubscription
) =>
  interaction.showModal(
    new ModalBuilder()
      .setCustomId(`jobs:edit:${sub.id}`)
      .setTitle("Edit subscription")
      .addComponents(
        input("title", "Title (optional)", sub.title ?? "", 80),
        input(
          "keywords",
          "Keywords (comma-separated alternatives)",
          sub.keywords ?? "",
          1018
        ),
        input(
          "environments",
          "Environments: onsite, remote, hybrid (optional)",
          sub.workEnvironments?.join(", ") ?? "",
          100
        ),
        input(
          "salary",
          "Minimum IDR/month (upper salary can qualify)",
          sub.minimumSalary === null || sub.minimumSalary === undefined
            ? ""
            : String(sub.minimumSalary),
          30
        ),
        input(
          "unspecified",
          "Include unspecified: salary, environment",
          [
            sub.includeUnspecifiedSalary ? "salary" : "",
            sub.includeUnspecifiedEnvironment ? "environment" : "",
          ]
            .filter(Boolean)
            .join(", "),
          100
        )
      )
  );

export const onSubscriptionEdit = async (
  ctx: FeatureContext,
  interaction: unknown
): Promise<boolean> => {
  const inter = interaction as Partial<ModalSubmitInteraction> | null;
  if (
    !inter?.isModalSubmit?.() ||
    !inter.customId ||
    !/^jobs:edit:[1-9]\d*$/u.test(inter.customId)
  ) {
    return false;
  }
  const modal = inter as ModalSubmitInteraction;
  if (!(await requireManageGuild(modal))) {
    return true;
  }
  await modal.deferReply({ ephemeral: true });
  try {
    const id = Number(modal.customId.slice("jobs:edit:".length));
    if (!Number.isSafeInteger(id)) {
      throw new JobSubscriptionError("VALIDATION", "Invalid subscription.");
    }
    const actor = jobActor(modal);
    const rows = await ctx.jobListings.subscriptions.list(
      actor,
      jobScope(modal)
    );
    const sub = rows.find((row) => row.id === id);
    if (!sub) {
      throw new JobSubscriptionError(
        "NOT_FOUND",
        "Subscription not found here."
      );
    }
    const salary = modal.fields.getTextInputValue("salary").trim();
    if (salary && !/^\d+(?:\.\d+)?$/u.test(salary)) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Enter a non-negative salary in IDR/month, or leave blank."
      );
    }
    const environments = modal.fields
      .getTextInputValue("environments")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      environments.some(
        (value) => !(WORK_ENVIRONMENTS as readonly string[]).includes(value)
      )
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Use onsite, remote, hybrid, or leave environments blank."
      );
    }
    const unspecified = modal.fields
      .getTextInputValue("unspecified")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      unspecified.some((value) => value !== "salary" && value !== "environment")
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Use salary, environment, both, or leave unspecified blank."
      );
    }
    const keywords = modal.fields.getTextInputValue("keywords");
    await ctx.jobListings.subscriptions.update(actor, id, {
      ...(keywords === sub.keywords ? {} : { keywords }),
      includeUnspecifiedEnvironment: unspecified.includes("environment"),
      includeUnspecifiedSalary: unspecified.includes("salary"),
      minimumSalary: salary ? Number(salary) : null,
      title: modal.fields.getTextInputValue("title"),
      workEnvironments: environments as WorkEnvironmentType[],
    });
    await modal.editReply({
      content:
        "Subscription updated. Existing seen postings will not be resent.",
    });
  } catch (error) {
    await modal.editReply({
      embeds: [errorEmbed(applicationErrorMessage(error))],
    });
  }
  return true;
};
