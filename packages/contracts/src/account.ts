import { Schema } from "effect";

// Account summary includes personal data and historical server creation counts.
export const AccountSummary = Schema.Struct({
  connections: Schema.Array(Schema.String),
  discordId: Schema.String,
  dmSubscriptions: Schema.Number,
  guildSubscriptionsCreated: Schema.Number,
  sessionsActive: Schema.Number,
  username: Schema.String,
});
export type AccountSummaryType = typeof AccountSummary.Type;

export const DeleteAccountResponse = Schema.Struct({
  ok: Schema.Literal(true),
});
export type DeleteAccountResponseType = typeof DeleteAccountResponse.Type;
