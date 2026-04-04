import { Router } from 'express';
import { getOrCreateRouter, getRouter, closeRouter } from './router-manager.js';
import { createWebRtcTransport, getTransport, closeTransport } from './transport-manager.js';
import { createProducer, getProducer, closeProducer } from './producer-manager.js';
import { createConsumer, getConsumer, resumeConsumer, closeConsumer } from './consumer-manager.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Routers (one per room/voice channel) ---

apiRouter.post('/routers', async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: 'roomId required' });

    const router = await getOrCreateRouter(roomId);
    res.json({
      routerId: router.id,
      rtpCapabilities: router.rtpCapabilities,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/routers/:roomId', (req, res) => {
  closeRouter(req.params.roomId);
  res.json({ ok: true });
});

// --- Transports ---

apiRouter.post('/routers/:roomId/transports', async (req, res) => {
  try {
    const router = getRouter(req.params.roomId);
    if (!router) return res.status(404).json({ error: 'Router not found' });

    const transport = await createWebRtcTransport(router);
    res.json({
      transportId: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/transports/:id/connect', async (req, res) => {
  try {
    const transport = getTransport(req.params.id);
    if (!transport) return res.status(404).json({ error: 'Transport not found' });

    await transport.connect({ dtlsParameters: req.body.dtlsParameters });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/transports/:id', (req, res) => {
  closeTransport(req.params.id);
  res.json({ ok: true });
});

// --- Producers ---

apiRouter.post('/transports/:id/produce', async (req, res) => {
  try {
    const transport = getTransport(req.params.id);
    if (!transport) return res.status(404).json({ error: 'Transport not found' });

    const producer = await createProducer(
      transport,
      req.body.kind,
      req.body.rtpParameters,
      req.body.appData ?? {},
    );
    res.json({ producerId: producer.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/producers/:id/pause', async (req, res) => {
  try {
    const producer = getProducer(req.params.id);
    if (!producer) return res.status(404).json({ error: 'Producer not found' });
    await producer.pause();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/producers/:id/resume', async (req, res) => {
  try {
    const producer = getProducer(req.params.id);
    if (!producer) return res.status(404).json({ error: 'Producer not found' });
    await producer.resume();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/producers/:id', (req, res) => {
  closeProducer(req.params.id);
  res.json({ ok: true });
});

// --- Consumers ---

apiRouter.post('/transports/:id/consume', async (req, res) => {
  try {
    const transport = getTransport(req.params.id);
    if (!transport) return res.status(404).json({ error: 'Transport not found' });

    const producer = getProducer(req.body.producerId);
    if (!producer) return res.status(404).json({ error: 'Producer not found' });

    const { rtpCapabilities, roomId } = req.body;
    const router = getRouter(roomId);
    if (!router) return res.status(404).json({ error: 'Router not found' });

    const consumer = await createConsumer(transport, producer, rtpCapabilities, router);
    if (!consumer) return res.status(400).json({ error: 'Cannot consume' });

    res.json({
      consumerId: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      appData: producer.appData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/consumers/:id/resume', async (req, res) => {
  try {
    await resumeConsumer(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/consumers/:id', (req, res) => {
  closeConsumer(req.params.id);
  res.json({ ok: true });
});
