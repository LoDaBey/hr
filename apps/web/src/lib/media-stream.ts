export type MediaRequirements = {
  camera: boolean;
  mic: boolean;
};

export type DeviceTrackStatus = {
  camera: 'off' | 'on' | 'not_required';
  mic: 'off' | 'on' | 'not_required';
};

export function deviceTrackStatus(
  stream: MediaStream | null,
  requirements: MediaRequirements,
): DeviceTrackStatus {
  const camera: DeviceTrackStatus['camera'] = requirements.camera
    ? isTrackLive(stream?.getVideoTracks()[0])
      ? 'on'
      : 'off'
    : 'not_required';
  const mic: DeviceTrackStatus['mic'] = requirements.mic
    ? isTrackLive(stream?.getAudioTracks()[0])
      ? 'on'
      : 'off'
    : 'not_required';
  return { camera, mic };
}

export function streamMeetsRequirements(
  stream: MediaStream | null,
  requirements: MediaRequirements,
): boolean {
  const status = deviceTrackStatus(stream, requirements);
  if (requirements.camera && status.camera !== 'on') return false;
  if (requirements.mic && status.mic !== 'on') return false;
  return true;
}

function isTrackLive(track: MediaStreamTrack | undefined): boolean {
  return Boolean(track && track.readyState === 'live' && track.enabled && !track.muted);
}

export function formatDeviceStatus(status: DeviceTrackStatus): string {
  const parts: string[] = [];
  if (status.camera !== 'not_required') {
    parts.push(status.camera === 'on' ? 'Camera on' : 'Camera off');
  }
  if (status.mic !== 'not_required') {
    parts.push(status.mic === 'on' ? 'Microphone on' : 'Microphone off');
  }
  return parts.join(' · ');
}

export async function replaceStreamTracks(
  stream: MediaStream,
  requirements: MediaRequirements,
): Promise<MediaStream> {
  const fresh = await navigator.mediaDevices.getUserMedia({
    video: requirements.camera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
    audio: requirements.mic,
  });

  for (const kind of ['video', 'audio'] as const) {
    const required = kind === 'video' ? requirements.camera : requirements.mic;
    if (!required) continue;

    for (const oldTrack of stream.getTracks().filter((t) => t.kind === kind)) {
      stream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    for (const newTrack of fresh.getTracks().filter((t) => t.kind === kind)) {
      stream.addTrack(newTrack);
    }
  }

  for (const track of fresh.getTracks()) {
    if (!stream.getTracks().includes(track)) {
      track.stop();
    }
  }

  return stream;
}
