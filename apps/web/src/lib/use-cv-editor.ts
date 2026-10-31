import {
  CV_MAX_PDF_BYTES,
  CV_MAX_TEXT_BYTES,
  CV_MAX_FILENAME,
} from "@kappa/contracts";
import { useState } from "react";

import { apiMessage, useDeleteCv, useSaveCvFile } from "./queries";

/** Upload-only CV state: extracted content never reaches the browser. */
export const useCvEditor = () => {
  const remove = useDeleteCv();
  const upload = useSaveCvFile();
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const busy = remove.isPending || upload.isPending;
  let errorMessage = fileError;
  if (!errorMessage && upload.isError) {
    errorMessage = apiMessage(upload.error);
  } else if (!errorMessage && remove.isError) {
    errorMessage = apiMessage(remove.error);
  }

  const resetErrors = () => {
    setFileError(null);
    upload.reset();
    remove.reset();
  };
  const onFile = (file: File | undefined) => {
    if (!file || busy) {
      return;
    }
    resetErrors();
    setConfirmingRemoval(false);
    const name = file.name.trim().toLowerCase();
    if (file.name.trim().length > CV_MAX_FILENAME) {
      setFileError(`Filename must be ${CV_MAX_FILENAME} characters or fewer.`);
      return;
    }
    const isPdf = name.endsWith(".pdf");
    if (!isPdf && !name.endsWith(".txt") && !name.endsWith(".md")) {
      setFileError("Upload a .pdf, .txt, or .md file.");
      return;
    }
    if (file.size > (isPdf ? CV_MAX_PDF_BYTES : CV_MAX_TEXT_BYTES)) {
      setFileError(
        isPdf
          ? "PDF must be 2MB or smaller."
          : "Text file must be 500KB or smaller."
      );
      return;
    }
    // Send original bytes to the service. Never call file.text() client-side.
    upload.mutate(file);
  };
  const confirmRemoval = () => {
    resetErrors();
    setConfirmingRemoval(true);
  };
  const onRemove = () => {
    if (!confirmingRemoval || busy) {
      return;
    }
    resetErrors();
    remove.mutate(undefined, { onSuccess: () => setConfirmingRemoval(false) });
  };
  return {
    busy,
    upload,
    remove,
    errorMessage,
    confirmingRemoval,
    setConfirmingRemoval,
    confirmRemoval,
    onFile,
    onRemove,
  };
};
