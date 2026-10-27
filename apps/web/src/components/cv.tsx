import { FileInput } from "@astryxdesign/core/FileInput";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { CV_MAX_CHARS, CV_MIN_CHARS } from "@kappa/contracts";
import { useState } from "react";

import { useCv } from "../lib/queries";
import type { CvDtoType } from "../lib/queries";
import { useCvEditor } from "../lib/use-cv-editor";
import { formatDate } from "./subscriptions";
import { Button, ErrorNote, InfoNote, QueryError } from "./ui";

const CvStatus = ({ cv }: { cv: CvDtoType }) => (
  <Text as="p" color="secondary">
    {cv.hasCv ? (
      <>
        <Text color="primary" weight="bold">
          {cv.filename ?? "Pasted CV"}
        </Text>
        {` · ${cv.charCount} chars · updated ${cv.updatedAt ? formatDate(cv.updatedAt) : "—"}`}
      </>
    ) : (
      "No CV saved yet. Paste your CV or upload a file — your DM job cards will show an AI match score."
    )}
  </Text>
);

/** Keyed by the stored update time so selection resets just like the native input did. */
const CvFileInput = ({
  busy,
  fileError,
  isLoading,
  onFile,
}: {
  busy: boolean;
  fileError: string | null;
  isLoading: boolean;
  onFile: (file: File | undefined) => Promise<void>;
}) => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <FileInput
      accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
      description="Upload a .pdf, .txt, or .md file."
      isDisabled={busy}
      isLoading={isLoading}
      label="Upload CV file"
      onChange={(files) => {
        const selected = Array.isArray(files) ? (files[0] ?? null) : files;
        setFile(selected);
        void onFile(selected ?? undefined);
      }}
      status={fileError ? { type: "error", message: fileError } : undefined}
      value={file}
      width="100%"
    />
  );
};

/** Personal CV editor: paste text or upload .pdf/.txt/.md. Rendered on the DM page only. */
export const CvPanel = () => {
  const cv = useCv(true);
  const {
    save,
    remove,
    upload,
    draft,
    setDraft,
    fileError,
    errorMessage,
    reading,
    confirmingRemoval,
    setConfirmingRemoval,
    shown,
    count,
    valid,
    busy,
    onFile,
    onSave,
    onRemove,
  } = useCvEditor(cv.data);

  if (cv.isPending) {
    return (
      <Text as="p" color="secondary">
        Loading…
      </Text>
    );
  }
  if (cv.isError) {
    return <QueryError error={cv.error} />;
  }

  let saveLabel = cv.data.hasCv ? "Save changes" : "Save CV";
  if (save.isPending) {
    saveLabel = "Saving…";
  }

  return (
    <VStack gap={3}>
      <CvStatus cv={cv.data} />
      {/* Use the editor's trimmed UTF-16 count, not Astryx's grapheme maxLength counter. */}
      <TextArea
        description={`${count} chars — needs ${CV_MIN_CHARS}–${CV_MAX_CHARS}.`}
        isDisabled={busy}
        label="CV text"
        onChange={setDraft}
        placeholder="Paste your CV text here…"
        status={valid ? undefined : { type: "error" }}
        value={shown}
        width="100%"
      />
      <VStack gap={2}>
        <CvFileInput
          busy={busy}
          fileError={fileError}
          isLoading={reading || upload.isPending}
          key={cv.data.updatedAt ?? "none"}
          onFile={onFile}
        />
        {reading ? (
          <Text color="secondary" type="supporting">
            Reading…
          </Text>
        ) : null}
        {upload.isPending ? (
          <Text color="secondary" type="supporting">
            Uploading…
          </Text>
        ) : null}
      </VStack>
      {errorMessage === null ? null : <ErrorNote>{errorMessage}</ErrorNote>}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button
          disabled={busy || draft === null || !valid}
          loading={save.isPending}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
        {cv.data.hasCv ? (
          <Button
            disabled={busy}
            loading={remove.isPending}
            onClick={() => setConfirmingRemoval(true)}
            variant="danger"
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </HStack>
      {confirmingRemoval ? (
        <VStack gap={3}>
          <InfoNote>
            Remove your CV? DM job cards will no longer show match scores.
          </InfoNote>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button
              disabled={busy}
              loading={remove.isPending}
              onClick={onRemove}
              variant="danger"
            >
              {remove.isPending ? "Removing…" : "Confirm remove"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setConfirmingRemoval(false)}
              variant="subtle"
            >
              Cancel
            </Button>
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
};
