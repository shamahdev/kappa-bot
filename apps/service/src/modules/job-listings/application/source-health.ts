import {
  CONCRETE_SOURCES,
  linkedinCircuitCount,
  OPT_IN_SOURCES,
  SOURCE_COOKIE_ENV,
} from "../infrastructure/sources";

export interface SourceHealth {
  source: string;
  active: boolean;
  detail: string;
}

export const sourceHealth = (
  env: Record<string, string | undefined> = process.env
): SourceHealth[] => {
  const circuits = linkedinCircuitCount();
  return [
    ...CONCRETE_SOURCES.map((source) => ({
      active: true,
      detail:
        source === "linkedin" && circuits > 0
          ? `ready (circuit backing off on ${circuits} filter set(s))`
          : "ready",
      source,
    })),
    ...OPT_IN_SOURCES.map((source) => {
      const envName = SOURCE_COOKIE_ENV[source];
      const active = Boolean(env[envName]?.trim());
      return {
        active,
        detail: active
          ? "ready (cookies set)"
          : `not active — set ${envName} (see .env.example)`,
        source,
      };
    }),
  ];
};
