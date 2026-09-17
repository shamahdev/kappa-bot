// Raw Discord HTTP calls (service owns OAuth + DM-channel ensure; no discord.js
// dependency here — plain fetch with Bot/OAuth credentials is enough).

const API = 'https://discord.com/api/v10';

export type DiscordMe = {
  id: string;
  username: string;
  avatar: string | null;
};

export function authorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state: args.state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export type DiscordTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

function readTokens(json: unknown, what: string): DiscordTokens {
  const { access_token, refresh_token, expires_in } = (json ?? {}) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof access_token !== 'string' ||
    !access_token ||
    typeof refresh_token !== 'string' ||
    !refresh_token ||
    typeof expires_in !== 'number'
  ) {
    throw new Error(`discord ${what} returned an unexpected shape`);
  }
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(Date.now() + expires_in * 1000),
  };
}

/** Exchanges an authorize `code` for tokens. Throws on any failure. */
export async function exchangeCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<DiscordTokens> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: args.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`discord token exchange failed (http ${res.status})`);
  return readTokens(await res.json(), 'token exchange');
}

/** Refreshes an expired user access token. Throws on any failure. */
export async function refreshAccessToken(args: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<DiscordTokens> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`discord token refresh failed (http ${res.status})`);
  return readTokens(await res.json(), 'token refresh');
}

/** Fetches the OAuth user's profile (`identify` scope). Throws on failure. */
export async function fetchMe(accessToken: string): Promise<DiscordMe> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`discord /users/@me failed (http ${res.status})`);
  const json = (await res.json()) as { id?: unknown; username?: unknown; avatar?: unknown };
  if (typeof json.id !== 'string' || typeof json.username !== 'string') {
    throw new Error('discord /users/@me returned an unexpected shape');
  }
  return {
    id: json.id,
    username: json.username,
    avatar: typeof json.avatar === 'string' ? json.avatar : null,
  };
}

/**
 * Ensures the bot↔user DM channel (`POST /users/@me/channels`). Idempotent:
 * Discord returns the existing channel when one is already open. Throws on failure.
 */
export async function ensureDmChannel(botToken: string, recipientId: string): Promise<{ id: string }> {
  const res = await fetch(`${API}/users/@me/channels`, {
    method: 'POST',
    headers: { authorization: `Bot ${botToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ recipient_id: recipientId }),
  });
  if (!res.ok) throw new Error(`discord DM channel create failed (http ${res.status})`);
  const json = (await res.json()) as { id?: unknown };
  if (typeof json.id !== 'string') throw new Error('discord DM channel create returned no id');
  return { id: json.id };
}

export type DiscordGuildEntry = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

/** Lists the OAuth user's guilds (`guilds` scope). Throws on failure. */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuildEntry[]> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`discord /users/@me/guilds failed (http ${res.status})`);
  const json = (await res.json()) as Array<{
    id?: unknown;
    name?: unknown;
    icon?: unknown;
    owner?: unknown;
    permissions?: unknown;
  }>;
  if (!Array.isArray(json)) throw new Error('discord /users/@me/guilds returned a non-array');
  return json.map((g) => {
    if (typeof g.id !== 'string' || typeof g.name !== 'string' || typeof g.permissions !== 'string') {
      throw new Error('discord /users/@me/guilds returned an unexpected shape');
    }
    return {
      id: g.id,
      name: g.name,
      icon: typeof g.icon === 'string' ? g.icon : null,
      owner: g.owner === true,
      permissions: g.permissions,
    };
  });
}

/** Lists guild ids the bot itself is installed in. Throws on failure. */
export async function fetchBotGuildIds(botToken: string): Promise<Set<string>> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { authorization: `Bot ${botToken}` },
  });
  if (!res.ok) throw new Error(`discord bot guild list failed (http ${res.status})`);
  const json = (await res.json()) as Array<{ id?: unknown }>;
  if (!Array.isArray(json)) throw new Error('discord bot guild list returned a non-array');
  return new Set(
    json.map((g) => {
      if (typeof g.id !== 'string') throw new Error('discord bot guild list returned an unexpected shape');
      return g.id;
    }),
  );
}

/**
 * Best-effort Discord token revoke (spec §5): revokes the user's stored OAuth
 * token during account delete. Failures are swallowed by the caller — the
 * local cascade never depends on Discord answering.
 */
export async function revokeDiscordToken(args: {
  clientId: string;
  clientSecret: string;
  token: string | null;
}): Promise<void> {
  if (!args.token) return; // pre-guilds login: nothing persisted to revoke
  const res = await fetch(`${API}/oauth2/token/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      token: args.token,
    }),
  });
  if (!res.ok) throw new Error(`discord token revoke failed (http ${res.status})`);
}
