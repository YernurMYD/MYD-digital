export enum TranscodeStatus {
  PENDING = 'pending',
  PROBING = 'probing',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export interface ProbeResult {
  codec: string;
  pixelFormat: string;
  width: number;
  height: number;
  durationMs: number;
  bitrate: number;
  formatName: string;
  hasAlpha: boolean;
}

export interface TranscodeResult {
  outputPath: string;
  status: TranscodeStatus.COMPLETED | TranscodeStatus.SKIPPED;
  durationMs: number;
  width: number;
  height: number;
  fileSize: number;
}
