import { expect, test } from "bun:test";

import type { JobPosting } from "@kappa/contracts";
import type { Client } from "discord.js";

import { gatewayDeliverer } from "../../core/client";
import type { MessagePayload } from "../../core/feature";
import { createDiscordNotifications, roleNotification } from "./notifications";

const roleId = "123456789012345678";
const postings: JobPosting[] = Array.from({ length: 21 }, (_, index) => ({
  agoTime: "today",
  company: "Example",
  datetime: null,
  id: String(index),
  location: "Indonesia",
  logo: null,
  position: "Frontend engineer",
  salary: null,
  source: "linkedin",
  url: `https://www.linkedin.com/jobs/view/${index}`,
}));

test("notification payload permits only the selected role and suppresses other mention types", () => {
  expect(
    roleNotification(
      { content: "@everyone <@123456789012345679> <@&123456789012345679>" },
      roleId
    )
  ).toEqual({
    allowed_mentions: {
      parse: [],
      replied_user: false,
      roles: [roleId],
      users: [],
    },
    content: `<@&${roleId}>\n@everyone <@123456789012345679> <@&123456789012345679>`,
  });
  expect(roleNotification({ embeds: [] }, null)).toEqual({
    allowed_mentions: { parse: [], replied_user: false, roles: [], users: [] },
    embeds: [],
  });
});

test("multi-page notifications ping the role once, on the first successfully sent page", async () => {
  const sent: MessagePayload[] = [];
  const notifications = createDiscordNotifications(
    (_channelId, payload) => {
      sent.push(payload);
      return Promise.resolve({ messageId: String(sent.length) });
    },
    { discordToken: "offline-token", webUrl: "" }
  );
  for await (const _receipt of notifications.batch(
    "channel",
    postings,
    "Web roles",
    roleId
  )) {
    // Consume the same lazy delivery receipts used by polling.
  }
  expect(sent).toHaveLength(2);
  expect(sent[0]?.content).toBe(`<@&${roleId}>`);
  expect(sent[0]?.allowed_mentions?.roles).toEqual([roleId]);
  expect(sent[1]?.content).toBeUndefined();
  expect(sent[1]?.allowed_mentions?.roles).toEqual([]);
});

test("single-posting notifications include the role but untagged notifications do not", async () => {
  const sent: MessagePayload[] = [];
  const notifications = createDiscordNotifications(
    (_channelId, payload) => {
      sent.push(payload);
      return Promise.resolve({});
    },
    { discordToken: "offline-token", webUrl: "" }
  );
  const [posting] = postings;
  if (!posting) {
    throw new Error("Missing fixture");
  }
  await notifications.card(
    "channel",
    { detail: null, job: posting, match: null },
    "Web roles",
    roleId
  );
  await notifications.card(
    "channel",
    { detail: null, job: posting, match: null },
    "Web roles"
  );
  expect(sent[0]?.content).toBe(`<@&${roleId}>`);
  expect(sent[1]?.content).toBeUndefined();
  expect(sent[1]?.allowed_mentions?.parse).toEqual([]);
});

test("gateway delivery translates REST allowed_mentions into SDK allowedMentions", async () => {
  let sent: unknown;
  const client = {
    channels: {
      fetch: () =>
        Promise.resolve({
          isSendable: () => true,
          send: (payload: unknown) => {
            sent = payload;
            return Promise.resolve({ id: "message" });
          },
        }),
    },
  } as unknown as Client;
  await gatewayDeliverer(client)(
    "channel",
    roleNotification({ embeds: [] }, roleId)
  );
  expect(sent).toEqual({
    allowedMentions: {
      parse: [],
      repliedUser: false,
      roles: [roleId],
      users: [],
    },
    content: `<@&${roleId}>`,
    embeds: [],
  });
});
