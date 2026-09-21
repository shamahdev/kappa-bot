import { CV_MAX_CHARS, CV_MIN_CHARS } from '@kappa/contracts';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { fonts, tokens } from '../theme.stylex';
import { apiMessage, useCv, useDeleteCv, useSaveCv } from '../lib/queries';
import { formatDate } from './subscriptions';
import { Button, ErrorNote, QueryError } from './ui';

const CV_MAX_UPLOAD_BYTES = 512_000;

const cvStyles = stylex.create({
  status: { fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, lineHeight: '21px' },
  strong: { color: tokens.ink, fontWeight: 700 },
  area: {
    width: '100%',
    minHeight: 180,
    boxSizing: 'border-box',
    marginTop: 12,
    padding: '10px 12px',
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: '20px',
    color: tokens.ink,
    backgroundColor: tokens.surfaceSunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tokens.lineStrong,
    borderRadius: tokens.radiusSm,
  },
  count: { fontFamily: fonts.sans, fontSize: 13, color: tokens.muted, marginTop: 8 },
  countBad: { color: tokens.danger },
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
  file: { fontFamily: fonts.sans, fontSize: 13, color: tokens.muted },
  buttons: { display: 'flex', gap: 8, marginTop: 12 },
  errorGap: { marginTop: 12 },
});

/** Personal CV editor: paste text or upload .txt/.md. Rendered on the DM page only. */
export function CvPanel() {
  const cv = useCv(true);
  const save = useSaveCv();
  const remove = useDeleteCv();
  const [draft, setDraft] = useState<string | null>(null); // null = pristine stored text
  const [filename, setFilename] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  if (cv.isPending) return <p {...stylex.props(cvStyles.status)}>Loading…</p>;
  if (cv.isError) return <QueryError error={cv.error} />;

  const stored = cv.data.text ?? '';
  const shown = draft ?? stored;
  const count = shown.trim().length;
  const valid = count >= CV_MIN_CHARS && count <= CV_MAX_CHARS;
  const busy = save.isPending || remove.isPending;

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.txt') && !lower.endsWith('.md')) {
      setFileError(
        lower.endsWith('.pdf')
          ? 'PDF CVs are not supported yet — upload .txt/.md or paste your text.'
          : 'Upload a .txt or .md file.',
      );
      return;
    }
    if (file.size > CV_MAX_UPLOAD_BYTES) {
      setFileError('That file is too big — max 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft(reader.result);
        setFilename(file.name);
      } else {
        setFileError("Couldn't read that file.");
      }
    };
    reader.onerror = () => setFileError("Couldn't read that file.");
    reader.readAsText(file);
  };

  const onSave = () => {
    save.reset();
    const name = filename ?? cv.data.filename ?? undefined;
    save.mutate(
      { text: shown.trim(), ...(name ? { filename: name } : {}) },
      {
        onSuccess: () => {
          setDraft(null);
          setFilename(null);
        },
      },
    );
  };

  const onRemove = () => {
    if (!window.confirm('Remove your CV? DM job cards will no longer show match scores.')) return;
    remove.reset();
    remove.mutate(undefined, {
      onSuccess: () => {
        setDraft(null);
        setFilename(null);
      },
    });
  };

  return (
    <div>
      <p {...stylex.props(cvStyles.status)}>
        {cv.data.hasCv ? (
          <>
            <span {...stylex.props(cvStyles.strong)}>{cv.data.filename ?? 'Pasted CV'}</span>
            {` · ${cv.data.charCount} chars · updated ${cv.data.updatedAt ? formatDate(cv.data.updatedAt) : '—'}`}
          </>
        ) : (
          'No CV saved yet. Paste your CV or upload a file — your DM job cards will show an AI match score.'
        )}
      </p>
      <textarea
        {...stylex.props(cvStyles.area)}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your CV text here…"
        disabled={busy}
        aria-label="CV text"
      />
      <p {...stylex.props(cvStyles.count, !valid && count > 0 && cvStyles.countBad)}>
        {`${count} chars — needs ${CV_MIN_CHARS}–${CV_MAX_CHARS}.`}
      </p>
      <div {...stylex.props(cvStyles.row)}>
        <input
          {...stylex.props(cvStyles.file)}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={busy}
          aria-label="Upload CV file"
        />
      </div>
      {fileError ? (
        <div {...stylex.props(cvStyles.errorGap)}>
          <ErrorNote>{fileError}</ErrorNote>
        </div>
      ) : null}
      {save.isError || remove.isError ? (
        <div {...stylex.props(cvStyles.errorGap)}>
          <ErrorNote>{apiMessage(save.error ?? remove.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(cvStyles.buttons)}>
        <Button onClick={onSave} disabled={busy || draft === null || !valid}>
          {save.isPending ? 'Saving…' : cv.data.hasCv ? 'Save changes' : 'Save CV'}
        </Button>
        {cv.data.hasCv ? (
          <Button variant="danger" onClick={onRemove} disabled={busy}>
            {remove.isPending ? 'Removing…' : 'Remove'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
