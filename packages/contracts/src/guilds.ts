import { Schema } from "effect";

// Guild where the user can manage subscriptions: bot is installed AND the user
// holds ManageGuild (or Administrator, or owns it). `icon` is the Discord hash
// (null when unset); web builds the CDN URL. `permissions` is the user's
// permission bitfield as Discord returns it (stringified int).
export const GuildDto = Schema.Struct({
  icon: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.String,
  permissions: Schema.String,
  subscriptions: Schema.Struct({
    active: Schema.Number,
    total: Schema.Number,
  }),
});
export type GuildDtoType = typeof GuildDto.Type;

export const GuildsResponse = Schema.Struct({
  guilds: Schema.Array(GuildDto),
});
export type GuildsResponseType = typeof GuildsResponse.Type;
