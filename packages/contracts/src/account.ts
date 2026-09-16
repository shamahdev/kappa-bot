import { Schema } from 'effect';

// GET /account/summary — feeds the delete-account Brief (spec §5 + §7).
export const AccountSummary = Schema.Struct({
  discordId: Schema.String,
  username: Schema.String,
  dmSubscriptions: Schema.Number,
  guildSubscriptionsCreated: Schema.Number,
  connections: Schema.Array(Schema.String),
  sessionsActive: Schema.Number,
});
export type AccountSummary = typeof AccountSummary.Type;

export const DeleteAccountResponse = Schema.Struct({
  ok: Schema.Literal(true),
});
export type DeleteAccountResponse = typeof DeleteAccountResponse.Type;
