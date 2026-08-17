declare module 'recordrtc' {
  interface RecordRTCOptions {
    type?: 'video' | 'audio' | 'canvas' | 'gif';
    mimeType?: string;
    timeSlice?: number;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
    bitsPerSecond?: number;
    disableLogs?: boolean;
  }

  class RecordRTC {
    constructor(stream: MediaStream, options?: RecordRTCOptions);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    getBlob(): Blob;
    destroy(): void;
  }

  export default RecordRTC;
}
