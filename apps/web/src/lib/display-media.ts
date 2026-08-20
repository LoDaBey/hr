/** Exact message when a tab/window is shared instead of the whole monitor. */
export const NON_MONITOR_SHARE_MESSAGE =
  'That shared a single tab. This session needs your entire screen — choose the Entire Screen tab and try again.';

type DisplayMediaTrackSettings = MediaTrackSettings & {
  displaySurface?: string;
};

/** Strongest hints available; browser still owns the picker UI. */
type MonitorShareConstraints = DisplayMediaStreamOptions & {
  monitorTypeSurfaces?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  selfBrowserSurface?: 'include' | 'exclude';
};

/**
 * Prompt for an entire-monitor share. Rejects tab/window shares immediately.
 * Throws if the user cancels or picks a non-monitor surface.
 */
export async function requestEntireMonitorShare(): Promise<MediaStream> {
  const constraints: MonitorShareConstraints = {
    video: { displaySurface: 'monitor' },
    audio: false,
    monitorTypeSurfaces: 'include',
    surfaceSwitching: 'exclude',
    selfBrowserSurface: 'exclude',
  };

  const next = await navigator.mediaDevices.getDisplayMedia(constraints);

  const track = next.getVideoTracks()[0];
  const surface = (track?.getSettings() as DisplayMediaTrackSettings | undefined)
    ?.displaySurface;

  if (surface !== 'monitor') {
    next.getTracks().forEach((t) => t.stop());
    throw new Error(NON_MONITOR_SHARE_MESSAGE);
  }

  return next;
}

/**
 * `null` before the browser environment is known (SSR).
 * `false` when getDisplayMedia is missing (typical mobile browsers).
 */
export function supportsDisplayMedia(): boolean | null {
  if (typeof navigator === 'undefined') return null;
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}
