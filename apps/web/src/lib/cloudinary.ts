import 'server-only';
import { createHash, createHmac, randomBytes } from 'crypto';
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

export function signedDeliveryUrl(
  publicId: string,
  resourceType: string,
  format: string,
): { url: string; expires_in: number } {
  const cloudName = requireCloudinaryEnv('CLOUDINARY_CLOUD_NAME');
  const secret = requireCloudinaryEnv('CLOUDINARY_API_SECRET');
  const exp = Math.floor(Date.now() / 1000) + DELIVERY_TTL_SECONDS;
  const toSign = `exp=${exp}~acl=/${resourceType}/authenticated/${publicId}.${format}`;
  const sig = createHmac('sha256', Buffer.from(secret)).update(toSign).digest('base64url');
  const url =
    `https://res.cloudinary.com/${cloudName}/${resourceType}` +
    `/authenticated/s--${sig}--/${publicId}.${format}?_a=${exp}`;
  return { url, expires_in: DELIVERY_TTL_SECONDS };
}
