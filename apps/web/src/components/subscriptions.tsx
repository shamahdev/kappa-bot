import { SUBSCRIPTION_SOURCES } from '@kappa/contracts';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { Badge, Button, ErrorNote, Select, StatusDot, TextInput } from './ui';
import {
  apiMessage,
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateSubscription,
  type SubscriptionDtoType,
} from '../lib/queries';
import { fonts, tokens } from '../theme.stylex';

export const subStyles = stylex.create({
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
  sub: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px', marginTop: 6 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', whiteSpace: 'nowrap' },
  inlinePanel: { padding: '14px', backgroundColor: tokens.surfaceSunken },
  inlineRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  inlineButtons: { display: 'flex', gap: 8, marginTop: 12 },
  summaryLine: { fontFamily: fonts.mono, fontSize: 13, color: tokens.ink, lineHeight: '20px' },
  empty: { padding: '28px 20px', textAlign: 'center' },
  emptyTitle: { fontFamily: fonts.sans, fontSize: 16, fontWeight: 700, color: tokens.ink },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, marginTop: 6 },
  errorGap: { marginTop: 12 },
});

export const detailStyles = stylex.create({
  back: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.muted,
    textDecoration: 'none',
    ':hover': { color: tokens.brand, textDecoration: 'underline' },
  },
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: '34px', color: tokens.ink, marginTop: 8 },
  tabsWrap: { marginTop: 16 },
  section: { marginTop: 24 },
  sectionTitle: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 700, color: tokens.ink, lineHeight: '22px' },
  stateLine: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, paddingTop: 24, paddingBottom: 24 },
});

export type OpenPanel = { id: number; mode: 'edit' | 'delete' } | null;

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CreateForm() {
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
      <div {...stylex.props(subStyles.formGrid)}>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <Select
            label="Source"
            value={source}
            onChange={setSource}
            options={[...SUBSCRIPTION_SOURCES]}
            disabled={create.isPending}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldGrow)}>
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
        <div {...stylex.props(subStyles.errorGap)}>
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
      <div {...stylex.props(subStyles.inlineRow)}>
        <div {...stylex.props(subStyles.formFieldGrow)}>
          <TextInput
            label="Keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <TextInput
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <TextInput
            label="Retention (days)"
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            disabled={update.isPending}
          />
        </div>
      </div>
      {update.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <ErrorNote>{apiMessage(update.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(subStyles.inlineButtons)}>
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
      <p {...stylex.props(subStyles.summaryLine)}>
        `{sub.source}` {sub.keywords ?? '—'} · {sub.location ?? '—'} →{' '}
        {sub.scope === 'dm' ? 'your DMs' : `#${sub.channelId}`}
      </p>
      <p {...stylex.props(subStyles.sub)}>Past deliveries stay deleted with it. This cannot be undone.</p>
      {remove.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <ErrorNote>{apiMessage(remove.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(subStyles.inlineButtons)}>
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
        <td {...stylex.props(subStyles.td)}>
          <Badge strong>{sub.source}</Badge>
        </td>
        <td {...stylex.props(subStyles.td)}>{sub.keywords ?? <span {...stylex.props(subStyles.muted)}>—</span>}</td>
        <td {...stylex.props(subStyles.td)}>{sub.location ?? <span {...stylex.props(subStyles.muted)}>—</span>}</td>
        <td {...stylex.props(subStyles.td)}>
          <Badge>{sub.scope === 'dm' ? 'DM' : 'Guild'}</Badge>{' '}
          {sub.scope === 'dm' ? (
            'Your DMs'
          ) : (
            <span {...stylex.props(subStyles.mono)} title={sub.channelId}>
              #{sub.channelId}
            </span>
          )}
          <br />
          <span {...stylex.props(subStyles.muted)}>{formatDate(sub.createdAt)}</span>
        </td>
        <td {...stylex.props(subStyles.td)}>
          <StatusDot on={sub.isActive} label={sub.isActive ? 'Active' : 'Paused'} />
        </td>
        <td {...stylex.props(subStyles.td)}>
          <div {...stylex.props(subStyles.actions)}>
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
            <div {...stylex.props(subStyles.errorGap)}>
              <ErrorNote>{apiMessage(update.error)}</ErrorNote>
            </div>
          ) : null}
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td {...stylex.props(subStyles.td, subStyles.inlinePanel)} colSpan={6}>
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

export function SubscriptionsTable({
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
      <div {...stylex.props(subStyles.tableScroll)}>
        <div {...stylex.props(subStyles.empty)}>
          <p {...stylex.props(subStyles.emptyTitle)}>{emptyTitle}</p>
          <p {...stylex.props(subStyles.emptyBody)}>{emptyBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div {...stylex.props(subStyles.tableScroll)}>
      <table {...stylex.props(subStyles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(subStyles.th)} scope="col">Source</th>
            <th {...stylex.props(subStyles.th)} scope="col">Keywords</th>
            <th {...stylex.props(subStyles.th)} scope="col">Location</th>
            <th {...stylex.props(subStyles.th)} scope="col">Delivers to</th>
            <th {...stylex.props(subStyles.th)} scope="col">Status</th>
            <th {...stylex.props(subStyles.th)} scope="col">
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
