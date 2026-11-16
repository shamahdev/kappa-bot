import { Schema } from "effect";

/** Discord OAuth flow: requested at login and required again on every guild access check. */
export const OAUTH_SCOPES = "identify guilds" as const;

/** Session lifetime in days; the cookie Max-Age and the token TTL both derive from this. */
export const SESSION_TTL_DAYS = 30;

export const UserDto = Schema.Struct({
  avatar: Schema.NullOr(Schema.String),
  discordId: Schema.String,
  username: Schema.String,
});
export type UserDtoType = typeof UserDto.Type;

export const AuthMeResponse = Schema.Struct({
  user: UserDto,
});
export type AuthMeResponseType = typeof AuthMeResponse.Type;
