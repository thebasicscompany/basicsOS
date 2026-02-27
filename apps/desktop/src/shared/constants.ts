// ---------------------------------------------------------------------------
// Shared constants — magic numbers extracted from across the desktop app
// ---------------------------------------------------------------------------

// --- Whisper / Speech Recognition ---
/** Minimum audio blob size (bytes) to attempt transcription. */
export const MIN_TRANSCRIPTION_BLOB_SIZE = 1000;

// --- Meeting Recorder Audio ---
/** Gain applied to system audio in the meeting mix. */
export const SYSTEM_AUDIO_GAIN = 0.7;
/** Gain applied to microphone audio in the meeting mix. */
export const MIC_AUDIO_GAIN = 1.0;
/** MediaRecorder timeslice — how often ondataavailable fires. */
export const MEDIA_RECORDER_TIMESLICE_MS = 250;

// --- System Audio Capture (ScreenCaptureKit) ---
/** RMS threshold below which audio is considered silence (fixes floating-point noise). */
export const SILENCE_RMS_THRESHOLD = 0.001;
/** Number of initial ScreenCaptureKit samples to skip (startup latency). */
export const SCK_SILENCE_SKIP_SAMPLES = 25;
/** Number of samples to check for silence after skipping startup. */
export const SCK_SILENCE_CHECK_SAMPLES = 25;

// --- WebSocket ---
/** Timeout for WebSocket connection to become ready. */
export const WS_CONNECT_TIMEOUT_MS = 10_000;
/** Timeout for WebSocket close acknowledgement. */
export const WS_CLOSE_ACK_TIMEOUT_MS = 2_000;

// --- Flash Messages ---
/** Short flash duration (e.g., "Copied!"). */
export const FLASH_SHORT_MS = 800;
/** Medium flash duration (e.g., "Meeting saved"). */
export const FLASH_MEDIUM_MS = 2_000;
/** Long flash duration (e.g., error messages). */
export const FLASH_LONG_MS = 3_000;

// --- Overlay Window ---
/** Overlay pill window width in pixels. */
export const PILL_WIDTH = 400;
/** Overlay pill window height in pixels. */
export const PILL_HEIGHT = 200;

// --- AI Streaming ---
/** Timeout for the AI assistant streaming API call. */
export const API_STREAM_TIMEOUT_MS = 5_000;
