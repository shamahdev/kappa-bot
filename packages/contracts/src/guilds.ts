import { Schema } from 'effect';

// Guild where the user can manage subscriptions: bot is installed AND the user
// holds ManageGuild (or Administrator, or owns it). `icon` is the Discord hash
// (null when unset); web builds the CDN URL. `permissions` is the user's
// permission bitfield as Discord returns it (stringified int).
export const GuildDto = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  icon: Schema.NullOr(Schema.String),
  permissions: Schema.String,
});
export type GuildDto = typeof GuildDto.Type;

export const GuildsResponse = Schema.Struct({
  guilds: Schema.Array(GuildDto),
});
export type GuildsResponse = typeof GuildsResponse.Type;
