import 'dotenv/config';
import { PATHS } from '@kappa/contracts';

export type ServiceConfig = {
  discordToken: string;
  clientId: string;
  clientSecret: string;
  databaseUrl: string;
  databaseUrlUnpooled: string;
  port: number;
  logLevel: string;
  isProd: boolean;
  serviceUrl: string;
  webUrl: string;
  sessionSecret: string;
  redirectPath: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function loadServiceConfig(): ServiceConfig {
  return {
    discordToken: required('DISCORD_TOKEN'),
    clientId: required('CLIENT_ID'),
    clientSecret: required('DISCORD_CLIENT_SECRET'),
    databaseUrl: required('DATABASE_URL'),
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? '',
    port: Number(process.env.PORT ?? 3443),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    isProd: process.env.NODE_ENV === 'production',
    serviceUrl: stripTrailingSlash(required('SERVICE_URL')),
    webUrl: stripTrailingSlash(required('WEB_URL')),
    sessionSecret: required('SESSION_SECRET'),
    redirectPath: process.env.DISCORD_REDIRECT_PATH ?? PATHS.authCallback,
  };
}
