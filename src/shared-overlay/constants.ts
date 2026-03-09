// Shared constants for the voice pill overlay

export const PILL_WIDTH = 400;

/** Minimum audio blob size (bytes) to attempt transcription. */
export const MIN_TRANSCRIPTION_BLOB_SIZE = 1000;
export const PILL_HEIGHT = 200;

export const FLASH_SHORT_MS = 800;
export const FLASH_MEDIUM_MS = 2_000;
export const FLASH_LONG_MS = 3_000;

export const API_STREAM_TIMEOUT_MS = 30_000;

// Meeting recorder constants
export const SYSTEM_AUDIO_GAIN = 0.7;
export const MIC_AUDIO_GAIN = 1.0;
export const PCM_SAMPLE_RATE = 16000;
export const PCM_BUFFER_SIZE = 4096; // ~256ms at 16kHz
export const WS_CONNECT_TIMEOUT_MS = 10_000;
export const WS_CLOSE_ACK_TIMEOUT_MS = 2_000;

// ScreenCaptureKit silence detection
export const SILENCE_RMS_THRESHOLD = 0.001;
export const SCK_SILENCE_SKIP_SAMPLES = 25;
export const SCK_SILENCE_CHECK_SAMPLES = 25;
