import webpush from 'web-push';
import { db } from '../db/client';
import { env } from '../config/env';

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    // VAPID keys not configured; push notifications will be silently skipped.
    return;
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: unknown,
): Promise<void> {
  ensureVapid();

  // If VAPID keys are not set, silently skip
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({ title, body, data });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ),
    ),
  );

  // Remove expired/invalid subscriptions (HTTP 410 Gone)
  const expiredEndpoints: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint);
      }
    }
  }

  if (expiredEndpoints.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }
}

export async function subscribePush(
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await db.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    update: {
      userId,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  });
}

export async function unsubscribePush(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}
