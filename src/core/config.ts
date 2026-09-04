import 'dotenv/config';

export type BotRole = 'gateway' | 'worker';

export type AppConfig = {
  discordToken: string;
  clientId: string;
  guildId: string;
  databaseUrl: string;
  databaseUrlUnpooled: string;
  port: number;
  logLevel: string;
  botRole: BotRole;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

export function loadConfig(): AppConfig {
  const botRole = (process.env.BOT_ROLE ?? 'gateway') as BotRole;
  if (botRole !== 'gateway' && botRole !== 'worker') {
    throw new Error(`BOT_ROLE must be gateway|worker, got "${botRole}"`);
  }
  return {
    discordToken: required('DISCORD_TOKEN'),
    clientId: process.env.CLIENT_ID ?? '',
    guildId: process.env.GUILD_ID ?? '',
    databaseUrl: required('DATABASE_URL'),
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? '',
    port: Number(process.env.PORT ?? 3000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    botRole,
  };
}
