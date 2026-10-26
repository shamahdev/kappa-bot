import "dotenv/config";
import { PATHS } from "@kappa/contracts";

export interface ServiceConfig {
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
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (see .env.example)`);
  }
  return value;
};

const stripTrailingSlash = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

export const loadServiceConfig = (): ServiceConfig => ({
  clientId: required("CLIENT_ID"),
  clientSecret: required("DISCORD_CLIENT_SECRET"),
  databaseUrl: required("DATABASE_URL"),
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? "",
  discordToken: required("DISCORD_TOKEN"),
  isProd: process.env.NODE_ENV === "production",
  logLevel: process.env.LOG_LEVEL ?? "info",
  port: Number(process.env.PORT ?? 3443),
  redirectPath: process.env.DISCORD_REDIRECT_PATH ?? PATHS.authCallback,
  serviceUrl: stripTrailingSlash(required("SERVICE_URL")),
  sessionSecret: required("SESSION_SECRET"),
  webUrl: stripTrailingSlash(required("WEB_URL")),
});
