import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { env } from '../config/env';

// Resolve the media server directory relative to this file.
// In the container: backend is at /app/backend, media at /app/media
// In dev (running from project root): backend/src -> ../../media
const MEDIA_DIR = join(import.meta.dir, '../../../media');
const MEDIA_DIST = join(MEDIA_DIR, 'dist/index.js');
const MEDIA_SRC = join(MEDIA_DIR, 'src/index.ts');
const MEDIA_TSX = join(MEDIA_DIR, 'node_modules/.bin/tsx');

let mediaProcess: ChildProcess | null = null;
let stopping = false;

function buildSpawnArgs(): { cmd: string; args: string[] } {
  // Prefer compiled dist/ (production), fall back to tsx (dev)
  if (existsSync(MEDIA_DIST)) {
    return { cmd: 'node', args: [MEDIA_DIST] };
  }
  if (existsSync(MEDIA_TSX) && existsSync(MEDIA_SRC)) {
    return { cmd: MEDIA_TSX, args: [MEDIA_SRC] };
  }
  throw new Error(
    `Cannot find media server entry point.\n` +
    `  Expected compiled: ${MEDIA_DIST}\n` +
    `  Expected dev tsx:  ${MEDIA_SRC}\n` +
    `Run 'bun run build:media' to compile, or ensure media/node_modules is installed.`,
  );
}

export async function startMediaServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    let spawnArgs: { cmd: string; args: string[] };
    try {
      spawnArgs = buildSpawnArgs();
    } catch (err) {
      reject(err);
      return;
    }

    console.log(`[media] Starting media server (${spawnArgs.cmd})...`);

    const child = spawn(spawnArgs.cmd, spawnArgs.args, {
      cwd: MEDIA_DIR,
      env: {
        ...process.env,
        MEDIASOUP_LISTEN_IP: env.MEDIASOUP_LISTEN_IP,
        MEDIASOUP_ANNOUNCED_IP: env.MEDIASOUP_ANNOUNCED_IP,
        MEDIASOUP_RTC_MIN_PORT: String(env.MEDIASOUP_RTC_MIN_PORT),
        MEDIASOUP_RTC_MAX_PORT: String(env.MEDIASOUP_RTC_MAX_PORT),
        MEDIA_PORT: String(env.MEDIA_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    mediaProcess = child;

    child.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().trim().split('\n')) {
        if (line) console.log(`[media] ${line}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().trim().split('\n')) {
        if (line) console.error(`[media] ${line}`);
      }
    });

    child.on('error', (err) => {
      console.error('[media] Failed to spawn:', err);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      mediaProcess = null;
      if (!stopping) {
        console.error(`[media] Exited unexpectedly (code=${code}, signal=${signal}), restarting in 2s...`);
        setTimeout(() => {
          startMediaServer().catch((err) =>
            console.error('[media] Restart failed:', err),
          );
        }, 2000);
      }
    });

    // Poll the health endpoint until the server is up (max 15s)
    waitForMedia(resolve, reject, 30);
  });
}

function waitForMedia(
  resolve: () => void,
  reject: (err: Error) => void,
  attemptsLeft: number,
): void {
  if (attemptsLeft <= 0) {
    reject(new Error('[media] Timed out waiting for media server to become healthy'));
    return;
  }

  setTimeout(async () => {
    try {
      const res = await fetch(`http://localhost:${env.MEDIA_PORT}/api/health`);
      if (res.ok) {
        console.log('[media] Media server is healthy');
        resolve();
        return;
      }
    } catch {
      // Not up yet
    }
    waitForMedia(resolve, reject, attemptsLeft - 1);
  }, 500);
}

export function stopMediaServer(): void {
  stopping = true;
  if (mediaProcess) {
    console.log('[media] Stopping media server...');
    mediaProcess.kill('SIGTERM');
    mediaProcess = null;
  }
}
