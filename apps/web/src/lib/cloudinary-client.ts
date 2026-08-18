import { api } from '@/lib/api';
import type { ApplicationCvInput, CloudinarySignatureResult } from '@/types/api';

type CloudinaryUploadResponse = {
  public_id?: string;
  resource_type?: string;
  type?: string;
  format?: string;
  bytes?: number;
  original_filename?: string;
  duration?: number;
  done?: boolean;
  error?: { message?: string };
};

const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB — Cloudinary requires ≥5 MB for non-final chunks
const CHUNK_BACKOFF_MS = [2000, 4000, 8000] as const;
const MAX_UPLOAD_MS = 10 * 60 * 1000;

export type ChunkedUploadProgress = {
  loaded: number;
  total: number;
};

export type ChunkedUploadOptions = {
  chunkSize?: number;
  onProgress?: (progress: ChunkedUploadProgress) => void;
  signal?: AbortSignal;
  /** Resume from this byte offset (first unsent byte). */
  startByte?: number;
  /** Same value on every chunk of one file; reuse across retries. */
  uniqueUploadId?: string;
  filename?: string;
};

export type ChunkedUploadResult = ApplicationCvInput & {
  duration_seconds?: number;
  uniqueUploadId: string;
  /** Bytes successfully accepted (for resume). Equals total on success. */
  bytesUploaded: number;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function randomUploadId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function uploadOneChunk(
  chunk: Blob,
  signature: CloudinarySignatureResult,
  filename: string,
  rangeStart: number,
  total: number,
  uniqueUploadId: string,
  signal?: AbortSignal,
): Promise<CloudinaryUploadResponse> {
  const rangeEnd = rangeStart + chunk.size - 1;
  const body = new FormData();
  body.append('file', chunk, filename);
  body.append('api_key', signature.api_key);
  body.append('timestamp', String(signature.timestamp));
  body.append('signature', signature.signature);
  body.append('folder', signature.folder);
  body.append('public_id', signature.public_id);
  body.append('type', signature.type);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/${signature.resource_type}/upload`,
    {
      method: 'POST',
      body,
      headers: {
        'X-Unique-Upload-Id': uniqueUploadId,
        'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${total}`,
      },
      signal,
    },
  );

  const json = (await res.json()) as CloudinaryUploadResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Chunk upload failed (${res.status})`);
  }
  return json;
}

/**
 * Cloudinary browser chunked upload. Non-final chunks must be ≥5 MB (we use 6 MB).
 * Retries each chunk up to 3 times with 2s/4s/8s backoff. Cap total wall time at 10 minutes.
 */
export async function uploadChunkedToCloudinary(
  blob: Blob,
  signature: CloudinarySignatureResult,
  options: ChunkedUploadOptions = {},
): Promise<ChunkedUploadResult> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const total = blob.size;
  const filename = options.filename ?? 'session.webm';
  const uniqueUploadId = options.uniqueUploadId ?? randomUploadId();
  const startedAt = Date.now();
  let offset = Math.max(0, Math.min(options.startByte ?? 0, total));

  if (total > signature.max_bytes) {
    throw new Error(
      `File is too large (max ${Math.round(signature.max_bytes / (1024 * 1024))} MB)`,
    );
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (signature.allowed_formats.length && ext && !signature.allowed_formats.includes(ext)) {
    throw new Error(`File type .${ext} is not allowed`);
  }

  options.onProgress?.({ loaded: offset, total });

  let lastJson: CloudinaryUploadResponse = {};

  while (offset < total) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (Date.now() - startedAt > MAX_UPLOAD_MS) {
      const err = new Error('Upload timed out after 10 minutes') as Error & {
        bytesUploaded: number;
        uniqueUploadId: string;
      };
      err.bytesUploaded = offset;
      err.uniqueUploadId = uniqueUploadId;
      throw err;
    }

    const end = Math.min(offset + chunkSize, total);
    // Non-final chunks must be at least 5 MB — if a mid-file remainder would be smaller,
    // enlarge this chunk to absorb it (Cloudinary rejects tiny non-final parts).
    let chunkEnd = end;
    if (chunkEnd < total && total - chunkEnd < 5 * 1024 * 1024) {
      chunkEnd = total;
    }
    const chunk = blob.slice(offset, chunkEnd);
    let chunkOk = false;

    for (let attempt = 0; attempt <= CHUNK_BACKOFF_MS.length; attempt += 1) {
      try {
        lastJson = await uploadOneChunk(
          chunk,
          signature,
          filename,
          offset,
          total,
          uniqueUploadId,
          options.signal,
        );
        chunkOk = true;
        break;
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (attempt >= CHUNK_BACKOFF_MS.length) {
          const err = (error instanceof Error ? error : new Error(String(error))) as Error & {
            bytesUploaded: number;
            uniqueUploadId: string;
          };
          err.bytesUploaded = offset;
          err.uniqueUploadId = uniqueUploadId;
          throw err;
        }
        await sleep(CHUNK_BACKOFF_MS[attempt]!, options.signal);
      }
    }

    if (!chunkOk) {
      const err = new Error('Chunk upload failed') as Error & {
        bytesUploaded: number;
        uniqueUploadId: string;
      };
      err.bytesUploaded = offset;
      err.uniqueUploadId = uniqueUploadId;
      throw err;
    }

    offset = chunkEnd;
    options.onProgress?.({ loaded: offset, total });
  }

  let publicId = lastJson.public_id ?? signature.public_id;
  const format = (lastJson.format ?? ext).toLowerCase();
  if (format && publicId.toLowerCase().endsWith(`.${format}`)) {
    publicId = publicId.slice(0, -(format.length + 1));
  }

  return {
    public_id: publicId,
    resource_type: lastJson.resource_type ?? signature.resource_type,
    delivery_type: lastJson.type ?? signature.type,
    format,
    bytes: lastJson.bytes ?? total,
    original_name: filename,
    duration_seconds: typeof lastJson.duration === 'number' ? lastJson.duration : undefined,
    uniqueUploadId,
    bytesUploaded: total,
  };
}

/** Single-shot signed upload (CVs and small files). */
export async function uploadSigned(
  file: File | Blob,
  kind: 'cv' | 'video',
  extra?: { token?: string; filename?: string },
): Promise<ApplicationCvInput & { duration_seconds?: number }> {
  const signature = await api<CloudinarySignatureResult>('/api/upload/signature', {
    method: 'POST',
    body: { kind, ...(extra?.token ? { token: extra.token } : {}) },
  });

  if (file.size > signature.max_bytes) {
    throw new Error(`File is too large (max ${Math.round(signature.max_bytes / (1024 * 1024))} MB)`);
  }

  const filename =
    extra?.filename ??
    (file instanceof File ? file.name : kind === 'video' ? 'session.webm' : 'upload.bin');
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (signature.allowed_formats.length && ext && !signature.allowed_formats.includes(ext)) {
    throw new Error(`File type .${ext} is not allowed`);
  }

  // Videos use chunked upload so a dropped connection only costs one chunk.
  if (kind === 'video') {
    return uploadChunkedToCloudinary(file, signature, {
      filename,
    });
  }

  const body = new FormData();
  body.append('file', file, filename);
  body.append('api_key', signature.api_key);
  body.append('timestamp', String(signature.timestamp));
  body.append('signature', signature.signature);
  body.append('folder', signature.folder);
  body.append('public_id', signature.public_id);
  body.append('type', signature.type);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/${signature.resource_type}/upload`,
    { method: 'POST', body },
  );
  const json = (await res.json()) as CloudinaryUploadResponse;
  if (!res.ok || json.error || !json.public_id) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }

  const publicId = json.public_id;
  const format = (json.format ?? ext).toLowerCase();

  return {
    public_id: publicId,
    resource_type: json.resource_type ?? signature.resource_type,
    delivery_type: json.type ?? signature.type,
    format,
    bytes: json.bytes ?? file.size,
    original_name: filename,
    duration_seconds: typeof json.duration === 'number' ? json.duration : undefined,
  };
}
