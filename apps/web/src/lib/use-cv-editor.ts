import { CV_MAX_CHARS, CV_MAX_PDF_BYTES, CV_MIN_CHARS } from "@kappa/contracts";
import { useState } from "react";

import type { CvDtoType } from "./api";
import { apiMessage, useDeleteCv, useSaveCv, useSaveCvFile } from "./queries";

const CV_MAX_UPLOAD_BYTES = 512_000;

/** Coordinates the CV draft, local file reading and explicit removal confirmation. */
export const useCvEditor = (cv: CvDtoType | undefined) => {
  const save = useSaveCv();
  const remove = useDeleteCv();
  const upload = useSaveCvFile();
  // null = pristine stored text.
  const [draft, setDraft] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const shown = draft ?? cv?.text ?? "";
  const count = shown.trim().length;
  const valid = count >= CV_MIN_CHARS && count <= CV_MAX_CHARS;
  const busy =
    reading || save.isPending || remove.isPending || upload.isPending;
  const errorMessage =
    save.isError || remove.isError || upload.isError
      ? apiMessage(save.error ?? remove.error ?? upload.error)
      : null;

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) {
      return;
    }
    const lower = file.name.toLowerCase();
    // PDFs are parsed server-side (binary can't load into the textarea).
    if (lower.endsWith(".pdf")) {
      if (file.size > CV_MAX_PDF_BYTES) {
        setFileError("That PDF is too big — max 2MB.");
        return;
      }
      upload.reset();
      upload.mutate(file);
      return;
    }
    if (!(lower.endsWith(".txt") || lower.endsWith(".md"))) {
      setFileError("Upload a .pdf, .txt, or .md file.");
      return;
    }
    if (file.size > CV_MAX_UPLOAD_BYTES) {
      setFileError("That file is too big — max 500KB.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      setDraft(text);
      setFilename(file.name);
    } catch {
      setFileError("Couldn't read that file.");
    }
    setReading(false);
  };

  const resetDraft = () => {
    setDraft(null);
    setFilename(null);
  };

  const onSave = () => {
    save.reset();
    const name = filename ?? cv?.filename ?? undefined;
    save.mutate(
      { text: shown.trim(), ...(name ? { filename: name } : {}) },
      { onSuccess: resetDraft }
    );
  };

  const onRemove = () => {
    if (!confirmingRemoval || busy) {
      return;
    }
    remove.reset();
    remove.mutate(undefined, {
      onSuccess: () => {
        resetDraft();
        setConfirmingRemoval(false);
      },
    });
  };

  return {
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
  };
};
