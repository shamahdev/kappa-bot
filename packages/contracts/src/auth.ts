import { Schema } from 'effect';

export const UserDto = Schema.Struct({
  discordId: Schema.String,
  username: Schema.String,
  avatar: Schema.NullOr(Schema.String),
});
export type UserDto = typeof UserDto.Type;

export const AuthMeResponse = Schema.Struct({
  user: UserDto,
});
export type AuthMeResponse = typeof AuthMeResponse.Type;
