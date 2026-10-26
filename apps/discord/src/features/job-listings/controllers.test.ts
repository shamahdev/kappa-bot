import { describe, expect, mock, test } from "bun:test";

import { JOB_SOURCE_OPTIONS } from "@kappa/contracts";
import {
  CV_MAX_UPLOAD_BYTES,
  JobSubscriptionError,
} from "@kappa/service/job-listings";
import type { JobListings, JobSubscription } from "@kappa/service/job-listings";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import type { FeatureContext } from "../../core/feature";
import { jobActor } from "./commands/_shared";
import { executeCvUpload } from "./commands/cv";
import { onComponent, subscriptionId } from "./events/components";
import { onMessage } from "./events/reply";
import feature, { jobsCommand } from "./index";

const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) {
    throw new Error("Expected a test value to be present");
  }
  return value;
};

const context = (
  subscriptions: Partial<JobListings["subscriptions"]> = {},
  listings: Partial<JobListings> = {}
): FeatureContext =>
  ({
    config: {},
    jobListings: { ...listings, subscriptions },
    log: { error: mock(), info: mock(), warn: mock() },
  }) as unknown as FeatureContext;

const select = (customId = "jobs:fetch", value = "7") => ({
  channelId: "channel",
  customId,
  deferUpdate: mock(() => Promise.resolve()),
  editReply: mock((_payload: unknown) => Promise.resolve()),
  guildId: "guild",
  isStringSelectMenu: () => true,
  memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild),
  reply: mock((_payload: unknown) => Promise.resolve()),
  user: { id: "user" },
  values: [value],
});

const row = (overrides: Partial<JobSubscription> = {}): JobSubscription => ({
  channelId: "channel",
  createdAt: new Date(),
  createdBy: "user",
  distance: null,
  filters: {},
  geoId: null,
  guildId: "guild",
  id: 7,
  isActive: true,
  keywords: "engineer",
  location: "Indonesia",
  retentionDays: 14,
  source: "linkedin",
  ...overrides,
});

const uploadInteraction = (name: string, size: number) => ({
  deferReply: mock(() => Promise.resolve()),
  editReply: mock((_payload: unknown) => Promise.resolve()),
  guildId: null,
  options: {
    getAttachment: () => ({
      name,
      size,
      url: "https://discord.invalid/attachment",
    }),
  },
  user: { id: "user" },
});

describe("command registration", () => {
  test("exposes scoped retention but no poll setting and uses canonical source choices", () => {
    const data = jobsCommand.toJSON();
    const config = required(
      data.options?.find((option) => option.name === "config")
    );
    expect(
      "options" in config ? config.options?.map((option) => option.name) : []
    ).toEqual(["retention_days"]);
    expect(JSON.stringify(data)).not.toContain("poll_interval_minutes");
    const subscribe = required(
      data.options?.find((option) => option.name === "subscribe")
    );
    const source =
      "options" in subscribe
        ? subscribe.options?.find((option) => option.name === "source")
        : undefined;
    expect(source && "choices" in source ? source.choices : []).toEqual(
      JOB_SOURCE_OPTIONS.map(({ id, name }) => ({ name, value: id }))
    );
    expect(feature.name).toBe("job-listings");
    expect("schedule" in feature).toBe(false);
  });

  test("application errors reach the user through the slash command boundary", async () => {
    const inter = {
      deferReply: () => {
        inter.deferred = true;
        return Promise.resolve();
      },
      deferred: false,
      editReply: mock((_payload: unknown) => Promise.resolve()),
      guildId: null,
      options: { getInteger: () => 0, getSubcommand: () => "config" },
      replied: false,
      reply: mock((_payload: unknown) => Promise.resolve()),
      user: { id: "user" },
    };
    const ctx = context({
      setRetention: () =>
        Promise.reject(
          new JobSubscriptionError(
            "VALIDATION",
            "retentionDays must be an integer 1–365"
          )
        ),
    });
    await required(feature.commands?.[0]).execute(
      inter as unknown as ChatInputCommandInteraction,
      ctx
    );
    const payload = required(inter.editReply.mock.calls[0])[0] as {
      embeds: { toJSON: () => { description?: string } }[];
    };
    expect(required(payload.embeds[0]).toJSON().description).toBe(
      "retentionDays must be an integer 1–365"
    );
  });
});

describe("trusted Discord actor", () => {
  test("grants only the interaction guild using current SDK permissions", async () => {
    const inter = select();
    const actor = jobActor(inter as unknown as StringSelectMenuInteraction);
    expect(actor.userId).toBe("user");
    expect(await actor.canManageGuild("guild")).toBe(true);
    expect(await actor.canManageGuild("another-guild")).toBe(false);
    const denied = jobActor({
      ...inter,
      memberPermissions: new PermissionsBitField(),
    } as unknown as StringSelectMenuInteraction);
    expect(await denied.canManageGuild("guild")).toBe(false);
    const admin = jobActor({
      ...inter,
      memberPermissions: new PermissionsBitField(
        PermissionFlagsBits.Administrator
      ),
    } as unknown as StringSelectMenuInteraction);
    expect(await admin.canManageGuild("guild")).toBe(true);
    const personal = jobActor({
      ...inter,
      guildId: null,
      memberPermissions: null,
    } as unknown as StringSelectMenuInteraction);
    expect(await personal.canManageGuild("guild")).toBe(false);
  });
});

describe("picker controller boundaries", () => {
  test("rejects malformed IDs, not just non-integer Number conversions", () => {
    for (const value of [
      "",
      "0",
      "-1",
      "1e2",
      "1.5",
      " 7",
      "7 ",
      "07",
      "0x7",
      "9007199254740992",
    ]) {
      expect(subscriptionId(value)).toBeNull();
    }
    expect(subscriptionId("7")).toBe(7);
  });

  for (const action of ["jobs:fetch", "jobs:latest"]) {
    test(`${action} cannot select another channel's subscription`, async () => {
      const get = mock(() =>
        Promise.resolve(row({ channelId: "other-channel" }))
      );
      const list = mock(async (actor, scope, channelId) => {
        expect(actor.userId).toBe("user");
        expect(await actor.canManageGuild("guild")).toBe(true);
        expect(scope).toEqual({ guildId: "guild", kind: "guild" });
        expect(channelId).toBe("channel");
        return [row({ id: 8 })];
      });
      const poll = mock(() => Promise.reject(new Error("must not poll")));
      const latest = mock(() =>
        Promise.reject(new Error("must not fetch latest"))
      );
      const inter = select(action);
      await onComponent(context({ get, list }, { latest, poll }), inter);
      expect(get).not.toHaveBeenCalled();
      expect(poll).not.toHaveBeenCalled();
      expect(latest).not.toHaveBeenCalled();
      expect(inter.editReply).toHaveBeenCalled();
    });
  }

  test("does not retry a failed validation reply", async () => {
    const editReply = mock((_payload: unknown) =>
      Promise.reject(new Error("reply unavailable"))
    );
    const ctx = context({ list: () => Promise.resolve([row({ id: 8 })]) });
    await expect(onComponent(ctx, { ...select(), editReply })).rejects.toThrow(
      "reply unavailable"
    );
    expect(editReply).toHaveBeenCalledTimes(1);
    expect(ctx.log.error).not.toHaveBeenCalled();
  });

  test("reauthorizes a selected subscription and passes scoped poll input, not rows", async () => {
    const get = mock(() => Promise.resolve(row()));
    const poll = mock((_actor, input) => {
      expect(input).toEqual({
        channelId: "channel",
        scope: { guildId: "guild", kind: "guild" },
        subscriptionId: 7,
      });
      return Promise.resolve({
        durationMs: 100,
        fingerprintsSkipped: 0,
        newJobsDelivered: 2,
        subscriptionsCount: 1,
      });
    });
    await onComponent(
      context({ get, list: () => Promise.resolve([row()]) }, { poll }),
      select()
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  test("a stale permission check cannot bypass application reauthorization", async () => {
    const get = mock(() =>
      Promise.reject(
        new JobSubscriptionError("FORBIDDEN", "subscription not found")
      )
    );
    const poll = mock(() => Promise.reject(new Error("must not poll")));
    const inter = select();
    await onComponent(
      context({ get, list: () => Promise.resolve([row()]) }, { poll }),
      inter
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(poll).not.toHaveBeenCalled();
    const payload = required(inter.editReply.mock.calls[0])[0] as {
      embeds: { toJSON: () => { description?: string } }[];
    };
    expect(required(payload.embeds[0]).toJSON().description).toBe(
      "subscription not found"
    );
  });

  test("component permission denial uses the same current-permission gate as commands", async () => {
    const list = mock(() => Promise.resolve([]));
    const inter = { ...select(), memberPermissions: new PermissionsBitField() };
    await onComponent(context({ list }), inter);
    expect(list).not.toHaveBeenCalled();
    expect(inter.deferUpdate).not.toHaveBeenCalled();
    expect(inter.reply).toHaveBeenCalledTimes(1);
  });

  test("DM selections use personal scope and the authenticated caller", async () => {
    const list = mock((actor, scope, channelId) => {
      expect(actor.userId).toBe("user");
      expect(scope).toEqual({ kind: "personal" });
      expect(channelId).toBe("channel");
      return Promise.resolve([]);
    });
    await onComponent(context({ list }), {
      ...select(),
      guildId: null,
      memberPermissions: null,
    });
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe("reply adapter", () => {
  test("forwards 1-based indexes, channel and message identity; user ID only in DMs", async () => {
    const inputs: unknown[] = [];
    const ctx = context(
      {},
      {
        replyDetail: (input) => {
          inputs.push(input);
          return Promise.resolve(null);
        },
      }
    );
    const message = {
      author: { bot: false, id: "user" },
      channelId: "channel",
      content: " 3 ",
      reference: { messageId: "delivered-message" },
      reply: mock(() => Promise.resolve()),
    };
    await onMessage(ctx, { ...message, guildId: "guild" });
    await onMessage(ctx, { ...message, guildId: null });
    await onMessage(ctx, { ...message, content: "1e2" });
    await onMessage(ctx, { ...message, content: "0" });
    expect(inputs).toEqual([
      { channelId: "channel", index: 3, messageId: "delivered-message" },
      {
        channelId: "channel",
        index: 3,
        messageId: "delivered-message",
        userId: "user",
      },
    ]);
  });
});

describe("CV attachment adapter", () => {
  test("checks actual downloaded bytes even when metadata understates size", async () => {
    const originalFetch = globalThis.fetch;
    const save = mock(() => Promise.reject(new Error("must not save")));
    try {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(new Uint8Array(CV_MAX_UPLOAD_BYTES + 1)))
      ) as unknown as typeof fetch;
      const inter = uploadInteraction("cv.txt", 1);
      await executeCvUpload(
        inter as unknown as ChatInputCommandInteraction,
        context({}, { cv: { save } as unknown as JobListings["cv"] })
      );
      expect(save).not.toHaveBeenCalled();
      const payload = required(inter.editReply.mock.calls[0])[0] as {
        embeds: { toJSON: () => { description?: string } }[];
      };
      expect(required(payload.embeds[0]).toJSON().description).toContain(
        "too big"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("sends PDF bytes to the application parser rather than decoding them in Discord", async () => {
    const originalFetch = globalThis.fetch;
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const savePdf = mock((userId, actual, filename) => {
      expect(userId).toBe("user");
      expect(actual).toEqual(bytes);
      expect(filename).toBe("cv.pdf");
      return Promise.resolve({
        discordId: userId,
        filename,
        text: "parsed by application",
        updatedAt: new Date(),
      });
    });
    try {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(bytes))
      ) as unknown as typeof fetch;
      await executeCvUpload(
        uploadInteraction(
          "cv.pdf",
          bytes.length
        ) as unknown as ChatInputCommandInteraction,
        context({}, { cv: { savePdf } as unknown as JobListings["cv"] })
      );
      expect(savePdf).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
