import { SUBSCRIPTION_SOURCES } from '@kappa/contracts';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { Badge, Button, ErrorNote, Field, InfoNote, Select, StatusDot, TextInput } from '../../components/ui';
import {
  apiMessage,
  useCreateSubscription,
  useDeleteSubscription,
  useMe,
  useSubscriptions,
  useUpdateSubscription,
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
});

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
          <Field label="Source">
            <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={create.isPending}>
              {SUBSCRIPTION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div {...stylex.props(page.formFieldGrow)}>
          <Field label="Keywords" hint="Delivered to your Discord DMs. Location defaults to Indonesia.">
            <TextInput
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. backend engineer golang"
              disabled={create.isPending}
              maxLength={200}
            />
          </Field>
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
          <Field label="Keywords">
            <TextInput
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={update.isPending}
              maxLength={200}
            />
          </Field>
        </div>
        <div {...stylex.props(page.formFieldFixed)}>
          <Field label="Location">
            <TextInput
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={update.isPending}
              maxLength={120}
            />
          </Field>
        </div>
        <div {...stylex.props(page.formFieldFixed)}>
          <Field label="Retention (days)">
            <TextInput
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              disabled={update.isPending}
              inputMode="numeric"
            />
          </Field>
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
  open: { id: number; mode: 'edit' | 'delete' } | null;
  setOpen: (open: { id: number; mode: 'edit' | 'delete' } | null) => void;
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

function DashboardComponent() {
  const navigate = useNavigate();
  const me = useMe();
  const subs = useSubscriptions(me.data != null);
  const [open, setOpen] = useState<{ id: number; mode: 'edit' | 'delete' } | null>(null);

  useEffect(() => {
    if (me.data === null) void navigate({ to: '/' });
  }, [me.data, navigate]);

  if (me.isPending || me.data === null) {
    return <p {...stylex.props(page.stateLine)}>Loading your dashboard…</p>;
  }

  return (
    <div>
      <div {...stylex.props(page.head)}>
        <div>
          <h1 {...stylex.props(page.title)}>Subscriptions</h1>
          <p {...stylex.props(page.sub)}>
            DM subscriptions plus servers you created. Guild subscriptions are created with{' '}
            <span {...stylex.props(page.mono)}>/jobs</span> in Discord.
          </p>
        </div>
        {subs.data ? (
          <span {...stylex.props(page.count)}>
            {subs.data.length} subscription{subs.data.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <section {...stylex.props(page.section)} aria-label="New DM subscription">
        <h2 {...stylex.props(page.sectionTitle)}>New DM subscription</h2>
        <div {...stylex.props(page.panel)}>
          <CreateForm />
        </div>
      </section>

      <section {...stylex.props(page.section)} aria-label="Your subscriptions">
        <h2 {...stylex.props(page.sectionTitle)}>Your subscriptions</h2>
        {subs.isPending ? (
          <p {...stylex.props(page.stateLine)}>Loading subscriptions…</p>
        ) : subs.isError ? (
          <div {...stylex.props(page.errorGap)}>
            <ErrorNote>{apiMessage(subs.error)}</ErrorNote>
          </div>
        ) : subs.data.length === 0 ? (
          <div {...stylex.props(page.tableScroll)}>
            <div {...stylex.props(page.empty)}>
              <p {...stylex.props(page.emptyTitle)}>No subscriptions yet</p>
              <p {...stylex.props(page.emptyBody)}>
                Create a DM subscription above, or run <span {...stylex.props(page.mono)}>/jobs subscribe</span> in
                Discord for server channels.
              </p>
            </div>
          </div>
        ) : (
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
                {subs.data.map((sub) => (
                  <SubscriptionRow key={sub.id} sub={sub} open={open} setOpen={setOpen} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section {...stylex.props(page.section)} aria-label="Danger zone hint">
        <InfoNote>
          Leaving Kappa? <Link to="/dashboard/settings">Delete your account</Link> from settings —
          it removes your account, connections, DM data, and subscriptions you created.
        </InfoNote>
      </section>
    </div>
  );
}
