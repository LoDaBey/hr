import 'server-only';
import { createHash, randomBytes } from 'crypto';
import type { CloudinarySignatureResult } from '@/types/api';

const DELIVERY_TTL_SECONDS = 600;

function requireCloudinaryEnv(name: 'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var: ${name}`);
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function signUploadParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(toSign + secret).digest('hex');
}

export function signUpload(kind: 'cv' | 'video'): CloudinarySignatureResult {
  const cloudName = requireCloudinaryEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requireCloudinaryEnv('CLOUDINARY_API_KEY');
  const secret = requireCloudinaryEnv('CLOUDINARY_API_SECRET');

  const isVideo = kind === 'video';
  const timestamp = Math.floor(Date.now() / 1000);
  const month = new Date().toISOString().slice(0, 7);
  const folder = isVideo ? `recruitment/interviews/${month}` : `recruitment/cv/${month}`;
  const publicId = `${isVideo ? 'sess_' : 'cv_'}${randomBytes(8).toString('hex')}`;
  const type = 'authenticated';
  const params = { folder, public_id: publicId, timestamp, type };
  const signature = signUploadParams(params, secret);

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    timestamp,
    signature,
    folder,
    type,
    public_id: publicId,
    resource_type: isVideo ? 'video' : 'raw',
    max_bytes: isVideo ? 104_857_600 : 10_485_760,
    allowed_formats: isVideo ? ['webm', 'mp4'] : ['pdf', 'doc', 'docx'],
  };
}

/**
 * Time-limited download URL for authenticated/private assets.
 * Uses Cloudinary's `/download` API (same signing as uploads).
 *
 * Raw files keep the extension in `public_id` (e.g. `folder/cv_abc.pdf`).
 * Images and videos use `public_id` + separate `format`.
 */
export function signedDeliveryUrl(
  publicId: string,
  resourceType: string,
  format: string,
): { url: string; expires_in: number } {
  const cloudName = requireCloudinaryEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requireCloudinaryEnv('CLOUDINARY_API_KEY');
  const secret = requireCloudinaryEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + DELIVERY_TTL_SECONDS;
  const extension = (format || '').replace(/^\./, '').toLowerCase();
  const type = resourceType === 'video' ? 'video' : resourceType === 'image' ? 'image' : 'raw';

  let id = publicId;
  const params: Record<string, string | number> = {
    timestamp,
    type: 'authenticated',
    expires_at: expiresAt,
  };

  if (type === 'raw') {
    if (extension && !id.toLowerCase().endsWith(`.${extension}`)) {
      id = `${id}.${extension}`;
    }
    params.public_id = id;
  } else {
    if (extension && id.toLowerCase().endsWith(`.${extension}`)) {
      id = id.slice(0, -(extension.length + 1));
    }
    params.public_id = id;
    if (extension) params.format = extension;
  }

  const signature = signUploadParams(params, secret);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }
  query.set('signature', signature);
  query.set('api_key', apiKey);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/download?${query.toString()}`;
  return { url, expires_in: DELIVERY_TTL_SECONDS };
}
