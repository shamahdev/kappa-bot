import discordSymbol from "../assets/brands/discord-symbol-white.svg";
import { ApiError, apiMessage, loginUrl } from "../lib/api";
import { Button as ShadcnButton } from "./shadcn/button";
import { ErrorNote, HStack, VStack } from "./ui";

export const DiscordLogin = ({
  label = "Log in with Discord",
  small = false,
}: {
  label?: string;
  small?: boolean;
}) => (
  <ShadcnButton asChild size={small ? "sm" : "default"} variant="discord">
    <a href={loginUrl}>
      <img
        alt=""
        aria-hidden="true"
        height="19"
        src={discordSymbol}
        width="25"
      />
      {label}
    </a>
  </ShadcnButton>
);

export const QueryError = ({ error }: { error: unknown }) =>
  error instanceof ApiError && error.isReconnectRequired ? (
    <VStack gap={3}>
      <ErrorNote>Server data needs a fresh Discord login.</ErrorNote>
      <HStack>
        <DiscordLogin label="Reconnect Discord" />
      </HStack>
    </VStack>
  ) : (
    <ErrorNote>{apiMessage(error)}</ErrorNote>
  );
