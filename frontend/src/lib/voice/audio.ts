/**
 * Audio management utilities for Harmony voice.
 *
 * Handles:
 * - Microphone stream acquisition
 * - Mute/unmute
 * - Audio level (speaking indicator)
 * - Audio context management for soundboard playback
 */

// ---------------------------------------------------------------------------
// Microphone
// ---------------------------------------------------------------------------

/**
 * Request access to the user's microphone and return a MediaStream.
 * Pass a deviceId to select a specific microphone; omit for the system default.
 * Throws if permission is denied.
 */
export async function getMicrophoneStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48_000,
      channelCount: 1,
    },
    video: false,
  });
}

/**
 * Mute or unmute all audio tracks in a stream.
 * Toggling `enabled` on a track is a soft-mute — the track stays active
 * but sends silence. This is the correct pattern for voice call muting.
 */
export function toggleMute(stream: MediaStream, muted: boolean): void {
  for (const track of stream.getAudioTracks()) {
    track.enabled = !muted;
  }
}

/**
 * Stop all tracks in a stream and release media devices.
 */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

// ---------------------------------------------------------------------------
// Audio level analysis
// ---------------------------------------------------------------------------

interface AudioLevelAnalyser {
  analyser: AnalyserNode;
  dataArray: Uint8Array<ArrayBuffer>;
  source: MediaStreamAudioSourceNode;
  context: AudioContext;
}

const analyserCache = new Map<string, AudioLevelAnalyser>();

/**
 * Get the current audio level (0–1) for a stream.
 * Uses an AnalyserNode from the Web Audio API.
 * Returns 0 if stream has no active audio tracks.
 */
export function getAudioLevel(stream: MediaStream): number {
  const audioTracks = stream.getAudioTracks().filter(t => t.enabled && t.readyState === 'live');
  if (audioTracks.length === 0) return 0;

  const streamId = stream.id;

  let entry = analyserCache.get(streamId);
  if (!entry) {
    const context = getAudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    entry = { analyser, dataArray, source, context };
    analyserCache.set(streamId, entry);
  }

  entry.analyser.getByteFrequencyData(entry.dataArray);

  // Calculate RMS (root mean square)
  let sum = 0;
  for (const v of entry.dataArray) sum += v * v;
  const rms = Math.sqrt(sum / entry.dataArray.length);
  return Math.min(rms / 128, 1); // normalize to 0–1
}

/**
 * Clean up the analyser for a given stream.
 * Call when a stream is removed to avoid memory leaks.
 */
export function cleanupAudioLevel(stream: MediaStream): void {
  const entry = analyserCache.get(stream.id);
  if (!entry) return;
  entry.source.disconnect();
  entry.analyser.disconnect();
  analyserCache.delete(stream.id);
}

// ---------------------------------------------------------------------------
// Audio context management
// ---------------------------------------------------------------------------

let sharedAudioContext: AudioContext | null = null;

/**
 * Returns (or lazily creates) a shared AudioContext.
 * The context is resumed after a user gesture if it was suspended.
 */
export function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext({ sampleRate: 48_000 });
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(console.error);
  }
  return sharedAudioContext;
}

/**
 * Play a Blob or URL as audio using the shared AudioContext.
 * Returns a function to stop playback early.
 */
export async function playAudioBlob(blob: Blob): Promise<() => void> {
  const context = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.start();

  return () => {
    try { source.stop(); } catch { /* already stopped */ }
  };
}

/**
 * Play a sound from a URL (notification sound, etc.)
 */
export function playSoundUrl(url: string, volume = 1): HTMLAudioElement {
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => { /* autoplay blocked */ });
  return audio;
}

// ---------------------------------------------------------------------------
// Speaking detection
// ---------------------------------------------------------------------------

const SPEAKING_THRESHOLD = 0.05; // 0–1, tune as needed

/**
 * Returns true if the audio level on the stream is above the speaking threshold.
 */
export function isSpeaking(stream: MediaStream): boolean {
  return getAudioLevel(stream) > SPEAKING_THRESHOLD;
}

/**
 * Polls a stream periodically and calls a callback with speaking state.
 * Returns a cleanup function.
 */
export function watchSpeaking(
  stream: MediaStream,
  onSpeaking: (speaking: boolean) => void,
  intervalMs = 100
): () => void {
  let wasSpeaking = false;

  const id = setInterval(() => {
    const speaking = isSpeaking(stream);
    if (speaking !== wasSpeaking) {
      wasSpeaking = speaking;
      onSpeaking(speaking);
    }
  }, intervalMs);

  return () => clearInterval(id);
}
