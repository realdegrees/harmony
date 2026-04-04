/**
 * Screen/camera streaming utilities for Harmony voice.
 *
 * Wraps getDisplayMedia and getUserMedia with configuration options
 * matching the StreamConfig type from shared types.
 */

import type { StreamConfig } from '@harmony/shared/types/voice';
import { StreamType } from '@harmony/shared/types/voice';

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * Acquire the user's camera stream.
 *
 * @param config - Resolution/framerate constraints from StreamConfig.
 */
export async function getCameraStream(config: Partial<StreamConfig> = {}): Promise<MediaStream> {
  const { width = 1280, height = 720, maxFramerate = 30, maxBitrate } = config;

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: width, max: width },
      height: { ideal: height, max: height },
      frameRate: { ideal: maxFramerate, max: maxFramerate },
      facingMode: 'user',
    },
    audio: false, // audio is handled separately via getMicrophoneStream
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

// ---------------------------------------------------------------------------
// Screen share
// ---------------------------------------------------------------------------

/**
 * Acquire a full-screen share stream using getDisplayMedia.
 *
 * @param config - Resolution/framerate constraints.
 */
export async function getScreenStream(config: Partial<StreamConfig> = {}): Promise<MediaStream> {
  const { width = 1920, height = 1080, maxFramerate = 30 } = config;

  const displayMediaOptions: DisplayMediaStreamOptions = {
    video: {
      // @ts-ignore — displaySurface is available in Chrome/Edge
      displaySurface: 'monitor',
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: maxFramerate, max: maxFramerate },
    },
    audio: {
      // System audio capture (Chrome only, user opt-in)
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 44_100,
    },
  };

  return navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
}

/**
 * Acquire a specific window share stream using getDisplayMedia.
 * On most browsers this shows the same picker as getScreenStream, but
 * the displaySurface hint encourages window-level capture.
 *
 * @param config - Resolution/framerate constraints.
 */
export async function getWindowStream(config: Partial<StreamConfig> = {}): Promise<MediaStream> {
  const { width = 1920, height = 1080, maxFramerate = 30 } = config;

  const displayMediaOptions: DisplayMediaStreamOptions = {
    video: {
      // @ts-ignore — displaySurface is available in Chrome/Edge
      displaySurface: 'window',
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: maxFramerate, max: maxFramerate },
    },
    audio: false,
  };

  return navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
}

// ---------------------------------------------------------------------------
// Unified helper
// ---------------------------------------------------------------------------

/**
 * Acquires a stream based on StreamType from StreamConfig.
 */
export async function getStreamByType(config: StreamConfig): Promise<MediaStream> {
  switch (config.type) {
    case StreamType.CAMERA:
      return getCameraStream(config);
    case StreamType.SCREEN:
      return getScreenStream(config);
    case StreamType.WINDOW:
      return getWindowStream(config);
    default:
      throw new Error(`Unknown stream type: ${(config as { type: string }).type}`);
  }
}

// ---------------------------------------------------------------------------
// Track replacement
// ---------------------------------------------------------------------------

/**
 * Replace the video track in an existing MediaStream with a new one.
 * Useful for switching from camera to screen share without stopping the stream.
 *
 * @param existingStream - The stream to update.
 * @param newStream      - The source of the new video track.
 * @returns The new track (already added to existingStream).
 */
export function replaceVideoTrack(
  existingStream: MediaStream,
  newStream: MediaStream
): MediaStreamTrack {
  // Remove old video tracks
  for (const track of existingStream.getVideoTracks()) {
    track.stop();
    existingStream.removeTrack(track);
  }

  // Add new video track
  const newTrack = newStream.getVideoTracks()[0];
  if (!newTrack) throw new Error('No video track in new stream');
  existingStream.addTrack(newTrack);
  return newTrack;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Stop all tracks in a stream and release media device resources.
 */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Apply bitrate/resolution constraints to an existing video track.
 * Uses the RTCRtpSender.setParameters API — works when the track
 * is already associated with an RTCPeerConnection.
 *
 * @param sender   - The RTCRtpSender for the track.
 * @param maxBitrate - Maximum bitrate in bps.
 */
export async function applyBitrateConstraint(
  sender: RTCRtpSender,
  maxBitrate: number
): Promise<void> {
  const params = sender.getParameters();
  if (!params.encodings) params.encodings = [{}];
  for (const encoding of params.encodings) {
    encoding.maxBitrate = maxBitrate;
  }
  await sender.setParameters(params);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the browser supports screen capture.
 */
export function supportsScreenShare(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/**
 * Returns true if the browser supports camera capture.
 */
export function supportsCamera(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Enumerate available video input devices (cameras).
 */
export async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

/**
 * Enumerate available audio input devices (microphones).
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'audioinput');
}

/**
 * Enumerate available audio output devices (speakers/headphones).
 */
export async function getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'audiooutput');
}
