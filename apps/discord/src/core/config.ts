import "dotenv/config";

export type BotRole = "gateway" | "worker";

export interface AppConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  databaseUrl: string;
  databaseUrlUnpooled: string;
  logLevel: string;
  botRole: BotRole;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example)`);
  }
  return value;
};

export const loadConfig = (): AppConfig => {
  const botRole = (process.env.BOT_ROLE ?? "gateway") as BotRole;
  if (botRole !== "gateway" && botRole !== "worker") {
    throw new Error(`BOT_ROLE must be gateway|worker, got "${botRole}"`);
  }
  return {
    botRole,
    clientId: process.env.CLIENT_ID ?? "",
    databaseUrl: required("DATABASE_URL"),
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? "",
    discordToken: required("DISCORD_TOKEN"),
    guildId: process.env.GUILD_ID ?? "",
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
};
