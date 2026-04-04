const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/mpeg',       // mp3
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',        // m4a
  'audio/aac',
  'audio/x-m4a',
  'audio/webm',
  'audio/opus',
  'video/mp4',        // mp4 audio tracks
  'video/webm',
]);

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

export function isValidAudioFormat(mimeType: string): boolean {
  return ACCEPTED_AUDIO_TYPES.has(mimeType.toLowerCase());
}

export function isValidImageFormat(mimeType: string): boolean {
  return ACCEPTED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

async function runProcess(cmd: string[]): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Process ${cmd[0]} exited with code ${exitCode}: ${stderr}`);
  }

  return { stdout, stderr };
}

/**
 * Convert any audio file to Opus/OGG at 48k VBR.
 */
export async function convertToOpus(inputPath: string, outputPath: string): Promise<void> {
  await runProcess([
    'ffmpeg',
    '-y',
    '-i', inputPath,
    '-c:a', 'libopus',
    '-b:a', '48k',
    '-vbr', 'on',
    '-compression_level', '10',
    outputPath,
  ]);
}

/**
 * Convert any image to WebP at the given square size (default 128x128).
 */
export async function convertToWebP(
  inputPath: string,
  outputPath: string,
  size = 128,
): Promise<void> {
  await runProcess([
    'ffmpeg',
    '-y',
    '-i', inputPath,
    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
    '-c:v', 'libwebp',
    '-quality', '90',
    outputPath,
  ]);
}

/**
 * Get the duration of an audio/video file in seconds using ffprobe.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await runProcess([
    'ffprobe',
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    filePath,
  ]);

  const data = JSON.parse(stdout) as { format?: { duration?: string } };
  const duration = parseFloat(data.format?.duration ?? '0');
  if (isNaN(duration)) {
    throw new Error('Could not determine audio duration');
  }
  return duration;
}
