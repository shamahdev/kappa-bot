// Raw Discord HTTP calls (service owns OAuth + DM-channel ensure; no discord.js
// dependency here — plain fetch with Bot/OAuth credentials is enough).

import { setTimeout as sleep } from "node:timers/promises";

const API = "https://discord.com/api/v10";

/**
 * Discord rejected the credentials (401/403): the user grant is dead,
 * revoked, or lacks the scope — re-login is the only remedy. Callers map
 * this to 409 RECONNECT_REQUIRED, never to a retryable 502.
 */
export class DiscordAuthError extends Error {
  readonly discordStatus: 401 | 403;
  constructor(discordStatus: 401 | 403, what: string) {
    super(`discord ${what} rejected the token (http ${discordStatus})`);
    this.name = "DiscordAuthError";
    this.discordStatus = discordStatus;
  }
}

/** Seconds from a `Retry-After` header, clamped to [0, 5]. */
const retryAfterSeconds = (res: Response): number => {
  const raw = res.headers.get("retry-after");
  const secs = raw === null ? Number.NaN : Number(raw);
  if (!Number.isFinite(secs) || secs < 0) {
    return 1;
  }
  return Math.min(secs, 5);
};

/**
 * Discord fetch with rate-limit/auth handling. 429s are retried once after
 * `Retry-After` (safe for every call: a 429 is never processed server-side).
 * 401/403 throw DiscordAuthError (caller: 409, never retried). When
 * `retryTransport` is set (idempotent calls only), one retry also covers
 * network failures and Discord 5xx. Anything else throws a plain Error.
 */
const discordFetch = async (
  url: string,
  init: RequestInit,
  what: string,
  retryTransport: boolean
): Promise<Response> => {
  let transportRetries = retryTransport ? 1 : 0;
  for (;;) {
    let res: Response;
    try {
      // Retry decisions depend on the previous response; requests must remain serial.
      // oxlint-disable-next-line no-await-in-loop
      res = await fetch(url, init);
    } catch (error) {
      if (transportRetries > 0) {
        transportRetries -= 1;
        // Preserve transport backoff before the one permitted retry.
        // oxlint-disable-next-line no-await-in-loop
        await sleep(300);
        continue;
      }
      throw new Error(`discord ${what} unreachable (${String(error)})`, {
        cause: error,
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new DiscordAuthError(res.status, what);
    }
    if (res.status === 429) {
      // Honor Discord's Retry-After before retrying a rate-limited request.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(retryAfterSeconds(res) * 1000);
      // The rate-limit retry can only start after the required delay.
      // oxlint-disable-next-line no-await-in-loop
      const retry = await fetch(url, init).catch((error: unknown) => {
        throw new Error(`discord ${what} unreachable (${String(error)})`);
      });
      if (retry.status === 401 || retry.status === 403) {
        throw new DiscordAuthError(retry.status, what);
      }
      // Second 429/5xx: caller maps to 502, honestly rate-limited.
      return retry;
    }
    if (res.status >= 500 && transportRetries > 0) {
      transportRetries -= 1;
      // Preserve server-error backoff before the one permitted transport retry.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(500);
      continue;
    }
    return res;
  }
};

export interface DiscordMe {
  id: string;
  username: string;
  avatar: string | null;
}

export const authorizeUrl = (args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string => {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state: args.state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
};

export interface DiscordTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

const readTokens = (json: unknown, what: string): DiscordTokens => {
  const { access_token, refresh_token, expires_in } = (json ?? {}) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof access_token !== "string" ||
    !access_token ||
    typeof refresh_token !== "string" ||
    !refresh_token ||
    typeof expires_in !== "number"
  ) {
    throw new Error(`discord ${what} returned an unexpected shape`);
  }
  return {
    accessToken: access_token,
    expiresAt: new Date(Date.now() + expires_in * 1000),
    refreshToken: refresh_token,
  };
};

/** Exchanges an authorize `code` for tokens. Throws on any failure. */
export const exchangeCode = async (args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<DiscordTokens> => {
  const res = await discordFetch(
    `${API}/oauth2/token`,
    {
      body: new URLSearchParams({
        client_id: args.clientId,
        client_secret: args.clientSecret,
        code: args.code,
        grant_type: "authorization_code",
        redirect_uri: args.redirectUri,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token exchange",
    false
  );
  if (!res.ok) {
    throw new Error(`discord token exchange failed (http ${res.status})`);
  }
  return readTokens(await res.json(), "token exchange");
};

/** Refreshes an expired user access token. Throws on any failure. */
export const refreshAccessToken = async (args: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<DiscordTokens> => {
  const res = await discordFetch(
    `${API}/oauth2/token`,
    {
      body: new URLSearchParams({
        client_id: args.clientId,
        client_secret: args.clientSecret,
        grant_type: "refresh_token",
        refresh_token: args.refreshToken,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token refresh",
    false
  );
  if (!res.ok) {
    throw new Error(`discord token refresh failed (http ${res.status})`);
  }
  return readTokens(await res.json(), "token refresh");
};

/** Fetches the OAuth user's profile (`identify` scope). Throws on failure. */
export const fetchMe = async (accessToken: string): Promise<DiscordMe> => {
  const res = await discordFetch(
    `${API}/users/@me`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    "/users/@me",
    true
  );
  if (!res.ok) {
    throw new Error(`discord /users/@me failed (http ${res.status})`);
  }
  const json = (await res.json()) as {
    id?: unknown;
    username?: unknown;
    avatar?: unknown;
  };
  if (typeof json.id !== "string" || typeof json.username !== "string") {
    throw new TypeError("discord /users/@me returned an unexpected shape");
  }
  return {
    avatar: typeof json.avatar === "string" ? json.avatar : null,
    id: json.id,
    username: json.username,
  };
};

/**
 * Ensures the bot↔user DM channel (`POST /users/@me/channels`). Idempotent:
 * Discord returns the existing channel when one is already open. Throws on failure.
 */
export const ensureDmChannel = async (
  botToken: string,
  recipientId: string
): Promise<{ id: string }> => {
  const res = await discordFetch(
    `${API}/users/@me/channels`,
    {
      body: JSON.stringify({ recipient_id: recipientId }),
      headers: {
        authorization: `Bot ${botToken}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
    "DM channel create",
    true
  );
  if (!res.ok) {
    throw new Error(`discord DM channel create failed (http ${res.status})`);
  }
  const json = (await res.json()) as { id?: unknown };
  if (typeof json.id !== "string") {
    throw new TypeError("discord DM channel create returned no id");
  }
  return { id: json.id };
};

export interface DiscordGuildEntry {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/**
 * Lists the OAuth user's guilds (`guilds` scope). Throws DiscordAuthError
 * when Discord rejects the token (grant predates the scope, was revoked,
 * or expired unrefreshably); other failures throw a plain Error.
 */
export const fetchUserGuilds = async (
  accessToken: string
): Promise<DiscordGuildEntry[]> => {
  const res = await discordFetch(
    `${API}/users/@me/guilds`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    "/users/@me/guilds",
    true
  );
  if (!res.ok) {
    throw new Error(`discord /users/@me/guilds failed (http ${res.status})`);
  }
  const json = (await res.json()) as {
    id?: unknown;
    name?: unknown;
    icon?: unknown;
    owner?: unknown;
    permissions?: unknown;
  }[];
  if (!Array.isArray(json)) {
    throw new TypeError("discord /users/@me/guilds returned a non-array");
  }
  return json.map((g) => {
    if (
      typeof g.id !== "string" ||
      typeof g.name !== "string" ||
      typeof g.permissions !== "string"
    ) {
      throw new TypeError(
        "discord /users/@me/guilds returned an unexpected shape"
      );
    }
    return {
      icon: typeof g.icon === "string" ? g.icon : null,
      id: g.id,
      name: g.name,
      owner: g.owner === true,
      permissions: g.permissions,
    };
  });
};

/** Lists guild ids the bot itself is installed in. Throws on failure. */
export const fetchBotGuildIds = async (
  botToken: string
): Promise<Set<string>> => {
  const res = await discordFetch(
    `${API}/users/@me/guilds`,
    { headers: { authorization: `Bot ${botToken}` } },
    "bot guild list",
    true
  );
  if (!res.ok) {
    throw new Error(`discord bot guild list failed (http ${res.status})`);
  }
  const json = (await res.json()) as { id?: unknown }[];
  if (!Array.isArray(json)) {
    throw new TypeError("discord bot guild list returned a non-array");
  }
  return new Set(
    json.map((g) => {
      if (typeof g.id !== "string") {
        throw new TypeError(
          "discord bot guild list returned an unexpected shape"
        );
      }
      return g.id;
    })
  );
};

/**
 * Best-effort Discord token revoke: revokes the user's stored OAuth
 * token during account delete. Failures are swallowed by the caller — the
 * local cascade never depends on Discord answering.
 */
export const revokeDiscordToken = async (args: {
  clientId: string;
  clientSecret: string;
  token: string | null;
}): Promise<void> => {
  if (!args.token) {
    // Pre-guilds login: nothing persisted to revoke.
    return;
  }
  const res = await discordFetch(
    `${API}/oauth2/token/revoke`,
    {
      body: new URLSearchParams({
        client_id: args.clientId,
        client_secret: args.clientSecret,
        token: args.token,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token revoke",
    false
  );
  if (!res.ok) {
    throw new Error(`discord token revoke failed (http ${res.status})`);
  }
};
