// @kappa/db — drizzle schema + pg Pool DB layer shared by all apps.
export { createDb, runMigrations, closeDb, type GatewayDb } from './db';
export {
  guilds,
  channels,
  subscriptions,
  jobs,
  seenJobs,
  botConfig,
  fingerprintSnapshots,
  deliveryMessages,
  cvProfiles,
} from './schema/job-subscription';
export { users, discordConnections, sessions } from './schema/auth';
export type { JobPosting } from './types';
export { extractPdfText } from './pdf';
