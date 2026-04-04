import * as os from 'os';

export const config = {
  listenIp: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
  announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
  rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '40000'),
  rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '40100'),
  mediaPort: parseInt(process.env.MEDIA_PORT || '3001'),
  numWorkers: Math.min(os.cpus().length, 4), // Cap at 4 for small scale
};

export const mediaCodecs: any[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    parameters: {
      minptime: 10,
      useinbandfec: 1,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 0,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
  },
];
