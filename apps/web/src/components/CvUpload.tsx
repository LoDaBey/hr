'use client';

import { useState, type ReactNode } from 'react';
import { FileInput, Text } from '@mantine/core';
import { uploadSigned } from '@/lib/cloudinary-client';
import type { ApplicationCvInput } from '@/types/api';

export function CvUpload({
  required,
  value,
  onChange,
  onUploadingChange,
  error,
}: {
  required: boolean;
  value: ApplicationCvInput | null;
  onChange: (cv: ApplicationCvInput | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  error?: ReactNode;
}) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    setLocalError(null);
    if (!file) {
      onChange(null);
      return;
    }
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const uploaded = await uploadSigned(file, 'cv');
      onChange(uploaded);
    } catch (err) {
      onChange(null);
      setLocalError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <>
      <FileInput
        className="rounded outline-none"
        label="CV"
        aria-label="CV"
        required={required}
        accept=".pdf,.doc,.docx,application/pdf"
        clearable
        placeholder={value ? value.original_name : 'PDF, DOC, or DOCX'}
        onChange={handleFile}
        error={error ?? localError}
        disabled={uploading}
      />
      {uploading ? (
        <Text size="sm" c="dimmed">
          Uploading…
        </Text>
      ) : null}
      {value && !uploading ? (
        <Text size="sm">
          {value.original_name} uploaded
        </Text>
      ) : null}
    </>
  );
}
