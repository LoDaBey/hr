import toast from 'react-hot-toast';
import { palette } from '@/theme';

const PROCTORING_TOAST_ID = 'proctoring-banner';

function formatMessage(message: string, title?: string) {
  return title ? `${title}: ${message}` : message;
}

export function toastSuccess(message: string, title?: string) {
  toast.success(formatMessage(message, title));
}

export function toastError(message: string, title?: string) {
  toast.error(formatMessage(message, title));
}

/** Sticky session / attention banners (proctoring, dashboard alerts). */
export function toastBanner(
  message: string,
  options?: { id?: string; duration?: number },
) {
  return toast(message, {
    id: options?.id ?? PROCTORING_TOAST_ID,
    duration: options?.duration ?? 8000,
    style: {
      background: palette.paper,
      color: palette.ink,
      border: `1px solid ${palette.warning}55`,
      borderLeft: `4px solid ${palette.warning}`,
    },
  });
}

export function dismissBanner(id: string = PROCTORING_TOAST_ID) {
  toast.dismiss(id);
}

export { toast };
