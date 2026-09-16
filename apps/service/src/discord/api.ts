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
    scope: 'identify',
    state: args.state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Exchanges an authorize `code` for tokens. Throws on any failure. */
export async function exchangeCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
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
  const json = (await res.json()) as { access_token?: unknown };
  if (typeof json.access_token !== 'string' || !json.access_token) {
    throw new Error('discord token exchange returned no access_token');
  }
  return { accessToken: json.access_token };
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

/**
 * Best-effort Discord token revoke (spec §5). No-op by construction: the
 * service never persists Discord access/refresh tokens (sessions store only
 * the sha256 of our own opaque token), so there is nothing to revoke. Kept
 * as the named step so the account-delete cascade reads spec-exact.
 */
export async function revokeDiscordToken(): Promise<void> {
  // Intentionally empty — see above.
}
