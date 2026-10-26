import { Schema } from "effect";

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
