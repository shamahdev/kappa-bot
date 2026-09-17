import { SUBSCRIPTION_SOURCES } from '@kappa/contracts';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { Badge, Button, ErrorNote, Select, StatusDot, Tabs, TextInput } from '../../components/ui';
import { guildIconUrl, loginUrl } from '../../lib/api';
import {
  ApiError,
  apiMessage,
  useCreateSubscription,
  useDeleteSubscription,
  useGuilds,
  useMe,
  useSubscriptions,
  useUpdateSubscription,
  type GuildDtoType,
  type SubscriptionDtoType,
} from '../../lib/queries';
import { fonts, tokens } from '../../theme.stylex';

export const Route = createFileRoute('/dashboard/')({
  ssr: false,
  component: DashboardComponent,
});

const page = stylex.create({
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '34px', color: tokens.ink },
  sub: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px', marginTop: 6 },
  count: { fontFamily: fonts.mono, fontSize: 13, color: tokens.muted },
  tabsWrap: { marginTop: 16 },
  section: { marginTop: 28 },
  sectionTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, color: tokens.ink, lineHeight: '22px' },
  panel: {
    marginTop: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
    padding: 18,
  },
  formGrid: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
  formFieldGrow: { flex: '1 1 220px' },
  formFieldFixed: { flex: '0 1 180px' },
  tableScroll: {
    marginTop: 12,
    overflowX: 'auto',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
  },
  table: { width: '100%', minWidth: 760, borderCollapse: 'collapse', fontFamily: fonts.sans, fontSize: 14 },
  th: {
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: tokens.muted,
    padding: '10px 14px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.line,
    verticalAlign: 'top',
    color: tokens.ink,
    lineHeight: '20px',
  },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  muted: { color: tokens.muted },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', whiteSpace: 'nowrap' },
  inlinePanel: { padding: '14px', backgroundColor: tokens.surfaceSunken },
  inlineRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  inlineButtons: { display: 'flex', gap: 8, marginTop: 12 },
  summaryLine: { fontFamily: fonts.mono, fontSize: 13, color: tokens.ink, lineHeight: '20px' },
  empty: { padding: '28px 20px', textAlign: 'center' },
  emptyTitle: { fontFamily: fonts.sans, fontSize: 16, fontWeight: 700, color: tokens.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, marginTop: 6 },
  stateLine: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, paddingTop: 24, paddingBottom: 24 },
  errorGap: { marginTop: 12 },
  guildList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  guildBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
    padding: '10px 14px',
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 600,
    color: tokens.ink,
    ':hover': { backgroundColor: tokens.surfaceSunken },
  },
  guildBtnSelected: { backgroundColor: tokens.accentSoft, borderColor: tokens.accent },
  guildIcon: { width: 28, height: 28, borderRadius: tokens.radiusSm, flexShrink: 0 },
  guildIconFallback: {
    width: 28,
    height: 28,
    borderRadius: tokens.radiusSm,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.accent,
    color: tokens.accentInk,
    fontSize: 14,
    fontWeight: 800,
  },
  reconnectRow: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
});

type OpenPanel = { id: number; mode: 'edit' | 'delete' } | null;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function CreateForm() {
  const create = useCreateSubscription();
  const [source, setSource] = useState<string>(SUBSCRIPTION_SOURCES[0]);
  const [keywords, setKeywords] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.reset();
        create.mutate(
          { source, keywords: keywords.trim() },
          { onSuccess: () => setKeywords('') },
        );
      }}
    >
      <div {...stylex.props(page.formGrid)}>
        <div {...stylex.props(page.formFieldFixed)}>
          <Select
            label="Source"
            value={source}
            onChange={setSource}
            options={[...SUBSCRIPTION_SOURCES]}
            disabled={create.isPending}
          />
        </div>
        <div {...stylex.props(page.formFieldGrow)}>
          <TextInput
            label="Keywords"
            description="Delivered to your DMs."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. backend engineer golang"
            disabled={create.isPending}
          />
        </div>
        <Button type="submit" disabled={create.isPending || !keywords.trim()}>
          {create.isPending ? 'Creating…' : 'New DM subscription'}
        </Button>
      </div>
      {create.isError ? (
        <div {...stylex.props(page.errorGap)}>
          <ErrorNote>{apiMessage(create.error)}</ErrorNote>
        </div>
      ) : null}
    </form>
  );
}

function EditPanel({ sub, onDone }: { sub: SubscriptionDtoType; onDone: () => void }) {
  const update = useUpdateSubscription();
  const [keywords, setKeywords] = useState(sub.keywords ?? '');
  const [location, setLocation] = useState(sub.location ?? '');
  const [retentionDays, setRetentionDays] = useState(String(sub.retentionDays));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.reset();
        const retention = Number.parseInt(retentionDays, 10);
        update.mutate(
          {
            id: sub.id,
            patch: {
              keywords: keywords.trim(),
              location: location.trim(),
              retentionDays: Number.isInteger(retention) ? retention : undefined,
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div {...stylex.props(page.inlineRow)}>
        <div {...stylex.props(page.formFieldGrow)}>
          <TextInput
            label="Keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div {...stylex.props(page.formFieldFixed)}>
          <TextInput
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div {...stylex.props(page.formFieldFixed)}>
          <TextInput
            label="Retention (days)"
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            disabled={update.isPending}
          />
        </div>
      </div>
      {update.isError ? (
        <div {...stylex.props(page.errorGap)}>
          <ErrorNote>{apiMessage(update.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(page.inlineButtons)}>
        <Button type="submit" small disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" small variant="subtle" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeletePanel({ sub, onDone }: { sub: SubscriptionDtoType; onDone: () => void }) {
  const remove = useDeleteSubscription();
  return (
    <div>
      <p {...stylex.props(page.summaryLine)}>
        `{sub.source}` {sub.keywords ?? '—'} · {sub.location ?? '—'} →{' '}
        {sub.scope === 'dm' ? 'your DMs' : `#${sub.channelId}`}
      </p>
      <p {...stylex.props(page.sub)}>Past deliveries stay deleted with it. This cannot be undone.</p>
      {remove.isError ? (
        <div {...stylex.props(page.errorGap)}>
          <ErrorNote>{apiMessage(remove.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(page.inlineButtons)}>
        <Button
          small
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            remove.reset();
            remove.mutate(sub.id, { onSuccess: onDone });
          }}
        >
          {remove.isPending ? 'Deleting…' : 'Confirm delete'}
        </Button>
        <Button small variant="subtle" onClick={onDone} disabled={remove.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SubscriptionRow({
  sub,
  open,
  setOpen,
}: {
  sub: SubscriptionDtoType;
  open: OpenPanel;
  setOpen: (open: OpenPanel) => void;
}) {
  const update = useUpdateSubscription();
  const isOpen = open?.id === sub.id;

  return (
    <>
      <tr>
        <td {...stylex.props(page.td)}>
          <Badge strong>{sub.source}</Badge>
        </td>
        <td {...stylex.props(page.td)}>{sub.keywords ?? <span {...stylex.props(page.muted)}>—</span>}</td>
        <td {...stylex.props(page.td)}>{sub.location ?? <span {...stylex.props(page.muted)}>—</span>}</td>
        <td {...stylex.props(page.td)}>
          <Badge>{sub.scope === 'dm' ? 'DM' : 'Guild'}</Badge>{' '}
          {sub.scope === 'dm' ? (
            'Your DMs'
          ) : (
            <span {...stylex.props(page.mono)} title={sub.channelId}>
              #{sub.channelId}
            </span>
          )}
          <br />
          <span {...stylex.props(page.muted)}>{formatDate(sub.createdAt)}</span>
        </td>
        <td {...stylex.props(page.td)}>
          <StatusDot on={sub.isActive} label={sub.isActive ? 'Active' : 'Paused'} />
        </td>
        <td {...stylex.props(page.td)}>
          <div {...stylex.props(page.actions)}>
            <Button
              small
              variant="subtle"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: sub.id, patch: { isActive: !sub.isActive } })
              }
            >
              {sub.isActive ? 'Pause' : 'Resume'}
            </Button>
            <Button small variant="subtle" onClick={() => setOpen(isOpen && open.mode === 'edit' ? null : { id: sub.id, mode: 'edit' })}>
              Edit
            </Button>
            <Button small variant="dangerSubtle" onClick={() => setOpen(isOpen && open.mode === 'delete' ? null : { id: sub.id, mode: 'delete' })}>
              Delete
            </Button>
          </div>
          {update.isError ? (
            <div {...stylex.props(page.errorGap)}>
              <ErrorNote>{apiMessage(update.error)}</ErrorNote>
            </div>
          ) : null}
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td {...stylex.props(page.td, page.inlinePanel)} colSpan={6}>
            {open.mode === 'edit' ? (
              <EditPanel sub={sub} onDone={() => setOpen(null)} />
            ) : (
              <DeletePanel sub={sub} onDone={() => setOpen(null)} />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SubscriptionsTable({
  subs,
  open,
  setOpen,
  emptyTitle,
  emptyBody,
}: {
  subs: readonly SubscriptionDtoType[];
  open: OpenPanel;
  setOpen: (open: OpenPanel) => void;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (subs.length === 0) {
    return (
      <div {...stylex.props(page.tableScroll)}>
        <div {...stylex.props(page.empty)}>
          <p {...stylex.props(page.emptyTitle)}>{emptyTitle}</p>
          <p {...stylex.props(page.emptyBody)}>{emptyBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div {...stylex.props(page.tableScroll)}>
      <table {...stylex.props(page.table)}>
        <thead>
          <tr>
            <th {...stylex.props(page.th)} scope="col">Source</th>
            <th {...stylex.props(page.th)} scope="col">Keywords</th>
            <th {...stylex.props(page.th)} scope="col">Location</th>
            <th {...stylex.props(page.th)} scope="col">Delivers to</th>
            <th {...stylex.props(page.th)} scope="col">Status</th>
            <th {...stylex.props(page.th)} scope="col">
              <span style={{ display: 'inline-block', width: '100%', textAlign: 'right' }}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subs.map((sub) => (
            <SubscriptionRow key={sub.id} sub={sub} open={open} setOpen={setOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DmTab({ signedIn }: { signedIn: boolean }) {
  const subs = useSubscriptions(signedIn);
  const [open, setOpen] = useState<OpenPanel>(null);
  const dmSubs = subs.data?.filter((s) => s.scope === 'dm') ?? [];

  return (
    <div>
      <div {...stylex.props(page.head)}>
        <h1 {...stylex.props(page.title)}>Subscriptions</h1>
        {subs.data ? (
          <span {...stylex.props(page.count)}>
            {dmSubs.length} subscription{dmSubs.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <section {...stylex.props(page.section)} aria-label="New DM subscription">
        <h2 {...stylex.props(page.sectionTitle)}>New</h2>
        <div {...stylex.props(page.panel)}>
          <CreateForm />
        </div>
      </section>

      <section {...stylex.props(page.section)} aria-label="DM subscriptions">
        {subs.isPending ? (
          <p {...stylex.props(page.stateLine)}>Loading…</p>
        ) : subs.isError ? (
          <div {...stylex.props(page.errorGap)}>
            <ErrorNote>{apiMessage(subs.error)}</ErrorNote>
          </div>
        ) : (
          <SubscriptionsTable
            subs={dmSubs}
            open={open}
            setOpen={setOpen}
            emptyTitle="No subscriptions yet"
            emptyBody="Create one above."
          />
        )}
      </section>
    </div>
  );
}

function GuildPicker({
  guilds,
  selectedId,
  onSelect,
}: {
  guilds: readonly GuildDtoType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div {...stylex.props(page.guildList)} role="listbox" aria-label="Servers">
      {guilds.map((g) => {
        const icon = guildIconUrl(g.id, g.icon);
        const selected = g.id === selectedId;
        return (
          <button
            key={g.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(g.id)}
            {...stylex.props(page.guildBtn, selected && page.guildBtnSelected)}
          >
            {icon ? (
              <img {...stylex.props(page.guildIcon)} src={icon} alt="" loading="lazy" />
            ) : (
              <span {...stylex.props(page.guildIconFallback)} aria-hidden>
                {g.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

function ServersTab({ signedIn }: { signedIn: boolean }) {
  const guilds = useGuilds(signedIn);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenPanel>(null);
  const subs = useSubscriptions(signedIn && guildId !== null, guildId ?? undefined);

  useEffect(() => {
    if (guildId === null && guilds.data && guilds.data.length > 0) {
      setGuildId(guilds.data[0].id);
    }
  }, [guildId, guilds.data]);

  if (guilds.isPending) return <p {...stylex.props(page.stateLine)}>Loading servers…</p>;
  if (guilds.isError) {
    if (guilds.error instanceof ApiError && guilds.error.isReconnectRequired) {
      return (
        <div>
          <p {...stylex.props(page.stateLine)}>Server access needs a fresh Discord login.</p>
          <div {...stylex.props(page.reconnectRow)}>
            <Button onClick={() => void (window.location.href = loginUrl)}>
              Reconnect Discord
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div {...stylex.props(page.errorGap)}>
        <ErrorNote>{apiMessage(guilds.error)}</ErrorNote>
      </div>
    );
  }
  if (guilds.data.length === 0) {
    return (
      <div {...stylex.props(page.tableScroll)}>
        <div {...stylex.props(page.empty)}>
          <p {...stylex.props(page.emptyTitle)}>No servers found</p>
          <p {...stylex.props(page.emptyBody)}>Install the bot and keep Manage Server.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <GuildPicker
        guilds={guilds.data}
        selectedId={guildId}
        onSelect={(id) => {
          setGuildId(id);
          setOpen(null);
        }}
      />
      <section {...stylex.props(page.section)} aria-label="Server subscriptions">
        {subs.isPending ? (
          <p {...stylex.props(page.stateLine)}>Loading…</p>
        ) : subs.isError ? (
          <div {...stylex.props(page.errorGap)}>
            <ErrorNote>{apiMessage(subs.error)}</ErrorNote>
          </div>
        ) : (
          <SubscriptionsTable
            subs={subs.data}
            open={open}
            setOpen={setOpen}
            emptyTitle="No subscriptions here yet"
            emptyBody="Run /jobs subscribe in the server."
          />
        )}
      </section>
    </div>
  );
}

function DashboardComponent() {
  const navigate = useNavigate();
  const me = useMe();
  const [tab, setTab] = useState('dm');

  useEffect(() => {
    if (me.data === null) void navigate({ to: '/' });
  }, [me.data, navigate]);

  if (me.isPending || me.data === null) {
    return <p {...stylex.props(page.stateLine)}>Loading…</p>;
  }

  return (
    <div>
      <div {...stylex.props(page.tabsWrap)}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'dm', label: 'DM' },
            { value: 'servers', label: 'Servers' },
          ]}
        />
      </div>
      <div {...stylex.props(page.section)}>
        {tab === 'servers' ? <ServersTab signedIn /> : <DmTab signedIn />}
      </div>
    </div>
  );
}
